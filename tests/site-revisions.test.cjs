'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const migration = fs.readFileSync(path.join(__dirname, '..', 'supabase', 'shared-site-model.sql'), 'utf8');
const saveFunction = migration.match(/create or replace function public\.ppm_save_site_state\([\s\S]*?\$\$;/i)?.[0];

// Structural checks always run. Runtime checks below execute the actual migration
// in PostgreSQL/WASM, with fixture auth roles and auth.uid(), rather than mocking SQL.
test('CAS checks and permission predicate are in the same UPDATE statement', () => {
  assert.ok(saveFunction, 'versioned save RPC exists');
  const update = saveFunction.match(/update public\.ppm_sites s[\s\S]*?returning s\.revision into saved_revision;/i)?.[0];
  assert.match(update || '', /revision\s*=\s*s\.revision\+1/i);
  assert.match(update || '', /s\.revision\s*=\s*p_expected_revision/i);
  assert.match(update || '', /m\.site_id\s*=\s*s\.id/);
  assert.match(update || '', /m\.user_id\s*=\s*caller_id/);
  assert.match(update || '', /m\.role in \('admin','technician'\)/);
});

test('migration has create-only conflict handling and removes the direct-update path', () => {
  assert.match(saveFunction, /on conflict \(id\) do nothing/i);
  assert.doesNotMatch(saveFunction, /on conflict[\s\S]*?do update/i);
  assert.match(migration, /drop policy if exists "PPM shared sites update"/i);
  assert.doesNotMatch(migration, /create policy "PPM shared sites update"/i);
  assert.match(migration, /drop policy if exists "PPM shared sites delete"/i);
  assert.doesNotMatch(migration, /create policy "PPM shared sites delete"/i);
  assert.match(migration, /revoke insert, update, delete on public\.ppm_sites from public, anon, authenticated/i);
});

let PGlite;
try {
  ({ PGlite } = require('@electric-sql/pglite'));
} catch (error) {
  if (error.code !== 'MODULE_NOT_FOUND') throw error;
}

const users = {
  admin: '00000000-0000-0000-0000-000000000001',
  technician: '00000000-0000-0000-0000-000000000002',
  viewer: '00000000-0000-0000-0000-000000000003',
  outsider: '00000000-0000-0000-0000-000000000004',
};
const payload = (id, label = 'fixture') => ({ site: { id, name: label }, devices: [{ id: 1, siteId: id, label }] });

// Install locally without modifying the app's dependencies:
// npm install --prefix /tmp/ppm-pglite --ignore-scripts --no-audit --no-fund @electric-sql/pglite
// NODE_PATH=/tmp/ppm-pglite/node_modules node --test tests/site-revisions.test.cjs
// PGlite has one connection. Queued contender tests verify stale-write semantics;
// genuine overlapping multi-session lock/wait races require a native PostgreSQL
// staging test before rollout and are NOT claimed by this suite.
test('PostgreSQL/WASM migration, authorization and revision integration', {
  skip: PGlite ? false : 'Install @electric-sql/pglite and expose its node_modules via NODE_PATH; SQL runtime tests were not run',
}, async (t) => {
  const db = new PGlite();
  t.after(() => db.close());
  await db.exec(`
    create role anon;
    create role authenticated;
    create schema auth;
    create schema storage;
    create table storage.objects (bucket_id text not null, name text not null);
    create table auth.users (id uuid primary key, email text);
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
    $$;
    grant usage on schema auth, public to anon, authenticated;
    grant execute on function auth.uid() to anon, authenticated;
    alter default privileges in schema public grant all on tables to public, anon, authenticated;
    create table public.ppm_sites (
      id bigint primary key,
      name text not null default '',
      site_state jsonb not null default '{}'::jsonb,
      created_by uuid references auth.users(id) on delete set null,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
    insert into public.ppm_sites(id,name,site_state)
    values (9,'Existing fixture','{"site":{"id":9},"notes":"original data"}');
  `);
  for (const [name, id] of Object.entries(users)) {
    await db.query('insert into auth.users(id,email) values($1,$2)', [id, `${name}@example.test`]);
  }
  await db.exec(migration);

  async function asUser(user, action, role = 'authenticated') {
    assert.ok(['authenticated', 'anon'].includes(role));
    await db.exec(`set role ${role}`);
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [users[user] || '']);
    try { return await action(); }
    finally {
      await db.exec('reset role');
      await db.query("select set_config('request.jwt.claim.sub','',false)");
    }
  }
  const save = (id, state, revision, name = 'Saved fixture') => db.query(
    'select public.ppm_save_site_state($1,$2,$3::jsonb,$4)::text as revision',
    [id, name, JSON.stringify(state), revision],
  );
  const revisionOf = result => result.rows[0].revision;
  const row = async id => (await db.query(
    'select id::text,name,site_state,revision::text,created_by::text from public.ppm_sites where id=$1', [id],
  )).rows[0];
  const membership = async (id, user, role) => db.query(
    'insert into public.ppm_site_members(site_id,user_id,role) values($1,$2,$3)', [id, users[user], role],
  );
  const expectCode = (operation, code, message) => assert.rejects(operation, error => {
    assert.equal(error.code, code);
    if (message) assert.equal(error.message, message);
    return true;
  });

  await t.test('upgrade preserves existing state and adds a non-null revision default', async () => {
    const previous = await row(9);
    assert.equal(previous.revision, '1');
    assert.equal(previous.site_state.notes, 'original data');
    const info = (await db.query(`select is_nullable,column_default,data_type
      from information_schema.columns where table_schema='public'
      and table_name='ppm_sites' and column_name='revision'`)).rows[0];
    assert.equal(info.is_nullable, 'NO');
    assert.equal(info.column_default, '1');
    assert.equal(info.data_type, 'bigint');
  });

  await t.test('new site and its creator membership commit atomically', async () => {
    const result = await asUser('admin', () => save(100, payload(100), null));
    assert.equal(revisionOf(result), '1');
    assert.equal((await row(100)).created_by, users.admin);
    const members = (await db.query('select user_id::text,role from public.ppm_site_members where site_id=100')).rows;
    assert.deepEqual(members, [{ user_id: users.admin, role: 'admin' }]);
  });

  await t.test('membership failure rolls back the new site instead of leaving an orphan', async () => {
    await db.exec(`
      create function public.test_reject_membership() returns trigger language plpgsql as $$
      begin
        if new.site_id=102 then raise exception using errcode='23514', message='Fixture membership failure'; end if;
        return new;
      end;
      $$;
      create trigger test_reject_membership before insert on public.ppm_site_members
      for each row execute function public.test_reject_membership();
    `);
    try {
      await asUser('admin', () => expectCode(() => save(102, payload(102), null), '23514'));
      assert.equal(await row(102), undefined);
      assert.equal((await db.query('select * from public.ppm_site_members where site_id=102')).rows.length, 0);
    } finally {
      await db.exec('drop trigger test_reject_membership on public.ppm_site_members; drop function public.test_reject_membership()');
    }
  });

  await t.test('queued create contenders produce one site and one creator membership', async () => {
    const results = await asUser('admin', () => Promise.allSettled([
      save(103, payload(103, 'creator A'), null),
      save(103, payload(103, 'creator B'), null),
    ]));
    assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
    assert.equal(results.find(result => result.status === 'rejected').reason.code, '40001');
    assert.equal((await row(103)).revision, '1');
    assert.equal((await db.query('select * from public.ppm_site_members where site_id=103')).rows.length, 1);
  });

  await t.test('historical orphaned photos/backups block ID reuse without exposing or claiming objects', async () => {
    for (const [id, bucket] of [[500, 'ppm-photos'], [501, 'ppm-backups']]) {
      await db.query('insert into storage.objects(bucket_id,name) values($1,$2)', [bucket, `sites/${id}/private/customer-backup.bin`]);
      await asUser('outsider', () => expectCode(() => save(id, payload(id), null), '40001', 'Site revision conflict; reload before saving'));
      assert.equal(await row(id), undefined);
      assert.equal((await db.query('select * from public.ppm_site_members where site_id=$1', [id])).rows.length, 0);
      assert.equal((await db.query('select * from storage.objects where bucket_id=$1 and name=$2', [bucket, `sites/${id}/private/customer-backup.bin`])).rows.length, 1);
    }
  });

  await t.test('zero-padded orphan folder IDs are reserved using safe text normalization', async () => {
    for (const [id, folder, bucket] of [[777, '0777', 'ppm-photos'], [778, '0'.repeat(100) + '778', 'ppm-backups']]) {
      await db.query('insert into storage.objects(bucket_id,name) values($1,$2)', [bucket, `sites/${folder}/private.bin`]);
      await asUser('outsider', () => expectCode(() => save(id, payload(id), null), '40001', 'Site revision conflict; reload before saving'));
      assert.equal(await row(id), undefined);
      assert.equal((await db.query('select * from public.ppm_site_members where site_id=$1', [id])).rows.length, 0);
    }
    // An unrelated folder larger than bigint must not make valid creation fail.
    await db.query('insert into storage.objects(bucket_id,name) values($1,$2)', ['ppm-backups', 'sites/9223372036854775808/private.bin']);
    assert.equal(revisionOf(await asUser('outsider', () => save(779, payload(779), null))), '1');
  });

  await t.test('orphan guard uses the exact site-folder boundary and only PPM buckets', async () => {
    await db.query('insert into storage.objects(bucket_id,name) values($1,$2)', ['ppm-backups', 'sites/5020/private.bin']);
    await db.query('insert into storage.objects(bucket_id,name) values($1,$2)', ['unrelated-bucket', 'sites/502/private.bin']);
    assert.equal(revisionOf(await asUser('outsider', () => save(502, payload(502), null))), '1');
  });

  await t.test('creator and technician advance the exact known revision', async () => {
    assert.equal(revisionOf(await asUser('admin', () => save(100, payload(100, 'admin update'), '1'))), '2');
    await membership(100, 'technician', 'technician');
    await membership(100, 'viewer', 'viewer');
    assert.equal(revisionOf(await asUser('technician', () => save(100, payload(100, 'technician update'), '2'))), '3');
    assert.equal((await row(100)).site_state.devices[0].label, 'technician update');
  });

  await t.test('stale and future versions fail without mutating state or revision', async () => {
    const previous = await row(100);
    for (const expected of ['1', '2', '999']) {
      await asUser('admin', () => expectCode(() => save(100, payload(100, 'bad update'), expected), '40001'));
      assert.deepEqual(await row(100), previous);
    }
  });

  await t.test('queued same-version saves accept exactly one (single-connection CAS, not a concurrency test)', async () => {
    const results = await asUser('admin', () => Promise.allSettled([
      save(100, payload(100, 'contender A'), '3'),
      save(100, payload(100, 'contender B'), '3'),
    ]));
    assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
    assert.equal(results.filter(result => result.status === 'rejected').length, 1);
    assert.equal(results.find(result => result.status === 'rejected').reason.code, '40001');
    assert.equal((await row(100)).revision, '4');
  });

  await t.test('NULL expected revision never overwrites or grants access to a colliding site', async () => {
    const previous = await row(100);
    for (const user of ['admin', 'technician', 'viewer', 'outsider']) {
      await asUser(user, () => expectCode(() => save(100, payload(100, 'collision'), null), '40001'));
    }
    assert.deepEqual(await row(100), previous);
    const outsiderMemberships = await db.query('select * from public.ppm_site_members where site_id=100 and user_id=$1', [users.outsider]);
    assert.equal(outsiderMemberships.rows.length, 0);
  });

  await t.test('viewers, nonmembers and missing sites expose no state or revision on write errors', async () => {
    const previous = await row(100);
    for (const [user, id, expected] of [['viewer', 100, '4'], ['outsider', 100, '4'], ['outsider', 101, '1']]) {
      await asUser(user, () => expectCode(() => save(id, payload(id), expected), '42501', 'No edit access to site'));
    }
    assert.deepEqual(await row(100), previous);
    const inaccessible = await asUser('outsider', () => db.query('select * from public.ppm_sites where id=100'));
    assert.equal(inaccessible.rows.length, 0);
    const accessible = await asUser('viewer', () => db.query('select revision::text from public.ppm_sites where id=100'));
    assert.equal(accessible.rows[0].revision, '4');
  });

  await t.test('revoked/downgraded edit membership cannot save a known current version', async () => {
    await db.query("update public.ppm_site_members set role='viewer' where site_id=100 and user_id=$1", [users.technician]);
    await asUser('technician', () => expectCode(() => save(100, payload(100), '4'), '42501'));
    await db.query('delete from public.ppm_site_members where site_id=100 and user_id=$1', [users.technician]);
    await asUser('technician', () => expectCode(() => save(100, payload(100), '4'), '42501'));
    assert.equal((await row(100)).revision, '4');
  });

  await t.test('server rejects unauthenticated calls and invalid state/id/revision inputs', async () => {
    await asUser(null, () => expectCode(() => save(200, payload(200), null), '42501'));
    await asUser(null, () => expectCode(() => save(200, payload(200), null), '42501'), 'anon');
    for (const state of [null, [], 'text', {}, { site: null }, { site: { id: 999 } }]) {
      await asUser('admin', () => expectCode(() => save(200, state, null), '22023'));
    }
    for (const id of [null, 0, -1]) {
      await asUser('admin', () => expectCode(() => save(id, payload(id), null), '22023'));
    }
    for (const expected of ['0', '-1']) {
      await asUser('admin', () => expectCode(() => save(100, payload(100), expected), '22023'));
    }
    assert.equal(await row(200), undefined);
    assert.equal((await row(100)).revision, '4');
  });

  await t.test('legacy writer fails closed for both existing and new sites', async () => {
    const previous = await row(100);
    for (const id of [100, 201]) {
      await asUser('admin', () => expectCode(() => db.query(
        'select public.ppm_upsert_site_state($1,$2,$3::jsonb)', [id, 'Legacy', JSON.stringify(payload(id))],
      ), '55000', 'Client upgrade required: use ppm_save_site_state with an expected revision'));
    }
    assert.deepEqual(await row(100), previous);
    assert.equal(await row(201), undefined);
  });

  await t.test('direct INSERT/UPDATE are denied even for site admins and after broader PUBLIC grants', async () => {
    // Fixture initial grants emulate permissive platform defaults, so this also
    // checks that the migration revokes the inherited PUBLIC write route.
    await asUser('admin', () => expectCode(() => db.query("update public.ppm_sites set name='Bypass' where id=100"), '42501'));
    await asUser('admin', () => expectCode(() => db.query("insert into public.ppm_sites(id,name) values(202,'Bypass')"), '42501'));
    const privileges = (await db.query(`select
      has_table_privilege('authenticated','public.ppm_sites','UPDATE') as can_update,
      has_table_privilege('authenticated','public.ppm_sites','INSERT') as can_insert,
      has_table_privilege('authenticated','public.ppm_sites','DELETE') as can_delete`)).rows[0];
    assert.deepEqual(privileges, { can_update: false, can_insert: false, can_delete: false });
  });

  await t.test('physical site deletion is denied to every account, preserving IDs against orphaned Storage takeover', async () => {
    await asUser('admin', () => save(300, payload(300), null));
    await membership(300, 'technician', 'technician');
    await membership(300, 'viewer', 'viewer');
    const previous = await row(300);
    for (const user of ['admin', 'technician', 'viewer', 'outsider']) {
      await asUser(user, () => expectCode(() => db.query('delete from public.ppm_sites where id=300 returning id'), '42501'));
    }
    assert.deepEqual(await row(300), previous);
    assert.equal((await db.query('select * from public.ppm_site_members where site_id=300')).rows.length, 3);
    // A different authenticated account cannot recycle the still-reserved ID.
    await asUser('outsider', () => expectCode(() => save(300, payload(300, 'takeover'), null), '40001'));
    assert.equal((await db.query('select * from public.ppm_site_members where site_id=300 and user_id=$1', [users.outsider])).rows.length, 0);
  });

  await t.test('bigint revisions compare and increment exactly beyond JavaScript safe integers', async () => {
    await asUser('admin', () => save(400, payload(400), null));
    await db.query('update public.ppm_sites set revision=$1 where id=400', ['9007199254740992']);
    const result = await asUser('admin', () => save(400, payload(400, 'large revision'), '9007199254740992'));
    assert.equal(revisionOf(result), '9007199254740993');
    await asUser('admin', () => expectCode(() => save(400, payload(400), '9007199254740992'), '40001'));
    assert.equal((await row(400)).revision, '9007199254740993');
  });

  await t.test('migration can be reapplied without resetting revisions or reviving legacy writes', async () => {
    const previous = await row(100);
    await db.exec(migration);
    await db.exec(migration);
    assert.deepEqual(await row(100), previous);
    await asUser('admin', () => expectCode(() => db.query('delete from public.ppm_sites where id=100'), '42501'));
    await asUser('admin', () => expectCode(() => save(100, payload(100), '3'), '40001'));
    await asUser('admin', () => expectCode(() => db.query("update public.ppm_sites set name='Bypass' where id=100"), '42501'));
    assert.equal(revisionOf(await asUser('admin', () => save(100, payload(100, 'after rerun'), '4'))), '5');
  });
});
