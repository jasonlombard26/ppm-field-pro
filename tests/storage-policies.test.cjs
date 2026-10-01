'use strict';

// Static contract checks always run. The PostgreSQL tests use the optional,
// local-only @electric-sql/pglite runtime (no network or Supabase connection).
// Example: NODE_PATH=/tmp/ppm-pglite/node_modules node --test tests/storage-policies.test.cjs
// The fixture models Supabase roles/auth and folder paths; it is not a live
// Storage API test. Run the deployment role matrix separately before release.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const readSql = name => fs.readFileSync(path.join(root, 'supabase', name), 'utf8');
const scripts = {
  storage: readSql('storage-policies.sql'),
  hardening: readSql('security-hardening.sql')
};
const policyBlock = sql => sql.match(/-- BEGIN PPM STORAGE POLICIES[\s\S]*?-- END PPM STORAGE POLICIES/)[0];
const droppedNames = [...policyBlock(scripts.storage).matchAll(/drop policy if exists "([^"]+)" on storage\.objects;/g)].map(match => match[1]);

let PGlite;
try {
  ({ PGlite } = require('@electric-sql/pglite'));
} catch (error) {
  if (error.code !== 'MODULE_NOT_FOUND') throw error;
}

test('static contract: both SQL scripts install exactly the same Storage policies', () => {
  assert.equal(policyBlock(scripts.storage), policyBlock(scripts.hardening));
  const creates = [...policyBlock(scripts.storage).matchAll(/create policy "([^"]+)" on storage\.objects/g)].map(match => match[1]);
  assert.equal(creates.length, 8);
  for (const name of creates) assert.ok(droppedNames.includes(name), `${name} must be replaceable on re-run`);
  for (const name of ['PPM site files update', 'PPM site files delete',
    'PPM photos authenticated update', 'PPM photos authenticated delete',
    'PPM users can update site photos', 'PPM users can delete site photos']) {
    assert.ok(droppedNames.includes(name), `${name} could OR with stricter grants`);
    assert.ok(!creates.includes(name), `${name} must not be reinstated`);
  }
});

test('static contract: backups require admins for both UPDATE images and DELETE', () => {
  const policies = new Map([...policyBlock(scripts.storage).matchAll(/create policy "([^"]+)" on storage\.objects([\s\S]*?);/g)]
    .map(match => [match[1], match[2]]));
  for (const action of ['update', 'delete']) {
    for (const suffix of ['', ' guard']) {
      const policy = policies.get(`PPM site backups ${action}${suffix}`);
      assert.match(policy, new RegExp(`for ${action} to authenticated`));
      assert.equal((policy.match(/ppm_user_is_site_admin/g) || []).length, action === 'update' ? 2 : 1);
      assert.doesNotMatch(policy, /ppm_user_can_edit_site/);
      if (action === 'update') assert.match(policy, /with check/);
      if (suffix) assert.match(policy, /as restrictive/);
    }
    assert.match(policies.get(`PPM site photos ${action}`), /bucket_id='ppm-photos'/);
    assert.match(policies.get(`PPM site photos ${action}`), /ppm_user_can_edit_site/);
  }
  assert.match(policies.get('PPM site files select'), /ppm_user_has_site_access/);
  assert.match(policies.get('PPM site files insert'), /ppm_user_can_edit_site/);
});

test('static contract: hardening cannot re-enable direct site writes outside the revision RPC', () => {
  assert.match(scripts.hardening, /revoke insert, update, delete on table public\.ppm_sites from public, anon, authenticated;/);
  assert.match(scripts.hardening, /drop policy if exists "PPM shared sites update" on public\.ppm_sites;/);
  assert.match(scripts.hardening, /grant select on table public\.ppm_sites to authenticated;/);
  assert.match(scripts.hardening, /grant execute on function public\.ppm_save_site_state\(bigint,text,jsonb,bigint\) to authenticated;/);
  assert.match(scripts.hardening, /revoke all on function public\.ppm_save_site_state\(bigint,text,jsonb,bigint\) from public, anon;/);
});

const users = {
  admin: '00000000-0000-0000-0000-000000000001',
  technician: '00000000-0000-0000-0000-000000000002',
  viewer: '00000000-0000-0000-0000-000000000003',
  outsider: '00000000-0000-0000-0000-000000000004'
};

