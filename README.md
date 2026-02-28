This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, setup your environment variables by copying the example file:

```bash
cp .env.exmaple .env
```

Then, install dependencies and run the development server:

```bash
npm i
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Database & Redis Setup (Docker)

To run the required PostgreSQL and Redis instances locally:

```bash
# PostgreSQL @ Windows
docker run -d --name unieai-postgres -e POSTGRES_USER=admin -e POSTGRES_PASSWORD=105114 -e POSTGRES_DB=UnieAI_Chatroom_DB -p 5432:5432 -v D:/Docker/Database/unieai-chatroom:/var/lib/postgresql/data --restart unless-stopped postgres:16

# PostgreSQL @ Mac
docker run -d \
  --name unieai-postgres \
  -e POSTGRES_USER=admin \
  -e POSTGRES_PASSWORD=105114 \
  -e POSTGRES_DB=UnieAI_Chatroom_DB \
  -p 5432:5432 \
  -v unieai-postgres-data:/var/lib/postgresql/data \
  --restart unless-stopped \
  postgres:16

# Redis @ Windows
docker run -d --name unieai-redis -p 6379:6379 -v D:/Docker/Database/unieai-redis:/data --restart unless-stopped redis:7

# Redis @ Mac
docker run -d \
  --name unieai-redis \
  -p 6379:6379 \
  -v unieai-redis-data:/data \
  --restart unless-stopped \
  redis:7


```

## Drizzle ORM Migrations

After starting the database, run the following to apply the schema:

```bash
npx drizzle-kit generate
npx drizzle-kit migrate
npx drizzle-kit push
```

## Learn More

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Drizzle ORM](https://orm.drizzle.team/docs/overview) - Next generation TypeScript ORM.
- [NextAuth.js](https://next-auth.js.org/) - Authentication for Next.js.
