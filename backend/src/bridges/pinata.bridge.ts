/**
 * IPinataBridge — interface for IPFS pinning via Pinata.
 * Stub implementation returns deterministic mock CIDs.
 * Replace with real Pinata SDK when available.
 */

export interface IPinataBridge {
  pinJSON(data: unknown, name: string): Promise<string>;
  pinFile(fileUrl: string, name: string): Promise<string>;
  getGatewayUrl(cid: string): string;
}

// ─── Stub implementation ──────────────────────────────────────────────────────

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