async function fixture(db) {
  await db.exec(`
    create role anon;
    create role authenticated;
    create schema auth;
    create schema storage;
    create table auth.users (id uuid primary key, email text);
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
    $$;
    create table storage.buckets (
      id text primary key, name text not null, public boolean not null default false,
      file_size_limit bigint, allowed_mime_types text[]
    );
    create table storage.objects (
      id bigint primary key, bucket_id text not null, name text not null,
      metadata text not null default '', unique(bucket_id, name)
    );
    create function storage.foldername(name text) returns text[] language sql immutable as $$
      select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1)-1];
    $$;
    alter table storage.objects enable row level security;
    grant usage on schema public, auth, storage to anon, authenticated;
    grant select, insert, update, delete on storage.objects to anon, authenticated;
  `);
  await db.exec(readSql('setup.sql'));
  await db.exec(readSql('shared-site-model.sql'));
  await db.exec(`
    insert into auth.users(id, email) values
      ('${users.admin}', 'admin@example.invalid'),
      ('${users.technician}', 'technician@example.invalid'),
      ('${users.viewer}', 'viewer@example.invalid'),
      ('${users.outsider}', 'outsider@example.invalid');
    insert into public.ppm_sites(id, name) values (101, 'Storage test A'), (202, 'Storage test B');
    insert into public.ppm_site_members(site_id, user_id, role) values
      (101, '${users.admin}', 'admin'),
      (101, '${users.technician}', 'technician'),
      (101, '${users.viewer}', 'viewer'),
      (202, '${users.technician}', 'admin');
    insert into storage.buckets(id, name) values
      ('ppm-photos', 'ppm-photos'), ('ppm-backups', 'ppm-backups');
    insert into storage.objects(id, bucket_id, name) values
      (1, 'ppm-backups', 'sites/101/head-end/backups/original.bin'),
      (2, 'ppm-photos', 'sites/101/cctv/fixture/photo.jpg'),
      (3, 'ppm-backups', 'sites/202/head-end/backups/original.bin'),
      (4, 'ppm-photos', 'sites/202/cctv/fixture/photo.jpg');
  `);
}

// Roll back each action so every role sees the same deterministic fixture.
async function asUser(db, user, sql, params = []) {
  await db.exec('begin');
  try {
    await db.exec(`set local role ${user === 'anonymous' ? 'anon' : 'authenticated'}`);
    await db.query("select set_config('request.jwt.claim.sub', $1, true)", [users[user] || '']);
    return await db.query(sql, params);
  } finally {
    await db.exec('rollback');
  }
}

async function denied(db, user, sql, params = []) {
  await assert.rejects(asUser(db, user, sql, params), error => error.code === '42501');
}

async function seedLegacyPolicies(db) {
  const { rows } = await db.query("select policyname from pg_policies where schemaname='storage' and tablename='objects'");
  for (const { policyname } of rows) await db.exec(`drop policy "${policyname.replaceAll('"', '""')}" on storage.objects`);
  // Deliberately seed each known name with an overbroad permissive policy.
  for (const name of droppedNames) {
    await db.exec(`create policy "${name}" on storage.objects for all to authenticated using (true) with check (true)`);
  }
}

async function policySnapshot(db) {
  return (await db.query(`
    select policyname, permissive, roles, cmd, qual, with_check
    from pg_policies where schemaname='storage' and tablename='objects'
    order by policyname
  `)).rows;
}

