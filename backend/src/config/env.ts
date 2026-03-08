import { z } from "zod";
import * as dotenv from "dotenv";

dotenv.config();

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  SHIPPO_KEY: z.string().min(1, "SHIPPO_KEY is required"),
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  PLATFORM_FEE_BPS: z.coerce.number().default(250),
  GRACE_PERIOD_HOURS: z.coerce.number().default(48),
  REDIS_URL: z.string().optional(),
  PINATA_JWT: z.string().optional(),
  PINATA_GATEWAY: z.string().optional(),
  MCP_AGENTS_URL: z.string().default("http://localhost:3001"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error(
    "Invalid environment variables:",
    JSON.stringify(parsed.error.flatten().fieldErrors, null, 2),
  );
  process.exit(1);
}

export const env = parsed.data;
