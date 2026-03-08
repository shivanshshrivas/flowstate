// Quick WebSocket diagnostic — logs every frame Pinata sends
// Run: node pinata-agents/ws-test.js
const WebSocket = require("ws");
const crypto = require("crypto");

const AGENT_URL = process.env.PINATA_BUYER_AGENT_URL || "wss://xm6iv9yn.agents.pinata.cloud";
const TOKEN = process.env.PINATA_BUYER_AGENT_TOKEN || "111ee7e4-5fa2-4f5a-93b3-a97c4bf8e2c1";
const MESSAGE = "Hello, what can you help me with?";

const wsUrl = AGENT_URL.replace(/^https?:\/\//, "wss://").replace(/\/$/, "") + `?token=${TOKEN}`;
console.log("[ws-test] connecting to:", wsUrl.replace(TOKEN, TOKEN.slice(0, 8) + "..."));

const ws = new WebSocket(wsUrl, { family: 4, headers: { origin: "https://agents.pinata.cloud" } });
let state = "connecting";

ws.on("open", () => {
  state = "connected";
  console.log("[ws-test] OPEN — waiting for challenge...");
});

ws.on("message", (data) => {
  const raw = data.toString();
  console.log(`[ws-test] RECV [state=${state}]:`, raw);

  let parsed;
  try { parsed = JSON.parse(raw); } catch { console.log("[ws-test] non-JSON frame, skipping"); return; }

  if (parsed.type === "event" && parsed.event === "connect.challenge") {
    const nonce = parsed.payload?.nonce;
    state = "challenged";

    const resp = JSON.stringify({
      type: "req",
      method: "connect",
      id: `${Date.now()}-connect`,
      params: {
        minProtocol: 3,
        maxProtocol: 3,
        client: { id: "webchat", displayName: "FlowState Backend", version: "1.0.0", platform: "node", mode: "webchat" },
        role: "operator",
        scopes: ["operator.admin", "operator.approvals", "operator.pairing"],
        caps: [],
        commands: [],
        permissions: {},
        auth: { token: TOKEN },
        locale: "en-US",
        userAgent: "flowstate-backend/1.0.0",
      },
    });
    console.log("[ws-test] SEND challenge response:", resp);
    ws.send(resp);

    setTimeout(() => {
      if (ws.readyState !== WebSocket.OPEN) {
        console.log("[ws-test] socket closed, readyState:", ws.readyState);
        return;
      }

      // First: read current config to understand ACP setup
      const configReq = JSON.stringify({
        type: "req",
        method: "config.get",
        id: `${Date.now()}-config`,
        params: {},
      });
      console.log("[ws-test] SEND config.get:", configReq);
      ws.send(configReq);
      state = "config_requested";
    }, 500);
    return;
  }

  if (parsed.type === "event" && parsed.event === "connect.ready") {
    state = "ready";
    console.log("[ws-test] GOT connect.ready — server confirmed connection");
    return;
  }

  // Streaming chunk from agent
  if (parsed.type === "event" && parsed.event === "agent") {
    const stream = parsed.payload?.stream;
    const data = parsed.payload?.data;

    if (stream === "lifecycle") {
      if (data?.phase === "end" || data?.phase === "done") {
        console.log("\n[ws-test] lifecycle end, closing");
        ws.close();
      }
      return;
    }

    if (stream === "assistant") {
      if (data?.delta) process.stdout.write(data.delta);
      // track full text in case we need it on close
      if (data?.text) ws._fullText = data.text;
      return;
    }
    return;
  }

  // Print any res we haven't handled yet
  if (parsed.type === "res") {
    console.log("[ws-test] RES ok=" + parsed.ok + ":", JSON.stringify(parsed.payload ?? parsed.error, null, 2));
    return;
  }

  if (parsed.type === "done" || parsed.done) {
    console.log("\n[ws-test] DONE");
    ws.close();
    return;
  }

  console.log("[ws-test] unhandled frame type:", parsed.type, "event:", parsed.event);
});

ws.on("close", (code, reason) => {
  console.log(`[ws-test] CLOSE — code=${code} reason=${reason?.toString() || "(none)"} state=${state}`);
});

ws.on("error", (err) => {
  console.error("[ws-test] ERROR:", err.message);
});

// Kill after 30s
setTimeout(() => { console.log("[ws-test] timeout"); ws.terminate(); process.exit(0); }, 30_000);
