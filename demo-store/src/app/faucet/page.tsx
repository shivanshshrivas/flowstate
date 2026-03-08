"use client";

import { useState } from "react";
import { useAccount, useReadContract, useWriteContract, useBalance } from "wagmi";
import { parseEther } from "viem";
import { Droplets, ExternalLink, Loader2, CheckCircle } from "lucide-react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { CONTRACT_ADDRESSES, XRPL_EXPLORER_URL, XRPL_FAUCET_URL } from "@/lib/constants";
import { FLUSDAbi } from "@/lib/flowstate/contracts/FLUSD.abi";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatToken, shortenAddress } from "@/lib/utils";

const MINT_AMOUNT = parseEther("1000"); // 1000 FLUSD

export default function FaucetPage() {
  const { address, isConnected } = useAccount();
  const [mintSuccess, setMintSuccess] = useState(false);

  const { data: xrpBalance } = useBalance({ address });
  const { data: flusdBalance } = useReadContract({
    address: CONTRACT_ADDRESSES.mockRLUSD,
    abi: FLUSDAbi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address && !!CONTRACT_ADDRESSES.mockRLUSD },
  });

  const { writeContract, isPending } = useWriteContract();

  function handleMint() {
    if (!address) return;
    writeContract(
      {
        address: CONTRACT_ADDRESSES.mockRLUSD,
        abi: FLUSDAbi,
        functionName: "mint",
        args: [address, MINT_AMOUNT],
      },
      {
        onSuccess: () => setMintSuccess(true),
        onError: () => setMintSuccess(false),
      }
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8 py-12 space-y-6">
      <div className="text-center">
        <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-600/20 border border-violet-600/30 mb-4">
          <Droplets className="h-7 w-7 text-violet-400" />
        </div>
        <h1 className="text-3xl font-bold text-neutral-100">Token Faucet</h1>
        <p className="text-neutral-400 mt-2">
          Get test XRP and MockRLUSD (FLUSD) for the XRPL EVM Testnet.
        </p>
      </div>

      {!isConnected ? (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-neutral-400 mb-4">Connect your wallet to use the faucet.</p>
            <ConnectButton />
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Balances */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Your Balances</CardTitle>
              <CardDescription>{address && shortenAddress(address, 6)}</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <div className="bg-neutral-800 rounded-xl p-4">
                <p className="text-xs text-neutral-500 mb-1">XRP (Gas)</p>
                <p className="text-xl font-bold text-neutral-100">
                  {xrpBalance ? Number(xrpBalance.formatted).toFixed(4) : "—"}
                </p>
                <p className="text-xs text-neutral-500 mt-0.5">XRP</p>
              </div>
              <div className="bg-neutral-800 rounded-xl p-4">
                <p className="text-xs text-neutral-500 mb-1">MockRLUSD</p>
                <p className="text-xl font-bold text-neutral-100">
                  {flusdBalance ? formatToken(String(flusdBalance), 18, "") : "—"}
                </p>
                <p className="text-xs text-neutral-500 mt-0.5">FLUSD</p>
              </div>
            </CardContent>
          </Card>

          {/* XRP Faucet */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Get Test XRP</CardTitle>
              <CardDescription>
                XRP is needed for gas fees on XRPL EVM Testnet.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <a
                href={XRPL_FAUCET_URL}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button variant="outline" className="w-full gap-2">
                  Open XRPL Faucet
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </a>
              <p className="text-xs text-neutral-500 mt-2 text-center">
                Paste your address ({address && shortenAddress(address)}) to receive 90 test XRP.
              </p>
            </CardContent>
          </Card>

          {/* FLUSD Faucet */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Get MockRLUSD (FLUSD)</CardTitle>
              <CardDescription>
                FLUSD simulates RLUSD for escrow payments on this demo store.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {mintSuccess ? (
                <div className="flex items-center gap-3 text-emerald-400 justify-center py-4">
                  <CheckCircle className="h-5 w-5" />
                  <span>1,000 FLUSD minted successfully!</span>
                </div>
              ) : (
                <>
                  <Button
                    className="w-full"
                    onClick={handleMint}
                    disabled={isPending || !CONTRACT_ADDRESSES.mockRLUSD}
                  >
                    {isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Minting…
                      </>
                    ) : (
                      <>
                        <Droplets className="h-4 w-4" />
                        Mint 1,000 FLUSD
                      </>
                    )}
                  </Button>
                  {!CONTRACT_ADDRESSES.mockRLUSD && (
                    <p className="text-xs text-amber-400 mt-2 text-center">
                      MockRLUSD contract not yet deployed. Set NEXT_PUBLIC_MOCK_RLUSD_ADDRESS in .env.
                    </p>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          <div className="text-center">
            <a
              href={`${XRPL_EXPLORER_URL}/address/${address}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-300 transition-colors"
            >
              View on Explorer <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        </>
      )}
    </div>
  );
}
