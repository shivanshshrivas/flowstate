import { network } from "hardhat";
import type { FLUSD, EscrowStateMachine, DisputeResolver } from "../../typechain-types/index.js";
import { DEFAULT_PAYOUT_BPS, ESCROW_AMOUNT, ORDER_ID_1 } from "./constants.js";

type Conn = Awaited<ReturnType<typeof network.connect>>;
type Signer = Awaited<ReturnType<Conn["ethers"]["getSigners"]>>[0];

export interface Suite {
  conn: Conn;
  flusd: FLUSD;
  esm: EscrowStateMachine;
  dr: DisputeResolver;
  owner: Signer;
  operator: Signer;
  admin: Signer;
  feeWallet: Signer;
  buyer: Signer;
  seller: Signer;
  other: Signer;
  ethers: Conn["ethers"];
}

export async function deployFullSuite(): Promise<Suite> {
  const conn = await network.connect();
  const { ethers } = conn;
  const [owner, operator, admin, feeWallet, buyer, seller, other] = await ethers.getSigners();

  const flusd = await ethers.deployContract("FLUSD", [owner.address]) as unknown as FLUSD;
  await flusd.waitForDeployment();

  const esm = await ethers.deployContract("EscrowStateMachine", [
    owner.address, operator.address, feeWallet.address,
  ]) as unknown as EscrowStateMachine;
  await esm.waitForDeployment();

  const dr = await ethers.deployContract("DisputeResolver", [
    owner.address, operator.address, admin.address, await esm.getAddress(),
  ]) as unknown as DisputeResolver;
  await dr.waitForDeployment();

  await esm.connect(owner).setDisputeResolver(await dr.getAddress());

  return { conn, flusd, esm, dr, owner, operator, admin, feeWallet, buyer, seller, other, ethers };
}

/// Mint FLUSD to buyer, approve ESM, call createEscrow. Returns escrowId.
export async function createStandardEscrow(
  suite: Suite,
  orderId: string = ORDER_ID_1,
  amount: bigint = ESCROW_AMOUNT,
): Promise<bigint> {
  const { flusd, esm, operator, buyer, seller, owner } = suite;
  await flusd.connect(owner).mint(buyer.address, amount);
  await flusd.connect(buyer).approve(await esm.getAddress(), amount);

  const tx = await esm.connect(operator).createEscrow(
    orderId, buyer.address, seller.address, await flusd.getAddress(), amount, DEFAULT_PAYOUT_BPS,
  );
  const receipt = await tx.wait();

  for (const log of receipt!.logs) {
    try {
      const parsed = esm.interface.parseLog({ topics: log.topics as string[], data: log.data });
      if (parsed?.name === "EscrowCreated") return parsed.args[0] as bigint;
    } catch { /* not our event */ }
  }
  throw new Error("EscrowCreated event not found");
}
