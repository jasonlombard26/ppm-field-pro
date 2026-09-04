# Security Policy

PPM Field Pro handles customer security-system information. Treat site records, device credentials, photos, backup files and diagnostic reports as confidential.

## Report a vulnerability

Do not open a public GitHub issue containing customer information, credentials, access tokens or reproduction data. Report security concerns privately to the repository owner.

## Required production controls

- Keep the source repository private while it contains customer/site payloads or operational credentials.
- Never commit Supabase secret/service-role keys. The browser may contain only the publishable/anon key.
- Keep Row Level Security enabled for every exposed table and keep Storage buckets private.
- Restrict Supabase account creation to approved/invited users and require email confirmation.
- Use separate admin, technician and viewer test accounts to verify both allowed and denied actions.
- Require strong unique passwords and MFA for GitHub and Supabase administrators.
- Do not paste full diagnostic reports publicly; they can contain account email, URLs and device metadata.
- Rotate any customer device password that has ever been committed, exported publicly or shared outside authorised personnel.
- Review dependency and code-scanning alerts before deployment.

## Known security limitation

CCTV/device passwords are currently stored as plaintext inside the site's JSON state and in offline browser storage. Masking a password in the interface does not encrypt it. Do not treat this field as a secure password vault. A separate encrypted secret-storage design is required before storing production credentials.

## Deployment verification

Before a release, verify the live Supabase deployment against:

1. `supabase/setup.sql`
2. `supabase/shared-site-model.sql`
3. `supabase/storage-policies.sql`
4. `supabase/security-hardening.sql`

Confirm unauthorised users cannot read any site row or Storage object and viewers cannot create, update or delete records/files.
