import { expect } from "chai";
import { ZeroAddress } from "ethers";
import { deployFullSuite, createStandardEscrow, type Suite } from "./helpers/fixtures.js";
import {
  ESCROW_AMOUNT, BPS_DENOMINATOR, PLATFORM_FEE_BPS,
  ORDER_ID_1, BUYER_EVIDENCE_CID, SELLER_EVIDENCE_CID, SELLER_RESPONSE_WINDOW,
} from "./helpers/constants.js";
import { increaseTime } from "./helpers/time.js";

function bpsOf(amount: bigint, bps: number | bigint): bigint {
  return (amount * BigInt(bps)) / BPS_DENOMINATOR;
}

describe("DisputeResolver", function () {
  let suite: Suite;
  let escrowId: bigint;

  beforeEach(async function () {
    suite = await deployFullSuite();
    escrowId = await createStandardEscrow(suite);
  });

  describe("createDispute", function () {
    it("creates dispute and freezes escrow", async function () {
      const { dr, esm, operator } = suite;
      const disputeId = await dr.connect(operator).createDispute.staticCall(escrowId, BUYER_EVIDENCE_CID);
      await dr.connect(operator).createDispute(escrowId, BUYER_EVIDENCE_CID);
      const dispute = await dr.getDispute(disputeId);
      expect(dispute.state).to.equal(0n);
      expect(dispute.buyer).to.equal(suite.buyer.address);
      expect((await esm.getEscrow(escrowId)).state).to.equal(7n);
    });

    it("emits DisputeCreated", async function () {
      const { dr, operator } = suite;
      await expect(dr.connect(operator).createDispute(escrowId, BUYER_EVIDENCE_CID))
        .to.emit(dr, "DisputeCreated").withArgs(0n, escrowId, suite.buyer.address, suite.seller.address);
    });

    it("reverts on duplicate dispute for same escrow", async function () {
      const { dr, operator } = suite;
      await dr.connect(operator).createDispute(escrowId, BUYER_EVIDENCE_CID);
      await expect(dr.connect(operator).createDispute(escrowId, BUYER_EVIDENCE_CID))
        .to.be.revertedWithCustomError(dr, "EscrowAlreadyDisputed");
    });

    it("reverts when called by non-operator", async function () {
      await expect(suite.dr.connect(suite.other).createDispute(escrowId, BUYER_EVIDENCE_CID))
        .to.be.revertedWithCustomError(suite.dr, "UnauthorizedCaller");
    });

    it("increments disputeCount", async function () {
      expect(await suite.dr.disputeCount()).to.equal(0n);
      await suite.dr.connect(suite.operator).createDispute(escrowId, BUYER_EVIDENCE_CID);
      expect(await suite.dr.disputeCount()).to.equal(1n);
    });
  });

  describe("respondToDispute", function () {
    let disputeId: bigint;
    beforeEach(async function () {
      disputeId = await suite.dr.connect(suite.operator).createDispute.staticCall(escrowId, BUYER_EVIDENCE_CID);
      await suite.dr.connect(suite.operator).createDispute(escrowId, BUYER_EVIDENCE_CID);
    });

    it("advances to UNDER_REVIEW and records evidence", async function () {
      const { dr, operator } = suite;
      await dr.connect(operator).respondToDispute(disputeId, SELLER_EVIDENCE_CID);
      const dispute = await dr.getDispute(disputeId);
      expect(dispute.state).to.equal(2n);
      expect(dispute.sellerEvidenceCid).to.equal(SELLER_EVIDENCE_CID);
    });

    it("emits DisputeResponded and DisputeUnderReview", async function () {
      const { dr, operator } = suite;
      await expect(dr.connect(operator).respondToDispute(disputeId, SELLER_EVIDENCE_CID))
        .to.emit(dr, "DisputeResponded").withArgs(disputeId, SELLER_EVIDENCE_CID)
        .and.to.emit(dr, "DisputeUnderReview").withArgs(disputeId);
    });

    it("reverts if not in OPEN state", async function () {
      const { dr, operator } = suite;
      await dr.connect(operator).respondToDispute(disputeId, SELLER_EVIDENCE_CID);
      await expect(dr.connect(operator).respondToDispute(disputeId, SELLER_EVIDENCE_CID))
        .to.be.revertedWithCustomError(dr, "InvalidDisputeState");
    });

    it("reverts when called by non-operator", async function () {
      await expect(suite.dr.connect(suite.other).respondToDispute(disputeId, SELLER_EVIDENCE_CID))
        .to.be.revertedWithCustomError(suite.dr, "UnauthorizedCaller");
    });
  });

  describe("resolveDispute", function () {
    let disputeId: bigint;
    beforeEach(async function () {
      disputeId = await suite.dr.connect(suite.operator).createDispute.staticCall(escrowId, BUYER_EVIDENCE_CID);
      await suite.dr.connect(suite.operator).createDispute(escrowId, BUYER_EVIDENCE_CID);
      await suite.dr.connect(suite.operator).respondToDispute(disputeId, SELLER_EVIDENCE_CID);
    });

    it("REFUND_BUYER sends 100% frozen to buyer", async function () {
      const { flusd, dr, esm, admin, buyer } = suite;
      const frozen = (await esm.getEscrow(escrowId)).frozenAmount;
      const before = await flusd.balanceOf(buyer.address);
      await dr.connect(admin).resolveDispute(disputeId, 1, 0);
      expect(await flusd.balanceOf(buyer.address)).to.equal(before + frozen);
    });

    it("RELEASE_SELLER sends net (minus fee) to seller", async function () {
      const { flusd, dr, esm, admin, seller } = suite;
      const frozen = (await esm.getEscrow(escrowId)).frozenAmount;
      const fee = bpsOf(frozen, PLATFORM_FEE_BPS);
      const before = await flusd.balanceOf(seller.address);
      await dr.connect(admin).resolveDispute(disputeId, 2, 0);
      expect(await flusd.balanceOf(seller.address)).to.equal(before + frozen - fee);
    });

    it("SPLIT uses provided refundBps", async function () {
      const { flusd, dr, esm, admin, buyer } = suite;
      const frozen = (await esm.getEscrow(escrowId)).frozenAmount;
      const before = await flusd.balanceOf(buyer.address);
      await dr.connect(admin).resolveDispute(disputeId, 3, 7500);
      expect(await flusd.balanceOf(buyer.address)).to.equal(before + bpsOf(frozen, 7500));
    });

    it("emits DisputeResolved", async function () {
      await expect(suite.dr.connect(suite.admin).resolveDispute(disputeId, 1, 0))
        .to.emit(suite.dr, "DisputeResolved").withArgs(disputeId, 1n, BPS_DENOMINATOR);
    });

    it("sets state to RESOLVED", async function () {
      await suite.dr.connect(suite.admin).resolveDispute(disputeId, 1, 0);
      expect((await suite.dr.getDispute(disputeId)).state).to.equal(3n);
    });

    it("reverts if already resolved", async function () {
      await suite.dr.connect(suite.admin).resolveDispute(disputeId, 1, 0);
      await expect(suite.dr.connect(suite.admin).resolveDispute(disputeId, 1, 0))
        .to.be.revertedWithCustomError(suite.dr, "InvalidDisputeState");
    });

    it("reverts when called by non-admin", async function () {
      await expect(suite.dr.connect(suite.other).resolveDispute(disputeId, 1, 0))
        .to.be.revertedWithCustomError(suite.dr, "UnauthorizedCaller");
    });

    it("reverts on refundBps > 10000 for SPLIT", async function () {
      await expect(suite.dr.connect(suite.admin).resolveDispute(disputeId, 3, 10_001))
        .to.be.revertedWithCustomError(suite.dr, "InvalidRefundBps");
    });
  });

  describe("autoResolve", function () {
    let disputeId: bigint;
    beforeEach(async function () {
      disputeId = await suite.dr.connect(suite.operator).createDispute.staticCall(escrowId, BUYER_EVIDENCE_CID);
      await suite.dr.connect(suite.operator).createDispute(escrowId, BUYER_EVIDENCE_CID);
    });

    it("reverts if response window still open", async function () {
      await expect(suite.dr.connect(suite.other).autoResolve(disputeId))
        .to.be.revertedWithCustomError(suite.dr, "ResponseWindowOpen");
    });

    it("auto-refunds 100% to buyer after window expires", async function () {
      const { flusd, dr, esm, other, buyer } = suite;
      await increaseTime(suite.conn, SELLER_RESPONSE_WINDOW + 1n);
      const frozen = (await esm.getEscrow(escrowId)).frozenAmount;
      const before = await flusd.balanceOf(buyer.address);
      await dr.connect(other).autoResolve(disputeId);
      expect(await flusd.balanceOf(buyer.address)).to.equal(before + frozen);
    });

    it("emits DisputeAutoResolved and DisputeResolved", async function () {
      const { dr, other } = suite;
      await increaseTime(suite.conn, SELLER_RESPONSE_WINDOW + 1n);
      await expect(dr.connect(other).autoResolve(disputeId))
        .to.emit(dr, "DisputeAutoResolved").withArgs(disputeId)
        .and.to.emit(dr, "DisputeResolved").withArgs(disputeId, 1n, BPS_DENOMINATOR);
    });

    it("sets outcome to REFUND_BUYER", async function () {
      const { dr, other } = suite;
      await increaseTime(suite.conn, SELLER_RESPONSE_WINDOW + 1n);
      await dr.connect(other).autoResolve(disputeId);
      const dispute = await dr.getDispute(disputeId);
      expect(dispute.outcome).to.equal(1n);
      expect(dispute.refundBps).to.equal(BPS_DENOMINATOR);
    });

    it("reverts if seller already responded", async function () {
      const { dr, operator, other } = suite;
      await dr.connect(operator).respondToDispute(disputeId, SELLER_EVIDENCE_CID);
      await increaseTime(suite.conn, SELLER_RESPONSE_WINDOW + 1n);
      await expect(dr.connect(other).autoResolve(disputeId))
        .to.be.revertedWithCustomError(dr, "InvalidDisputeState");
    });
  });

  describe("Config", function () {
    it("owner can set operator", async function () {
      await suite.dr.connect(suite.owner).setOperator(suite.other.address);
      expect(await suite.dr.operator()).to.equal(suite.other.address);
    });
    it("owner can set admin", async function () {
      await suite.dr.connect(suite.owner).setAdmin(suite.other.address);
      expect(await suite.dr.admin()).to.equal(suite.other.address);
    });
    it("non-owner cannot set operator", async function () {
      await expect(suite.dr.connect(suite.other).setOperator(suite.other.address))
        .to.be.revertedWithCustomError(suite.dr, "OwnableUnauthorizedAccount");
    });
    it("reverts setOperator with zero address", async function () {
      await expect(suite.dr.connect(suite.owner).setOperator(ZeroAddress))
        .to.be.revertedWithCustomError(suite.dr, "ZeroAddress");
    });
  });
});
