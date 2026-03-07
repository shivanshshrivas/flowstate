import { encodeBytes32String } from "ethers";

export const FAUCET_AMOUNT = 50_000n * 10n ** 6n;
export const FAUCET_COOLDOWN = 3600n; // 1 hour
export const DECIMALS = 6;

export const ESCROW_AMOUNT = 1_000n * 10n ** 6n; // 1,000 FLUSD

export const DEFAULT_PAYOUT_BPS: [number, number, number, number, number] = [
  1500, 1500, 2000, 3500, 1500,
];

export const BPS_DENOMINATOR = 10_000n;
export const PLATFORM_FEE_BPS = 250n; // 2.5%

export const DEFAULT_GRACE_PERIOD = 3n * 24n * 3600n; // 3 days
export const SELLER_RESPONSE_WINDOW = 72n * 3600n;    // 72 hours

export const ORDER_ID_1 = encodeBytes32String("ORDER-001");
export const ORDER_ID_2 = encodeBytes32String("ORDER-002");

export const BUYER_EVIDENCE_CID = "QmBuyerEvidence123";
export const SELLER_EVIDENCE_CID = "QmSellerEvidence456";
