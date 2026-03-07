import postgres from "postgres";
import { env } from "../config/env";

const ssl = env.NODE_ENV === "production" ? "require" : false;

export const db = postgres(env.DATABASE_URL, {
  ssl,
  max: 10,
  idle_timeout: 30,
  transform: postgres.camel,
});

export type DB = typeof db;