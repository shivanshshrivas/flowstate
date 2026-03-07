/**
 * Shippo Bridge — Standalone Development Server
 *
 * Runs all 4 shipping endpoints as a plain Node.js HTTP server.
 * No framework dependencies — mirrors the pattern in webhook.js.
 *
 * In production these handlers are registered into the main Fastify backend
 * (api.flowstate.xyz). This server is for local sandbox verification only.
 *
 * Usage:
 *   node src/server.js
 *
 * Endpoints:
 *   POST  /api/v1/shipping/rates
 *   POST  /api/v1/shipping/webhook/shippo
 *   GET   /api/v1/shipping/track/:orderId?carrier=usps&tracking_number=9400...
 *   POST  /api/v1/orders/:id/select-shipping
 */

require("dotenv").config({ path: require("path").join(__dirname, "../.env") });

const http = require("http");
const {
  getRatesHandler,
  selectShippingHandler,
  getTrackingHandler,
  webhookHandler,
} = require("./routes");

const PORT = process.env.PORT || 3002;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => (raw += chunk));
    req.on("end", () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        reject(Object.assign(new Error("Invalid JSON body"), { statusCode: 400 }));
      }
    });
    req.on("error", reject);
  });
}

function send(res, statusCode, body) {
  res.writeHead(statusCode, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body, null, 2));
}

function parseUrl(urlStr) {
  const url = new URL(urlStr, "http://localhost");
  return { pathname: url.pathname, query: Object.fromEntries(url.searchParams) };
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

async function router(req, res) {
  const { pathname, query } = parseUrl(req.url);
  const method = req.method;

  try {
    // POST /api/v1/shipping/rates
    if (method === "POST" && pathname === "/api/v1/shipping/rates") {
      const body = await readBody(req);
      const result = await getRatesHandler(body);
      return send(res, 200, result);
    }

    // POST /api/v1/shipping/webhook/shippo
    if (method === "POST" && pathname === "/api/v1/shipping/webhook/shippo") {
      const body = await readBody(req);
      const result = await webhookHandler(body);
      return send(res, 200, result);
    }

    // GET /api/v1/shipping/track/:orderId
    const trackMatch = pathname.match(/^\/api\/v1\/shipping\/track\/([^/]+)$/);
    if (method === "GET" && trackMatch) {
      const order_id = trackMatch[1];
      const result = await getTrackingHandler({
        order_id,
        carrier:         query.carrier,
        tracking_number: query.tracking_number,
      });
      return send(res, 200, result);
    }

    // POST /api/v1/orders/:id/select-shipping
    const selectMatch = pathname.match(/^\/api\/v1\/orders\/([^/]+)\/select-shipping$/);
    if (method === "POST" && selectMatch) {
      const order_id = selectMatch[1];
      const body = await readBody(req);
      const result = await selectShippingHandler({ order_id, ...body });
      return send(res, 200, result);
    }

    // Health check
    if (method === "GET" && pathname === "/health") {
      return send(res, 200, { ok: true, service: "shippo-bridge" });
    }

    send(res, 404, { error: "Not found" });
  } catch (err) {
    const status = err.statusCode ?? 500;
    console.error(`[shippo-server] ${method} ${pathname} → ${status}: ${err.message}`);
    send(res, status, { error: err.message });
  }
}

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

const server = http.createServer(router);

server.listen(PORT, () => {
  console.log(`\nShippo bridge listening on http://localhost:${PORT}`);
  console.log("\nEndpoints:");
  console.log(`  POST  http://localhost:${PORT}/api/v1/shipping/rates`);
  console.log(`  POST  http://localhost:${PORT}/api/v1/shipping/webhook/shippo`);
  console.log(`  GET   http://localhost:${PORT}/api/v1/shipping/track/:orderId?carrier=usps&tracking_number=...`);
  console.log(`  POST  http://localhost:${PORT}/api/v1/orders/:id/select-shipping`);
  console.log("\nHealth check:");
  console.log(`  GET   http://localhost:${PORT}/health\n`);
});
