import { Worker, type Job, type ConnectionOptions } from "bullmq";
import type { AgentService } from "../../services/agent.service";

export interface AgentRoutingJobData {
  projectId: string;
  role: "buyer" | "seller" | "admin";
  userId: string;
  message: string;
}

export interface AgentRoutingDeps {
  agentService: AgentService;
  broadcastToProject: (projectId: string, event: string, data: unknown) => void;
}

function createProcessor(deps: AgentRoutingDeps) {
  return async function processAgentRouting(
    job: Job<AgentRoutingJobData>,
  ): Promise<void> {
    const { projectId, role, userId, message } = job.data;

    const result = await deps.agentService.chat(
      projectId,
      role,
      userId,
      message,
    );

    deps.broadcastToProject(projectId, "chat_response", {
      role,
      userId,
      response: result.response,
      suggestedActions: result.suggestedActions,
    });

    console.log(
      `[agent-routing] Routed ${role} agent response for project ${projectId}`,
    );
  };
}

export function createAgentRoutingWorker(
  connection: ConnectionOptions,
  deps: AgentRoutingDeps,
): Worker<AgentRoutingJobData> {
  const worker = new Worker<AgentRoutingJobData>(
    "agent-routing",
    createProcessor(deps),
    {
      connection,
      concurrency: 3,
    },
  );

  worker.on("completed", (job) => {
    console.log(`[agent-routing] Job ${job.id} completed`);
  });

  worker.on("failed", (job, error) => {
    console.error(`[agent-routing] Job ${job?.id} failed: ${error.message}`);
  });

  return worker;
}
