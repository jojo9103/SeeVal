# PostgreSQL setup

The app expects this local development connection string:

```bash
DATABASE_URL="postgresql://seeval:seeval_dev_password@localhost:5432/seeval?schema=public"
SEEV_UPLOAD_DIR="/data/seeval-storage/projects"
SEEV_BACKUP_DIR="/data/seeval-backups"
SESSION_COOKIE_SECURE="false"
```

Create the PostgreSQL role and database once:

```bash
sudo -u postgres psql
```

```sql
CREATE ROLE seeval WITH LOGIN PASSWORD 'seeval_dev_password';
CREATE DATABASE seeval OWNER seeval;
\q
```

Then run:

```bash
npx prisma migrate deploy
npm run db:generate
npm run db:seed
```

Build and run the production server with PM2:

```bash
npm run build
npm run pm2:start
pm2 save
```

After code or environment changes, rebuild and reload PM2:

```bash
npm run build
npm run pm2:reload
```

Do not run the public service with `npm run dev`; the development server can
serve stale hot-reload state and blocks development-only resources on external
hosts.

Back up the database and uploaded files:

```bash
npm run backup
```

For a daily 3 AM backup, add a cron entry:

```cron
0 3 * * * cd /data/2026Y/Project/seeval && npm run backup
```

Projects are soft-deleted: deleting a project hides it from the app, but keeps
the database rows and uploaded files for recovery.

Set `SESSION_COOKIE_SECURE="true"` when serving the app through HTTPS. Keep it
`false` only for internal HTTP testing; otherwise browsers will not keep the
login cookie over plain HTTP in production mode.

`prisma migrate dev` also works, but the PostgreSQL role must be allowed to
create a shadow database. If you want migrations instead of `db push`, grant the
role database creation permission first:

```sql
ALTER ROLE seeval CREATEDB;
```

Then run:

```bash
npm run db:migrate -- --name init_auth
```

Open the database UI:

```bash
npm run db:studio
```

The initial admin account is created from `.env`:

```bash
ADMIN_EMAIL="admin@seeval.local"
ADMIN_PASSWORD="Admin1234"
ADMIN_NAME="SeeV Admin"
ADMIN_ORGANIZATION="SeeV"
```

Change these values before running `npm run db:seed` if you want a different
admin login. The password must include letters and numbers and be at least 8
characters long.

The default local admin account after seeding is:

```txt
email: admin@seeval.local
password: Admin1234
```
