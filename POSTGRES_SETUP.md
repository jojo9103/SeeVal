# PostgreSQL setup

The app expects this local development connection string:

```bash
DATABASE_URL="postgresql://seeval:seeval_dev_password@localhost:5432/seeval?schema=public"
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
npx prisma db push
npm run db:generate
npm run db:seed
```

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
