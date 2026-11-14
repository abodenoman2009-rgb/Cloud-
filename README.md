# Cloud Hard Drive

Next.js + PostgreSQL (Drizzle). Required Railway variables: `DATABASE_URL`, `AUTH_SECRET`, `APP_BASE_URL`, `SMTP_URL`, `MAIL_FROM`.

For Railway, add these under the service's **Variables** tab, then redeploy:

- `DATABASE_URL`: Railway PostgreSQL `DATABASE_URL` reference variable.
- `AUTH_SECRET`: a long random secret generated for this app.
- `APP_BASE_URL`: the public HTTPS URL of this app.
- `SMTP_URL`: SMTP connection URL from your email provider (keep credentials secret).
- `MAIL_FROM`: verified sender, for example `Cloud Hard Drive <no-reply@your-domain.com>`.

Email/password signups stay unverified and cannot create an authenticated session until the six-digit email code is confirmed. Codes expire in 10 minutes; resends are throttled. Google OAuth accounts are marked verified only after Google's ID token confirms the email.
