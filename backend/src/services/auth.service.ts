import { db } from "../db/client";
import { generateId } from "../utils/id-generator";
import { hashApiKey } from "../utils/crypto";

export interface CreateProjectInput {
  name: string;
  ownerEmail: string;
  platformFeeWallet: string;
  platformFeeBps?: number;
  contracts?: Record<string, string>;
}

export class AuthService {
  async createProject(
    input: CreateProjectInput,
  ): Promise<{ projectId: string; apiKey: string }> {
    const projectId = generateId.project();
    const rawKey = generateId.liveApiKey();
    const keyHash = hashApiKey(rawKey);
    const keyPrefix = rawKey.slice(0, 16);
    const apiKeyId = generateId.apiKey();

    await db`
      insert into projects (
        id,
        name,
        owner_email,
        platform_fee_wallet,
        platform_fee_bps,
        contracts
      ) values (
        ${projectId},
        ${input.name},
        ${input.ownerEmail},
        ${input.platformFeeWallet},
        ${input.platformFeeBps ?? 250},
        ${input.contracts ? db.json(input.contracts) : null}
      )
    `;

    await db`
      insert into api_keys (
        id,
        project_id,
        key_hash,
        key_prefix,
        label,
        is_active
      ) values (
        ${apiKeyId},
        ${projectId},
        ${keyHash},
        ${keyPrefix},
        ${"default"},
        true
      )
    `;

    return { projectId, apiKey: rawKey };
  }

  async rotateApiKey(
    projectId: string,
    label?: string,
  ): Promise<{ apiKeyId: string; apiKey: string }> {
    await db`
      update api_keys
      set is_active = false, updated_at = now()
      where project_id = ${projectId}
    `;

    const rawKey = generateId.liveApiKey();
    const keyHash = hashApiKey(rawKey);
    const keyPrefix = rawKey.slice(0, 16);
    const apiKeyId = generateId.apiKey();

    await db`
      insert into api_keys (
        id,
        project_id,
        key_hash,
        key_prefix,
        label,
        is_active
      ) values (
        ${apiKeyId},
        ${projectId},
        ${keyHash},
        ${keyPrefix},
        ${label ?? "rotated"},
        true
      )
    `;

    return { apiKeyId, apiKey: rawKey };
  }
}
