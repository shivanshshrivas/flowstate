/**
 * demo-flow.ts — Run the happy-path on the XRPL EVM Testnet.
 * Usage: npx hardhat run scripts/demo-flow.ts --network xrplEvmTestnet
 *
 * Required env vars:
 *   ESM_ADDRESS    — deployed EscrowStateMachine address
 *   FLUSD_ADDRESS  — deployed FLUSD address
 *   BUYER_WALLET   — buyer address (must have approved ESM to spend FLUSD)
 *   SELLER_WALLET  — seller address
 */
import { network } from "hardhat";

const DEFAULT_PAYOUT_BPS: [number, number, number, number, number] = [1500, 1500, 2000, 3500, 1500];
const STATES = ["INITIATED", "ESCROWED", "LABEL_CREATED", "SHIPPED", "IN_TRANSIT", "DELIVERED", "FINALIZED", "DISPUTED"];

async function main() {
  const conn = await network.connect();
  const { ethers } = conn;

  const ESCROW_AMOUNT = ethers.parseUnits("100", 6);

  const [operator] = await ethers.getSigners();
  console.log(`\n=== FlowState Demo — operator: ${operator.address} ===\n`);

  const esmAddr = process.env.ESM_ADDRESS ?? (() => { throw new Error("Set ESM_ADDRESS"); })();
  const flusdAddr = process.env.FLUSD_ADDRESS ?? (() => { throw new Error("Set FLUSD_ADDRESS"); })();
  const buyerAddr = process.env.BUYER_WALLET ?? (() => { throw new Error("Set BUYER_WALLET"); })();
  const sellerAddr = process.env.SELLER_WALLET ?? (() => { throw new Error("Set SELLER_WALLET"); })();

  const flusd = await ethers.getContractAt("FLUSD", flusdAddr, operator);
  const esm = await ethers.getContractAt("EscrowStateMachine", esmAddr, operator);

  // Mint to buyer (operator is owner for demo)
  console.log("1. Minting 100 FLUSD to buyer...");
  await (await flusd.mint(buyerAddr, ESCROW_AMOUNT)).wait();

  console.log("   NOTE: buyer must approve ESM from their wallet before createEscrow:");
  console.log(`   flusd.approve("${esmAddr}", ${ESCROW_AMOUNT})\n`);

  const orderId = ethers.encodeBytes32String(`DEMO-${Date.now()}`);

  console.log("2. Creating escrow...");
  try {
    const tx = await esm.createEscrow(orderId, buyerAddr, sellerAddr, flusdAddr, ESCROW_AMOUNT, DEFAULT_PAYOUT_BPS);
    await tx.wait();
  } catch (e: any) {
    console.log(`   Failed — buyer may not have approved: ${String(e.message).slice(0, 100)}`);
    return;
  }

  const escrowId = (await esm.escrowCount()) - 1n;
  const printState = async () => {
    const e = await esm.getEscrow(escrowId);
    console.log(`   State: ${STATES[Number(e.state)]} | Released: ${ethers.formatUnits(e.releasedAmount, 6)} FLUSD`);
  };
  await printState();

  for (const label of ["LABEL_CREATED", "SHIPPED", "IN_TRANSIT", "DELIVERED"]) {
    console.log(`\n3. Advancing → ${label}...`);
    await (await esm.advanceState(escrowId)).wait();
    await printState();
  }

  console.log("\n4. Waiting 5s then attempting finalize (will fail unless grace period is short on testnet)...");
  await new Promise((r) => setTimeout(r, 5000));
  try {
    await (await esm.finalize(escrowId)).wait();
    await printState();
    console.log("\n=== Demo complete! ===");
  } catch {
    console.log("   Grace period still active. Reduce defaultGracePeriod on testnet and retry.");
  }

  console.log(`\nSeller balance: ${ethers.formatUnits(await flusd.balanceOf(sellerAddr), 6)} FLUSD`);
  console.log(`Explorer: https://explorer.testnet.xrplevm.org/address/${esmAddr}`);
}

main().catch((err) => { console.error(err); process.exit(1); });
