import 'dotenv/config';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import OpenAI from 'openai';
import readline from 'readline/promises';
import { stdin as input, stdout as output } from 'process';
import { createRequire } from 'module';
import fetch from 'node-fetch';

const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');

const { PINATA_JWT, GATEWAY_URL, NVIDIA_API_KEY, NVIDIA_BASE_URL, NVIDIA_MODEL } = process.env;

if (!GATEWAY_URL) throw new Error('GATEWAY_URL is required in .env');

// connect to pinata-mcp via stdio
console.log('[startup] connecting to pinata-mcp...');
const t_connect = Date.now();
const transport = new StdioClientTransport({
  command: 'npx',
  args: ['pinata-mcp'],
  env: { ...process.env, PINATA_JWT, GATEWAY_URL },
});

const mcp = new Client({ name: 'pinata-chat', version: '1.0.0' });
await mcp.connect(transport);
console.log(`[startup] connected in ${Date.now() - t_connect}ms`);

// load tools from MCP and convert to OpenAI format
const { tools: mcpTools } = await mcp.listTools();
const mcpToolNames = new Set(mcpTools.map((t) => t.name));

// local tool definition
const LOCAL_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'getFileInsights',
      description:
        'Fetches a file from the Pinata gateway by CID and returns rich insights about its contents. ' +
        'For JSON files: returns the full parsed structure, field names, types, record count, and sample values. ' +
        'For PDF files: extracts and returns all text content, page count, and document metadata. ' +
        'Use this whenever the user wants to know what is inside a file.',
      parameters: {
        type: 'object',
        properties: {
          cid: {
            type: 'string',
            description: 'The IPFS CID of the file to analyze.',
          },
          filename: {
            type: 'string',
            description: 'Optional filename hint (e.g. "report.pdf") to help with content-type detection.',
          },
        },
        required: ['cid'],
      },
    },
  },
];

const tools = [
  ...mcpTools.map((t) => ({
    type: 'function',
    function: { name: t.name, description: t.description, parameters: t.inputSchema },
  })),
  ...LOCAL_TOOLS,
];

console.log(`Connected. ${tools.length} tools available: ${tools.map((t) => t.function.name).join(', ')}`);
console.log('Type your message or "exit" to quit.\n');

// ── local tool implementation ──────────────────────────────────────────────

async function getFileInsights({ cid, filename = '' }) {
  const url = `${GATEWAY_URL.replace(/\/$/, '')}/ipfs/${cid}`;
  let res;
  try {
    res = await fetch(url, { headers: { Authorization: `Bearer ${PINATA_JWT}` } });
  } catch (err) {
    return `Failed to fetch CID ${cid}: ${err.message}`;
  }

  if (!res.ok) return `Gateway returned HTTP ${res.status} for CID ${cid}`;

  const contentType = res.headers.get('content-type') || '';
  const lowerFilename = filename.toLowerCase();

  const isPDF =
    contentType.includes('pdf') || lowerFilename.endsWith('.pdf');
  const isJSON =
    contentType.includes('json') ||
    lowerFilename.endsWith('.json') ||
    (!isPDF && contentType.includes('text'));

  // ── PDF ──
  if (isPDF) {
    const buffer = await res.buffer();
    let data;
    try {
      data = await pdfParse(buffer);
    } catch (err) {
      return `Could not parse PDF for CID ${cid}: ${err.message}`;
    }

    const text = data.text.trim();
    const truncated = text.length > 6000 ? text.slice(0, 6000) + '\n…[truncated]' : text;

    return JSON.stringify({
      type: 'pdf',
      cid,
      pages: data.numpages,
      metadata: data.info,
      text: truncated,
    }, null, 2);
  }

  // ── JSON ──
  if (isJSON) {
    let raw;
    try {
      raw = await res.text();
    } catch (err) {
      return `Could not read response for CID ${cid}: ${err.message}`;
    }

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      // not valid JSON — return as plain text
      const truncated = raw.length > 6000 ? raw.slice(0, 6000) + '\n…[truncated]' : raw;
      return JSON.stringify({ type: 'text', cid, content: truncated }, null, 2);
    }

    const insights = analyzeJSON(parsed);
    return JSON.stringify({ type: 'json', cid, ...insights }, null, 2);
  }

  // ── unknown / binary ──
  return JSON.stringify({
    type: 'unknown',
    cid,
    contentType,
    note: 'File is not JSON or PDF. Raw content not shown.',
  }, null, 2);
}

