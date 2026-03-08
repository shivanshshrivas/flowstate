import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { AgentService } from "../agent.service";

vi.mock("../../config/env", () => ({
  env: { MCP_AGENTS_URL: "http://mcp-agents.test" },
}));

/**
 * Builds a minimal SSE stream that emits:
 *   1. An "endpoint" event with the sessionId
 *   2. A "message" event with the JSON-RPC result
 */
function makeSseBody(sessionId: string, responseText: string): ReadableStream {
  const endpointEvent = `event: endpoint\ndata: /message?sessionId=${sessionId}\n\n`;
  const resultPayload = JSON.stringify({
    result: { content: [{ type: "text", text: responseText }] },
  });
  const messageEvent = `event: message\ndata: ${resultPayload}\n\n`;

  const encoder = new TextEncoder();
  const chunks = [encoder.encode(endpointEvent), encoder.encode(messageEvent)];
  let idx = 0;

  return new ReadableStream({
    pull(controller) {
      if (idx < chunks.length) {
        controller.enqueue(chunks[idx++]);
      } else {
        controller.close();
      }
    },
  });
}

describe("AgentService.chat", () => {
  let service: AgentService;
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    service = new AgentService();
    fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("1. returns response text from MCP tool result", async () => {
    fetchSpy
      .mockResolvedValueOnce({
        ok: true,
        body: makeSseBody("sess_abc", "Your order is SHIPPED."),
      })
      .mockResolvedValueOnce({ ok: true }); // POST /message

    const result = await service.chat("proj_1", "buyer", "0xBuyer", "Where is my order?");

    expect(result.response).toBe("Your order is SHIPPED.");
    expect(result.role).toBe("buyer");
  });

  it("2. routes buyer role to buyer_agent_chat tool", async () => {
    fetchSpy
      .mockResolvedValueOnce({
        ok: true,
        body: makeSseBody("sess_buyer", "Here are your orders."),
      })
      .mockResolvedValueOnce({ ok: true });

    await service.chat("proj_1", "buyer", "0xBuyer", "List my orders");

    const postCall = fetchSpy.mock.calls[1];
    const body = JSON.parse(postCall[1].body);
    expect(body.params.name).toBe("buyer_agent_chat");
    expect(body.params.arguments.buyer_wallet).toBe("0xBuyer");
  });

  it("3. routes seller role to seller_agent_chat tool", async () => {
    fetchSpy
      .mockResolvedValueOnce({
        ok: true,
        body: makeSseBody("sess_seller", "Your metrics are ready."),
      })
      .mockResolvedValueOnce({ ok: true });

    await service.chat("proj_1", "seller", "seller_123", "Show my metrics");

    const postCall = fetchSpy.mock.calls[1];
    const body = JSON.parse(postCall[1].body);
    expect(body.params.name).toBe("seller_agent_chat");
    expect(body.params.arguments.seller_id).toBe("seller_123");
    expect(body.params.arguments.buyer_wallet).toBeUndefined();
  });

  it("4. routes admin role to admin_agent_chat tool", async () => {
    fetchSpy
      .mockResolvedValueOnce({
        ok: true,
        body: makeSseBody("sess_admin", "Platform analytics loaded."),
      })
      .mockResolvedValueOnce({ ok: true });

    await service.chat("proj_1", "admin", "admin_user", "Show analytics");

    const postCall = fetchSpy.mock.calls[1];
    const body = JSON.parse(postCall[1].body);
    expect(body.params.name).toBe("admin_agent_chat");
  });

  it("5. POSTs to /message with correct sessionId from SSE endpoint event", async () => {
    fetchSpy
      .mockResolvedValueOnce({
        ok: true,
        body: makeSseBody("sess_xyz789", "Done."),
      })
      .mockResolvedValueOnce({ ok: true });

    await service.chat("proj_1", "buyer", "0xBuyer", "Hello");

    const postCall = fetchSpy.mock.calls[1];
    expect(postCall[0]).toContain("sessionId=sess_xyz789");
    expect(postCall[1].method).toBe("POST");
  });

  it("6. throws when SSE fetch returns no body", async () => {
    fetchSpy.mockResolvedValueOnce({ ok: true, body: null });

    await expect(
      service.chat("proj_1", "buyer", "0xBuyer", "Hello"),
    ).rejects.toThrow("No SSE response body");
  });

  it("7. returns fallback text when content array has no text item", async () => {
    const encoder = new TextEncoder();
    const endpointEvent = `event: endpoint\ndata: /message?sessionId=sess_empty\n\n`;
    const resultPayload = JSON.stringify({ result: { content: [] } });
    const messageEvent = `event: message\ndata: ${resultPayload}\n\n`;

    const stream = new ReadableStream({
      pull(controller) {
        controller.enqueue(encoder.encode(endpointEvent + messageEvent));
        controller.close();
      },
    });

    fetchSpy
      .mockResolvedValueOnce({ ok: true, body: stream })
      .mockResolvedValueOnce({ ok: true });

    const result = await service.chat("proj_1", "buyer", "0xBuyer", "Hi");
    expect(result.response).toBe("No response from agent.");
  });
});
