import { db } from "../db/client";
import { generateId } from "../utils/id-generator";
import { generateWebhookSecret } from "../utils/crypto";
import type { WebhookLog } from "../db/types";

export interface RegisterWebhookInput {
  url: string;
  events?: string[];
  secret?: string;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export class WebhookMgmtService {
  async register(
    projectId: string,
    input: RegisterWebhookInput,
  ): Promise<{ registrationId: string; secret: string; url: string; events: string[] }> {
    const registrationId = generateId.webhookReg();
    const secret = input.secret ?? generateWebhookSecret();
    const events = input.events ?? ["*"];

    await db`
      insert into webhook_registrations (
        id,
        project_id,
        url,
        secret,
        events,
        is_active
      ) values (
        ${registrationId},
        ${projectId},
        ${input.url},
        ${secret},
        ${db.json(events)},
        true
      )
    `;

    return { registrationId, secret, url: input.url, events };
  }

  async getLogs(
    projectId: string,
    page: number,
    limit: number,
  ): Promise<PaginatedResult<WebhookLog>> {
    const offset = (page - 1) * limit;

    const [data, countRows] = await Promise.all([
      db<WebhookLog[]>`
        select *
        from webhook_logs
        where project_id = ${projectId}
        order by created_at desc
        limit ${limit}
        offset ${offset}
      `,
      db<{ count: string }[]>`
        select count(*)::text as count
        from webhook_logs
        where project_id = ${projectId}
      `,
    ]);

    return {
      data,
      total: parseInt(countRows[0]?.count ?? "0", 10),
      page,
      limit,
    };
  }
}