function analyzeJSON(value, depth = 0) {
  if (Array.isArray(value)) {
    const sample = value.slice(0, 3);
    return {
      kind: 'array',
      recordCount: value.length,
      sample: sample.map((item) => (typeof item === 'object' && item !== null ? analyzeJSON(item, depth + 1) : item)),
      ...(value.length > 0 && typeof value[0] === 'object' && value[0] !== null
        ? { fields: describeFields(value[0]) }
        : {}),
    };
  }

  if (typeof value === 'object' && value !== null) {
    if (depth >= 2) return { kind: 'object', keys: Object.keys(value) };
    return {
      kind: 'object',
      fields: describeFields(value),
      preview: Object.fromEntries(
        Object.entries(value)
          .slice(0, 10)
          .map(([k, v]) => [k, typeof v === 'object' && v !== null ? (Array.isArray(v) ? `[array(${v.length})]` : '{object}') : v]),
      ),
    };
  }

  return { kind: typeof value, value };
}

function describeFields(obj) {
  return Object.entries(obj).map(([key, val]) => ({
    key,
    type: Array.isArray(val) ? `array(${val.length})` : typeof val,
    sample: typeof val === 'object' && val !== null ? null : val,
  }));
}

// ── AI chat loop ───────────────────────────────────────────────────────────

const ai = new OpenAI({ apiKey: NVIDIA_API_KEY, baseURL: NVIDIA_BASE_URL });

const messages = [
  {
    role: 'system',
    content:
      'You are a helpful data assistant with access to Pinata IPFS storage. ' +
      'When a user asks about files or their contents, use searchFiles to list them, ' +
      'then use getFileInsights to fetch and deeply analyze each file. ' +
      'For JSON files, describe the data structure, field names, record counts, and interesting values. ' +
      'For PDFs, summarize the document content, key topics, and any important details. ' +
      'Always give descriptive, insightful answers — never just say "the file exists".',
  },
];

async function chat(userMessage) {
  messages.push({ role: 'user', content: userMessage });

  let turn = 0;
  while (true) {
    turn++;
    if (turn > 10) throw new Error('Max tool-call turns (10) exceeded');
    console.log(`[turn ${turn}] calling NVIDIA API (model: ${NVIDIA_MODEL})...`);
    const t0 = Date.now();
    const res = await ai.chat.completions.create({
      model: NVIDIA_MODEL,
      messages,
      tools: tools.length ? tools : undefined,
      tool_choice: tools.length ? 'auto' : undefined,
    });
    console.log(`[turn ${turn}] NVIDIA API responded in ${Date.now() - t0}ms`);

    const msg = res.choices[0].message;
    messages.push(msg);

    if (!msg.tool_calls?.length) return msg.content;

    for (const call of msg.tool_calls) {
      const args = JSON.parse(call.function.arguments || '{}');
      console.log(`[calling ${call.function.name}] args: ${JSON.stringify(args)}`);

      const t1 = Date.now();
      let resultText;
      try {
        if (call.function.name === 'getFileInsights') {
          resultText = await getFileInsights(args);
        } else if (mcpToolNames.has(call.function.name)) {
          const result = await mcp.callTool({ name: call.function.name, arguments: args });
          resultText = result.content.map((c) => (c.type === 'text' ? c.text : JSON.stringify(c))).join('\n');
        } else {
          resultText = `Error: unknown tool "${call.function.name}"`;
        }
      } catch (err) {
        resultText = `Error: ${err.message}`;
      }
      console.log(`[tool ${call.function.name}] took ${Date.now() - t1}ms`);

      messages.push({ role: 'tool', tool_call_id: call.id, content: resultText });
    }
  }
}

const rl = readline.createInterface({ input, output });

while (true) {
  const line = (await rl.question('you: ')).trim();
  if (!line) continue;
  if (line.toLowerCase() === 'exit') break;

  try {
    const reply = await chat(line);
    console.log(`assistant: ${reply}\n`);
  } catch (err) {
    console.error(`error: ${err.message}\n`);
  }
}

rl.close();
await mcp.close();
