import dotenv from "dotenv";

dotenv.config();

if (!process.env.NVIDIA_API_KEY) {
  throw new Error("NVIDIA_API_KEY is required. Copy .env.example to .env and set your key.");
}

export const config = {
  NVIDIA_API_KEY: process.env.NVIDIA_API_KEY,
  MCP_PORT: parseInt(process.env.MCP_PORT ?? "3001", 10),
  NVIDIA_MODEL: process.env.NVIDIA_MODEL ?? "nvidia/llama-3.1-nemotron-ultra-253b-v1",
  SESSION_TTL_MS: 30 * 60 * 1000,           // 30 minutes
  MAX_SESSIONS: 100,
  SESSION_CLEANUP_INTERVAL_MS: 5 * 60 * 1000, // 5 minutes
  FLOWSTATE_API_URL: process.env.FLOWSTATE_API_URL ?? "http://localhost:3000",
  FLOWSTATE_API_KEY: process.env.FLOWSTATE_API_KEY ?? "",
  FLOWSTATE_PROJECT_ID: process.env.FLOWSTATE_PROJECT_ID ?? "",
} as const;
