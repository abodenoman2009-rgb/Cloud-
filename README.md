# Cloud Hard Drive

Next.js + PostgreSQL (Drizzle). Required runtime variables: `DATABASE_URL`, `AUTH_SECRET`, `APP_BASE_URL`.

## Railway configuration

Add variables to the **web service** in Railway. Railway resolves references and exposes the resulting values to the app as ordinary environment variables read via `process.env`.

- `DATABASE_URL`: reference the PostgreSQL service, for example `${{Postgres.DATABASE_URL}}` (use the actual name of your database service).
- `AUTH_SECRET`: generate a strong random secret and store it as a Railway variable.
- `APP_BASE_URL`: the app's public HTTPS domain, for example `https://your-app.up.railway.app`.
- For email: `SMTP_URL` and `MAIL_FROM` (verified sender address).
- For S3-compatible storage, set `STORAGE_DRIVER=s3`, `S3_BUCKET`, `S3_REGION`, `S3_ENDPOINT`, `S3_ACCESS_KEY_ID`, and `S3_SECRET_ACCESS_KEY`. Credentials can reference another Railway service's shared variables, e.g. `${{ObjectStorage.ACCESS_KEY_ID}}`; replace the service and variable names with your actual values.
- If using local file storage, set `STORAGE_DRIVER=local` and `DATA_DIR` to a mounted Railway Volume path. Container-local disk is not durable across redeploys.

After adding or changing variables, redeploy the web service. Do not commit credentials or secrets to the repository.

## Per-user storage quota

Each account receives 1 TiB (1,099,511,627,776 bytes, or 1024 GiB). On startup the service updates the quota on existing user rows as well as using this default for new accounts. This does not provision 1 TiB of physical storage: the selected S3 provider or Railway Volume must have enough capacity and the appropriate plan.

Optional: `GOOGLE_*`, `DATA_DIR`, `STORAGE_DRIVER`, `S3_*`, `SMTP_URL`, `MAIL_FROM`.
