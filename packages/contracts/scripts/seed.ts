/**
 * seed.ts — Mint FLUSD to demo wallets on the XRPL EVM Testnet.
 * Usage: npx hardhat run scripts/seed.ts --network xrplEvmTestnet
 *
 * Set FLUSD_ADDRESS env var or drop the deployed address below.
 * Set BUYER_WALLET / SELLER_WALLET env vars for recipients.
 */
import { network } from "hardhat";

async function main() {
  const conn = await network.connect();
  const { ethers } = conn;

  const SEED_AMOUNT = ethers.parseUnits("10000", 6); // 10,000 FLUSD

  const [deployer] = await ethers.getSigners();
  console.log(`Seeding from: ${deployer.address}`);

  const flusdAddress = process.env.FLUSD_ADDRESS;
  if (!flusdAddress) throw new Error("Set FLUSD_ADDRESS env var to the deployed FLUSD contract address");

  const flusd = await ethers.getContractAt("FLUSD", flusdAddress);
  console.log(`FLUSD: ${flusdAddress}`);

  const recipients: string[] = [];
  if (process.env.BUYER_WALLET) recipients.push(process.env.BUYER_WALLET);
  if (process.env.SELLER_WALLET) recipients.push(process.env.SELLER_WALLET);

  // Deduplicate in case buyer and seller are the same wallet
  const unique = [...new Set(recipients)];

  if (unique.length === 0) {
    console.warn("No recipients — set BUYER_WALLET and/or SELLER_WALLET env vars.");
    return;
  }

  for (const addr of unique) {
    const tx = await flusd.mint(addr, SEED_AMOUNT);
    await tx.wait();
    const bal = await flusd.balanceOf(addr);
    console.log(`  Minted to ${addr} | balance: ${ethers.formatUnits(bal, 6)} FLUSD`);
  }

  console.log("Done.");
}

main().catch((err) => { console.error(err); process.exit(1); });
