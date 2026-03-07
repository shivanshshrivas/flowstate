import type { network } from "hardhat";

type Conn = Awaited<ReturnType<typeof network.connect>>;

export async function increaseTime(conn: Conn, seconds: number | bigint): Promise<void> {
  await conn.networkHelpers.time.increase(Number(seconds));
}

export async function getBlockTimestamp(conn: Conn): Promise<bigint> {
  return BigInt(await conn.networkHelpers.time.latest());
}
