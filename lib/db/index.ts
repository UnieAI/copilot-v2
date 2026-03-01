import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

// Reuse a single pool in dev/hot-reload to avoid spawning excess connections
const connectionString = process.env.POSTGRES_URL!;

const globalForDb = globalThis as unknown as {
  __dbClient?: ReturnType<typeof postgres>;
};

const client = globalForDb.__dbClient ?? postgres(connectionString, { max: 5 });
if (!globalForDb.__dbClient) {
  globalForDb.__dbClient = client;
}

export const db = drizzle(client, { schema });
