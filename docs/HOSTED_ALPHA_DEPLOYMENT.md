# Hosted Alpha Deployment

This runbook turns BreakGen from localhost into a single hosted invited-alpha
service. The production image builds the React client into `client/dist`, serves
it from FastAPI, runs Alembic migrations on startup, and starts one Uvicorn
worker by default.

## Architecture

- One Fly.io app serves both the API and the SPA.
- FastAPI serves `client/dist` via `server/main.py`.
- PostgreSQL is managed externally, recommended Neon for alpha.
- Artifacts use Cloudflare R2 through the S3-compatible adapter.
- Uvicorn defaults to one worker so in-process alpha rate limiting remains
  correct. Move rate limits to Redis before increasing workers or instances.

## Required Provisioning

1. Create a Neon Postgres database.
2. Convert the connection string to the async SQLAlchemy form:

   ```text
   postgresql+asyncpg://USER:PASSWORD@HOST/DB?ssl=require
   ```

3. Create a Cloudflare R2 bucket, for example `breakgen-artifacts`.
4. Create an R2 API token with object read/write permissions for that bucket.
5. Create or choose a Fly.io app name and update `fly.toml` if it is not
   `breakgen-alpha`.

## Fly Secrets

Set these before deploying:

```bash
fly secrets set \
  BREAKGEN_JWT_SECRET="$(openssl rand -hex 32)" \
  BREAKGEN_DATABASE_URL="postgresql+asyncpg://USER:PASSWORD@HOST/DB?ssl=require" \
  BREAKGEN_ARTIFACT_STORAGE_BACKEND="r2" \
  BREAKGEN_R2_ENDPOINT_URL="https://ACCOUNT_ID.r2.cloudflarestorage.com" \
  BREAKGEN_R2_BUCKET="breakgen-artifacts" \
  BREAKGEN_R2_ACCESS_KEY_ID="..." \
  BREAKGEN_R2_SECRET_ACCESS_KEY="..." \
  BREAKGEN_CORS_ORIGINS="https://breakgen-alpha.fly.dev" \
  BREAKGEN_PUBLIC_SIGNUP_ENABLED="false"
```

Optional:

```bash
fly secrets set BREAKGEN_MESHY_API_KEY="..."
```

### Client identity for rate limiting

On Fly, the socket peer inside the container is always Fly's internal proxy, so
without configuration every user would share one rate-limit bucket. Fly sets a
non-spoofable `Fly-Client-IP` header (it strips any inbound copy), so the
recommended setting is:

```bash
fly secrets set BREAKGEN_TRUSTED_CLIENT_IP_HEADER="Fly-Client-IP"
```

`client_rate_key` uses that header first when configured. Other platforms expose
an equivalent (Cloudflare `CF-Connecting-IP`, etc.). Only fall back to
`BREAKGEN_TRUSTED_PROXY_HOSTS` (X-Forwarded-For from a known proxy address) if the
platform has no guaranteed client-IP header — a wrong value there either collapses
all users into one bucket or trusts spoofed `X-Forwarded-For`.

## Deploy

```bash
fly deploy
```

The production entrypoint runs:

```bash
uv run --directory server alembic -c ../alembic.ini upgrade head
uv run --directory server uvicorn server.main:app --host 0.0.0.0 --port "$PORT" --workers 1
```

## Seed Reviewer Account

After the first successful deploy:

```bash
fly ssh console
cd /app
BREAKGEN_ALPHA_PASSWORD="replace-with-strong-password" \
  uv run --directory server python -m server.scripts.seed_alpha_user \
  --email "founder@example.com" \
  --name "Founder"
```

## Smoke Test

1. Open `https://breakgen-alpha.fly.dev`.
2. Sign in with the seeded reviewer account.
3. Create a keyboard or macropad project.
4. Edit the layout.
5. Compile electronics and mechanical evidence.
6. Validate the project.
7. Export and download the bundle.
8. Confirm:
   - `/api/health` returns `200`.
   - `/api/readiness` returns `200`.
   - export artifacts are present in the R2 bucket.
   - the downloaded ZIP contains manifest/checksum/build-guide evidence.

## Backups

Before inviting any user:

- Enable Neon restore/branching or point-in-time recovery for the database.
- Enable R2 object versioning or an equivalent bucket retention policy.
- Keep all production secrets outside the repository.