async function roleMatrix(db) {
  for (const user of [...Object.keys(users), 'anonymous']) {
    const member = ['admin', 'technician', 'viewer'].includes(user);
    const editor = ['admin', 'technician'].includes(user);
    for (const [id, bucket] of [[1, 'ppm-backups'], [2, 'ppm-photos']]) {
      const mutable = bucket === 'ppm-backups' ? user === 'admin' : editor;
      assert.equal((await asUser(db, user, 'select id from storage.objects where id=$1', [id])).rows.length, member ? 1 : 0, `${user} reads ${bucket}`);
      const insertSql = 'insert into storage.objects(id,bucket_id,name) values (99,$1,$2) returning id';
      const insertParams = [bucket, 'sites/101/fixture/new-file'];
      if (editor) assert.equal((await asUser(db, user, insertSql, insertParams)).rows.length, 1, `${user} inserts ${bucket}`);
      else await denied(db, user, insertSql, insertParams);
      assert.equal((await asUser(db, user, "update storage.objects set metadata='changed' where id=$1 returning id", [id])).rows.length, mutable ? 1 : 0, `${user} updates ${bucket}`);
      assert.equal((await asUser(db, user, 'delete from storage.objects where id=$1 returning id', [id])).rows.length, mutable ? 1 : 0, `${user} deletes ${bucket}`);
    }
  }
  for (const user of ['admin', 'viewer', 'outsider', 'anonymous']) {
    assert.equal((await asUser(db, user, 'select id from storage.objects where id in (3,4)')).rows.length, 0, `${user} cannot read site B`);
  }
  const upsert = `insert into storage.objects(id,bucket_id,name,metadata)
    values (99,'ppm-backups','sites/101/head-end/backups/original.bin','replacement')
    on conflict(bucket_id,name) do update set metadata=excluded.metadata returning id`;
  await denied(db, 'technician', upsert);
  assert.equal((await asUser(db, 'admin', upsert)).rows.length, 1);
  assert.equal((await asUser(db, 'technician', "update storage.objects set name='sites/101/renamed.bin' where id=1 returning id")).rows.length, 0);
  assert.equal((await asUser(db, 'admin', "update storage.objects set name='sites/101/renamed.bin' where id=1 returning id")).rows.length, 1);
  assert.equal((await asUser(db, 'technician', "update storage.objects set bucket_id='ppm-photos' where id=1 returning id")).rows.length, 0);
  await denied(db, 'technician', "update storage.objects set bucket_id='ppm-backups' where id=2 returning id");
  assert.equal((await asUser(db, 'admin', "update storage.objects set bucket_id='ppm-photos' where id=1 returning id")).rows.length, 1);
  assert.equal((await asUser(db, 'admin', "update storage.objects set bucket_id='ppm-backups' where id=2 returning id")).rows.length, 1);
  await denied(db, 'admin', "update storage.objects set name='sites/202/moved.bin' where id=1 returning id");
  await denied(db, 'technician', "update storage.objects set name='sites/101/moved.bin' where id=3 returning id");
}

test('PostgreSQL RLS: role matrix and effective policies survive both script orders and re-runs', {
  skip: !PGlite && 'Optional @electric-sql/pglite not installed; only static checks ran'
}, async t => {
  const db = new PGlite();
  try {
    await fixture(db);
    let expected;
    for (const order of [
      ['storage'], ['hardening'], ['storage', 'hardening'],
      ['hardening', 'storage'], ['storage', 'hardening', 'storage', 'hardening']
    ]) {
      await t.test(order.join(' → '), async () => {
        await seedLegacyPolicies(db);
        for (const name of order) await db.exec(scripts[name]);
        const snapshot = await policySnapshot(db);
        assert.equal(snapshot.length, 8);
        if (expected) assert.deepEqual(snapshot, expected);
        else expected = snapshot;
        await roleMatrix(db);
      });
    }
    await t.test('restrictive backup guards defeat an additional permissive ALL grant', async () => {
      await db.exec('create policy "external broad grant" on storage.objects for all to authenticated using (true) with check (true)');
      for (const user of ['technician', 'viewer', 'outsider']) {
        assert.equal((await asUser(db, user, "update storage.objects set metadata='bypass' where id=1 returning id")).rows.length, 0);
        assert.equal((await asUser(db, user, 'delete from storage.objects where id=1 returning id')).rows.length, 0);
        assert.equal((await asUser(db, user, "update storage.objects set bucket_id='ppm-photos' where id=1 returning id")).rows.length, 0);
        await denied(db, user, "update storage.objects set bucket_id='ppm-backups' where id=2 returning id");
      }
      await denied(db, 'admin', "update storage.objects set name='sites/202/moved.bin' where id=1 returning id");
      assert.equal((await asUser(db, 'admin', "update storage.objects set metadata='ok' where id=1 returning id")).rows.length, 1);
      assert.equal((await asUser(db, 'technician', 'delete from storage.objects where id=2 returning id')).rows.length, 1);
    });
  } finally {
    await db.close();
  }
});
