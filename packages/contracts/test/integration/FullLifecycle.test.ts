import { expect } from "chai";
import { deployFullSuite, createStandardEscrow, type Suite } from "../helpers/fixtures.js";
import {
  ESCROW_AMOUNT, DEFAULT_PAYOUT_BPS, PLATFORM_FEE_BPS, BPS_DENOMINATOR,
  ORDER_ID_1, ORDER_ID_2, DEFAULT_GRACE_PERIOD, SELLER_RESPONSE_WINDOW,
  BUYER_EVIDENCE_CID, SELLER_EVIDENCE_CID,
} from "../helpers/constants.js";
import { increaseTime } from "../helpers/time.js";

function bpsOf(amount: bigint, bps: number | bigint): bigint {
  return (amount * BigInt(bps)) / BPS_DENOMINATOR;
}

describe("FullLifecycle", function () {
  let suite: Suite;
  beforeEach(async function () { suite = await deployFullSuite(); });

  describe("Happy path — full lifecycle", function () {
    it("create → all transitions → finalize: correct token flows", async function () {
      const { flusd, esm, operator, seller, feeWallet } = suite;
      const sellerStart = await flusd.balanceOf(seller.address);
      const feeStart = await flusd.balanceOf(feeWallet.address);
      const escrowId = await createStandardEscrow(suite);
      for (let i = 0; i < 4; i++) await esm.connect(operator).advanceState(escrowId);
      await increaseTime(suite.conn, DEFAULT_GRACE_PERIOD + 1n);
      await esm.connect(operator).finalize(escrowId);
      const p0 = bpsOf(ESCROW_AMOUNT, DEFAULT_PAYOUT_BPS[0]);
      const p1 = bpsOf(ESCROW_AMOUNT, DEFAULT_PAYOUT_BPS[1]);
      const p2 = bpsOf(ESCROW_AMOUNT, DEFAULT_PAYOUT_BPS[2]);
      const p3 = bpsOf(ESCROW_AMOUNT, DEFAULT_PAYOUT_BPS[3]);
      const holdback = bpsOf(ESCROW_AMOUNT, DEFAULT_PAYOUT_BPS[4]);
      const fee = bpsOf(holdback, PLATFORM_FEE_BPS);
      expect(await flusd.balanceOf(seller.address)).to.equal(sellerStart + p0 + p1 + p2 + p3 + holdback - fee);
      expect(await flusd.balanceOf(feeWallet.address)).to.equal(feeStart + fee);
      expect((await esm.getEscrow(escrowId)).state).to.equal(6n);
    });

    it("contract holds zero tokens after finalization", async function () {
      const { flusd, esm, operator } = suite;
      const escrowId = await createStandardEscrow(suite);
      for (let i = 0; i < 4; i++) await esm.connect(operator).advanceState(escrowId);
      await increaseTime(suite.conn, DEFAULT_GRACE_PERIOD + 1n);
      await esm.connect(operator).finalize(escrowId);
      expect(await flusd.balanceOf(await esm.getAddress())).to.equal(0n);
    });
  });

  describe("Dispute — buyer wins via auto-resolve", function () {
    it("seller never responds → auto-refund 100% of frozen", async function () {
      const { flusd, esm, dr, operator, buyer } = suite;
      const escrowId = await createStandardEscrow(suite);
      await esm.connect(operator).advanceState(escrowId);
      await esm.connect(operator).advanceState(escrowId);
      const disputeId = await dr.connect(operator).createDispute.staticCall(escrowId, BUYER_EVIDENCE_CID);
      await dr.connect(operator).createDispute(escrowId, BUYER_EVIDENCE_CID);
      const frozen = (await esm.getEscrow(escrowId)).frozenAmount;
      const before = await flusd.balanceOf(buyer.address);
      await increaseTime(suite.conn, SELLER_RESPONSE_WINDOW + 1n);
      await dr.autoResolve(disputeId);
      expect(await flusd.balanceOf(buyer.address)).to.equal(before + frozen);
      expect((await esm.getEscrow(escrowId)).state).to.equal(6n);
    });
  });

  describe("Dispute — seller wins via admin", function () {
    it("RELEASE_SELLER: seller receives frozen minus fee", async function () {
      const { flusd, esm, dr, operator, admin, seller, feeWallet } = suite;
      const escrowId = await createStandardEscrow(suite);
      await esm.connect(operator).advanceState(escrowId);
      const disputeId = await dr.connect(operator).createDispute.staticCall(escrowId, BUYER_EVIDENCE_CID);
      await dr.connect(operator).createDispute(escrowId, BUYER_EVIDENCE_CID);
      await dr.connect(operator).respondToDispute(disputeId, SELLER_EVIDENCE_CID);
      const frozen = (await esm.getEscrow(escrowId)).frozenAmount;
      const fee = bpsOf(frozen, PLATFORM_FEE_BPS);
      const sellerBefore = await flusd.balanceOf(seller.address);
      const feeBefore = await flusd.balanceOf(feeWallet.address);
      await dr.connect(admin).resolveDispute(disputeId, 2, 0);
      expect(await flusd.balanceOf(seller.address)).to.equal(sellerBefore + frozen - fee);
      expect(await flusd.balanceOf(feeWallet.address)).to.equal(feeBefore + fee);
    });
  });

  describe("Dispute — 60/40 split", function () {
    it("admin resolves SPLIT: 60% buyer, 40% seller minus fee", async function () {
      const { flusd, esm, dr, operator, admin, buyer, seller } = suite;
      const escrowId = await createStandardEscrow(suite);
      const disputeId = await dr.connect(operator).createDispute.staticCall(escrowId, BUYER_EVIDENCE_CID);
      await dr.connect(operator).createDispute(escrowId, BUYER_EVIDENCE_CID);
      await dr.connect(operator).respondToDispute(disputeId, SELLER_EVIDENCE_CID);
      const frozen = (await esm.getEscrow(escrowId)).frozenAmount;
      const buyerBefore = await flusd.balanceOf(buyer.address);
      const sellerBefore = await flusd.balanceOf(seller.address);
      await dr.connect(admin).resolveDispute(disputeId, 3, 6000);
      const buyerRefund = bpsOf(frozen, 6000);
      const sellerGross = frozen - buyerRefund;
      const fee = bpsOf(sellerGross, PLATFORM_FEE_BPS);
      expect(await flusd.balanceOf(buyer.address)).to.equal(buyerBefore + buyerRefund);
      expect(await flusd.balanceOf(seller.address)).to.equal(sellerBefore + sellerGross - fee);
    });
  });

  describe("Fund conservation", function () {
    it("contract holds zero tokens after dispute resolution", async function () {
      const { flusd, esm, dr, operator, admin } = suite;
      const escrowId = await createStandardEscrow(suite);
      const disputeId = await dr.connect(operator).createDispute.staticCall(escrowId, BUYER_EVIDENCE_CID);
      await dr.connect(operator).createDispute(escrowId, BUYER_EVIDENCE_CID);
      await dr.connect(operator).respondToDispute(disputeId, SELLER_EVIDENCE_CID);
      await dr.connect(admin).resolveDispute(disputeId, 3, 5000);
      expect(await flusd.balanceOf(await esm.getAddress())).to.equal(0n);
    });
  });

  describe("Multiple concurrent escrows", function () {
    it("two escrows are independent", async function () {
      const { flusd, esm, operator, buyer, seller, owner } = suite;
      await flusd.connect(owner).mint(buyer.address, ESCROW_AMOUNT * 2n);
      await flusd.connect(buyer).approve(await esm.getAddress(), ESCROW_AMOUNT * 2n);
      await esm.connect(operator).createEscrow(ORDER_ID_1, buyer.address, seller.address, await flusd.getAddress(), ESCROW_AMOUNT, DEFAULT_PAYOUT_BPS);
      await esm.connect(operator).createEscrow(ORDER_ID_2, buyer.address, seller.address, await flusd.getAddress(), ESCROW_AMOUNT, DEFAULT_PAYOUT_BPS);
      expect((await esm.getEscrow(0n)).orderId).to.equal(ORDER_ID_1);
      expect((await esm.getEscrow(1n)).orderId).to.equal(ORDER_ID_2);
      expect(await esm.escrowCount()).to.equal(2n);
    });
  });
});
