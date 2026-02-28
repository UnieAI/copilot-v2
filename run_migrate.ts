import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const connectionString = "postgresql://admin:105114@localhost:5432/UnieAI_Copilot_DB";
const sql = postgres(connectionString, { max: 1 });
const db = drizzle(sql);

async function main() {
  await migrate(db, { migrationsFolder: "./lib/db/migrations" });
  console.log("Migration complete!");
  process.exit(0);
}
main();
