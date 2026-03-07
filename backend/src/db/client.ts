import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "../config/env";
import * as schema from "./schema";

const queryClient = postgres(env.DATABASE_URL, {
  ssl: env.NODE_ENV === "production" ? "require" : false,
  max: 10, // connection pool size
  idle_timeout: 30,
});

export const db = drizzle(queryClient, { schema });

export type DB = typeof db;
