import { NextRequest, NextResponse } from "next/server";

/**
 * Faucet API — stub endpoint.
 * Actual minting happens client-side via wagmi writeContract → MockRLUSD.mint().
 * This endpoint is a server-side hook for future rate limiting, logging, or airdrop logic.
 */
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { wallet_address } = body;

  if (!wallet_address || !/^0x[0-9a-fA-F]{40}$/.test(wallet_address)) {
    return NextResponse.json(
      { error: "Invalid wallet address" },
      { status: 400 }
    );
  }

  // TODO: server-side mint via provider when deployed
  return NextResponse.json({
    success: true,
    message: "Use the client-side faucet to mint FLUSD via MetaMask.",
    wallet_address,
    amount: "1000000000000000000000", // 1000 FLUSD in wei
  });
}
