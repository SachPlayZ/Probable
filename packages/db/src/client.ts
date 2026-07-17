import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema.js";

export type Database = ReturnType<typeof drizzle<typeof schema>>;

export function createDatabase(connectionString: string): Database {
  const pool = new Pool({ connectionString });
  return drizzle({ client: pool, schema });
}

export { schema };
