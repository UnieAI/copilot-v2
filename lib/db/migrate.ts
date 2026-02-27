import 'dotenv/config';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';

const runMigrate = async () => {
  if (!process.env.POSTGRES_URL) {
    throw new Error('POSTGRES_URL is not defined');
  }

  // Create highly privileged connection just for migrations
  const connection = postgres(process.env.POSTGRES_URL, { max: 1 });
  const db = drizzle(connection);

  console.log('⏳ Running migrations...');
  const start = Date.now();

  try {
    await migrate(db, { migrationsFolder: 'lib/db/migrations' });
    const end = Date.now();
    console.log(`✅ Migrations completed in ${end - start}ms`);
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  } finally {
    // Only close the connection, exit the script cleanly
    await connection.end();
    process.exit(0);
  }
};

runMigrate();
