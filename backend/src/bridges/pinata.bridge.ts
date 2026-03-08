import * as pinataLib from "../../../pinata/src";

import { env } from "../config/env";

// ─── Interface ────────────────────────────────────────────────────────────────

export interface IPinataBridge {
  pinJSON(data: unknown, name: string): Promise<string>;
  pinFile(fileUrl: string, name: string): Promise<string>;
  getGatewayUrl(cid: string): string;
}

// ─── Real implementation ──────────────────────────────────────────────────────

export class PinataBridgeImpl implements IPinataBridge {
  constructor(jwt?: string, gateway?: string) {
    const resolvedJwt = jwt ?? env.PINATA_JWT;
    const resolvedGateway = gateway ?? env.PINATA_GATEWAY;
    if (resolvedJwt && resolvedGateway) {
      pinataLib.initialize(resolvedJwt, resolvedGateway);
    }
    // If neither is provided, pinata module falls back to its own .env on first use
  }

  async pinJSON(data: unknown, name: string): Promise<string> {
    return pinataLib.pinGenericJSON(data, name);
  }

  async pinFile(fileUrl: string, name: string): Promise<string> {
    return pinataLib.pinGenericFile(fileUrl, name);
  }

  getGatewayUrl(cid: string): string {
    return pinataLib.getGatewayUrl(cid);
  }
}

// ─── Stub (kept for test environments without Pinata credentials) ─────────────

export class PinataBridgeStub implements IPinataBridge {
  private gatewayBase = "https://gateway.pinata.cloud/ipfs";

  async pinJSON(data: unknown, name: string): Promise<string> {
    const hash = Buffer.from(JSON.stringify({ name, ts: Date.now() }))
      .toString("base64")
      .replace(/[^a-zA-Z0-9]/g, "")
      .slice(0, 32);
    const cid = `QmStub${hash.padEnd(40, "0")}`;
    console.log(`[pinata-stub] pinJSON "${name}" → ${cid}`);
    return cid;
  }

  async pinFile(fileUrl: string, name: string): Promise<string> {
    const hash = Buffer.from(fileUrl + name)
      .toString("base64")
      .replace(/[^a-zA-Z0-9]/g, "")
      .slice(0, 32);
    const cid = `QmFile${hash.padEnd(40, "0")}`;
    console.log(`[pinata-stub] pinFile "${name}" (${fileUrl}) → ${cid}`);
    return cid;
  }

  getGatewayUrl(cid: string): string {
    return `${this.gatewayBase}/${cid}`;
  }
}
