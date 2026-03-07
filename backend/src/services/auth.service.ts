import { db } from "../db/client";
import { projects, apiKeys } from "../db/schema";
import { generateId } from "../utils/id-generator";
import { hashApiKey } from "../utils/crypto";
import { eq } from "drizzle-orm";

export interface CreateProjectInput {
  name: string;
  ownerEmail: string;
  platformFeeWallet: string;
  platformFeeBps?: number;
  contracts?: Record<string, string>;
}

export class AuthService {
  async createProject(input: CreateProjectInput): Promise<{ projectId: string; apiKey: string }> {
    const projectId = generateId.project();
    const rawKey = generateId.liveApiKey();
    const keyHash = hashApiKey(rawKey);
    const keyPrefix = rawKey.slice(0, 16);
    const apiKeyId = generateId.apiKey();

    await db.insert(projects).values({
      id: projectId,
      name: input.name,
      ownerEmail: input.ownerEmail,
      platformFeeWallet: input.platformFeeWallet,
      platformFeeBps: input.platformFeeBps ?? 250,
      contracts: input.contracts ?? null,
    });

    await db.insert(apiKeys).values({
      id: apiKeyId,
      projectId,
      keyHash,
      keyPrefix,
      label: "default",
      isActive: true,
    });

    return { projectId, apiKey: rawKey };
  }

  async rotateApiKey(projectId: string, label?: string): Promise<{ apiKeyId: string; apiKey: string }> {
    await db
      .update(apiKeys)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(apiKeys.projectId, projectId));

    const rawKey = generateId.liveApiKey();
    const keyHash = hashApiKey(rawKey);
    const keyPrefix = rawKey.slice(0, 16);
    const apiKeyId = generateId.apiKey();

    await db.insert(apiKeys).values({
      id: apiKeyId,
      projectId,
      keyHash,
      keyPrefix,
      label: label ?? "rotated",
      isActive: true,
    });

    return { apiKeyId, apiKey: rawKey };
  }
}
