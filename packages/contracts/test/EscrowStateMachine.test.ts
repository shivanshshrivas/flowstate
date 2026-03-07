import { expect } from "chai";
import { ZeroAddress } from "ethers";
import { deployFullSuite, createStandardEscrow, type Suite } from "./helpers/fixtures.js";
import {
  ESCROW_AMOUNT, DEFAULT_PAYOUT_BPS, PLATFORM_FEE_BPS, BPS_DENOMINATOR,
  ORDER_ID_1, ORDER_ID_2, DEFAULT_GRACE_PERIOD, BUYER_EVIDENCE_CID,
} from "./helpers/constants.js";
import { increaseTime } from "./helpers/time.js";

function bpsOf(amount: bigint, bps: number | bigint): bigint {
  return (amount * BigInt(bps)) / BPS_DENOMINATOR;
}

describe("EscrowStateMachine", function () {
  let suite: Suite;

  beforeEach(async function () {
    suite = await deployFullSuite();
  });

  describe("createEscrow", function () {
    it("pulls funds from buyer", async function () {
      const { flusd, esm, operator, buyer, seller, owner } = suite;
      await flusd.connect(owner).mint(buyer.address, ESCROW_AMOUNT);
      await flusd.connect(buyer).approve(await esm.getAddress(), ESCROW_AMOUNT);
      const before = await flusd.balanceOf(buyer.address);
      await esm.connect(operator).createEscrow(ORDER_ID_1, buyer.address, seller.address, await flusd.getAddress(), ESCROW_AMOUNT, DEFAULT_PAYOUT_BPS);
      expect(await flusd.balanceOf(buyer.address)).to.equal(before - ESCROW_AMOUNT);
    });

    it("immediately releases payout[0] (15%) to seller", async function () {
      const { flusd, esm, operator, buyer, seller, owner } = suite;
      await flusd.connect(owner).mint(buyer.address, ESCROW_AMOUNT);
      await flusd.connect(buyer).approve(await esm.getAddress(), ESCROW_AMOUNT);
      const before = await flusd.balanceOf(seller.address);
      await esm.connect(operator).createEscrow(ORDER_ID_1, buyer.address, seller.address, await flusd.getAddress(), ESCROW_AMOUNT, DEFAULT_PAYOUT_BPS);
      expect(await flusd.balanceOf(seller.address)).to.equal(before + bpsOf(ESCROW_AMOUNT, DEFAULT_PAYOUT_BPS[0]));
    });

    it("emits EscrowCreated", async function () {
      const { flusd, esm, operator, buyer, seller, owner } = suite;
      await flusd.connect(owner).mint(buyer.address, ESCROW_AMOUNT);
      await flusd.connect(buyer).approve(await esm.getAddress(), ESCROW_AMOUNT);
      await expect(
        esm.connect(operator).createEscrow(ORDER_ID_1, buyer.address, seller.address, await flusd.getAddress(), ESCROW_AMOUNT, DEFAULT_PAYOUT_BPS),
      ).to.emit(esm, "EscrowCreated").withArgs(0n, ORDER_ID_1, buyer.address, seller.address, await flusd.getAddress(), ESCROW_AMOUNT);
    });

    it("reverts on duplicate orderId", async function () {
      const { flusd, esm, operator, buyer, seller, owner } = suite;
      await flusd.connect(owner).mint(buyer.address, ESCROW_AMOUNT * 2n);
      await flusd.connect(buyer).approve(await esm.getAddress(), ESCROW_AMOUNT * 2n);
      await esm.connect(operator).createEscrow(ORDER_ID_1, buyer.address, seller.address, await flusd.getAddress(), ESCROW_AMOUNT, DEFAULT_PAYOUT_BPS);
      await expect(
        esm.connect(operator).createEscrow(ORDER_ID_1, buyer.address, seller.address, await flusd.getAddress(), ESCROW_AMOUNT, DEFAULT_PAYOUT_BPS),
      ).to.be.revertedWithCustomError(esm, "OrderIdExists");
    });

    it("reverts if payout BPS don't sum to 10_000", async function () {
      const { flusd, esm, operator, buyer, seller, owner } = suite;
      await flusd.connect(owner).mint(buyer.address, ESCROW_AMOUNT);
      await flusd.connect(buyer).approve(await esm.getAddress(), ESCROW_AMOUNT);
      const bad: [number, number, number, number, number] = [1000, 1000, 1000, 1000, 1000];
      await expect(
        esm.connect(operator).createEscrow(ORDER_ID_1, buyer.address, seller.address, await flusd.getAddress(), ESCROW_AMOUNT, bad),
      ).to.be.revertedWithCustomError(esm, "InvalidPayoutBps");
    });

    it("reverts on zero amount", async function () {
      const { flusd, esm, operator, buyer, seller } = suite;
      await expect(
        esm.connect(operator).createEscrow(ORDER_ID_1, buyer.address, seller.address, await flusd.getAddress(), 0n, DEFAULT_PAYOUT_BPS),
      ).to.be.revertedWithCustomError(esm, "ZeroAmount");
    });

    it("reverts on zero buyer address", async function () {
      const { flusd, esm, operator, seller } = suite;
      await expect(
        esm.connect(operator).createEscrow(ORDER_ID_1, ZeroAddress, seller.address, await flusd.getAddress(), ESCROW_AMOUNT, DEFAULT_PAYOUT_BPS),
      ).to.be.revertedWithCustomError(esm, "ZeroAddress");
    });

    it("reverts when called by non-operator", async function () {
      const { flusd, esm, buyer, seller, other } = suite;
      await expect(
        esm.connect(other).createEscrow(ORDER_ID_1, buyer.address, seller.address, await flusd.getAddress(), ESCROW_AMOUNT, DEFAULT_PAYOUT_BPS),
      ).to.be.revertedWithCustomError(esm, "UnauthorizedCaller");
    });

    it("escrow starts in ESCROWED state", async function () {
      const escrowId = await createStandardEscrow(suite);
      expect((await suite.esm.getEscrow(escrowId)).state).to.equal(1n);
    });

    it("getEscrowByOrderId returns correct escrow", async function () {
      await createStandardEscrow(suite);
      expect((await suite.esm.getEscrowByOrderId(ORDER_ID_1)).buyer).to.equal(suite.buyer.address);
    });

    it("escrowCount increments", async function () {
      expect(await suite.esm.escrowCount()).to.equal(0n);
      await createStandardEscrow(suite);
      expect(await suite.esm.escrowCount()).to.equal(1n);
    });
  });

  describe("advanceState", function () {
    let escrowId: bigint;
    beforeEach(async function () { escrowId = await createStandardEscrow(suite); });

    it("ESCROWED→LABEL_CREATED releases payout[1]", async function () {
      const { flusd, esm, operator, seller } = suite;
      const before = await flusd.balanceOf(seller.address);
      await esm.connect(operator).advanceState(escrowId);
      expect(await flusd.balanceOf(seller.address)).to.equal(before + bpsOf(ESCROW_AMOUNT, DEFAULT_PAYOUT_BPS[1]));
      expect((await esm.getEscrow(escrowId)).state).to.equal(2n);
    });

    it("advances through all 4 transitions with correct payouts", async function () {
      const { flusd, esm, operator, seller } = suite;
      const start = await flusd.balanceOf(seller.address);
      for (let i = 0; i < 4; i++) await esm.connect(operator).advanceState(escrowId);
      expect((await esm.getEscrow(escrowId)).state).to.equal(5n); // DELIVERED
      const expected = bpsOf(ESCROW_AMOUNT, DEFAULT_PAYOUT_BPS[1]) + bpsOf(ESCROW_AMOUNT, DEFAULT_PAYOUT_BPS[2]) + bpsOf(ESCROW_AMOUNT, DEFAULT_PAYOUT_BPS[3]);
      expect(await flusd.balanceOf(seller.address)).to.equal(start + expected);
    });

    it("emits StateAdvanced event", async function () {
      const { esm, operator } = suite;
      await expect(esm.connect(operator).advanceState(escrowId))
        .to.emit(esm, "StateAdvanced").withArgs(escrowId, 1n, 2n, bpsOf(ESCROW_AMOUNT, DEFAULT_PAYOUT_BPS[1]));
    });

    it("sets deliveredAt when reaching DELIVERED", async function () {
      const { esm, operator } = suite;
      for (let i = 0; i < 4; i++) await esm.connect(operator).advanceState(escrowId);
      expect((await esm.getEscrow(escrowId)).deliveredAt).to.be.greaterThan(0n);
    });

    it("reverts when advancing from DELIVERED", async function () {
      const { esm, operator } = suite;
      for (let i = 0; i < 4; i++) await esm.connect(operator).advanceState(escrowId);
      await expect(esm.connect(operator).advanceState(escrowId)).to.be.revertedWithCustomError(esm, "InvalidTransition");
    });

    it("reverts for non-existent escrow", async function () {
      await expect(suite.esm.connect(suite.operator).advanceState(999n)).to.be.revertedWithCustomError(suite.esm, "EscrowNotFound");
    });

    it("reverts when called by non-operator", async function () {
      await expect(suite.esm.connect(suite.other).advanceState(escrowId)).to.be.revertedWithCustomError(suite.esm, "UnauthorizedCaller");
    });
  });

  describe("finalize", function () {
    let escrowId: bigint;
    beforeEach(async function () {
      escrowId = await createStandardEscrow(suite);
      for (let i = 0; i < 4; i++) await suite.esm.connect(suite.operator).advanceState(escrowId);
    });

    it("reverts if grace period not elapsed", async function () {
      await expect(suite.esm.connect(suite.operator).finalize(escrowId)).to.be.revertedWithCustomError(suite.esm, "GracePeriodNotElapsed");
    });

    it("releases holdback minus fee after grace period", async function () {
      const { flusd, esm, operator, seller, feeWallet } = suite;
      await increaseTime(suite.conn, DEFAULT_GRACE_PERIOD + 1n);
      const sellerBefore = await flusd.balanceOf(seller.address);
      const feeBefore = await flusd.balanceOf(feeWallet.address);
      await esm.connect(operator).finalize(escrowId);
      const holdback = bpsOf(ESCROW_AMOUNT, DEFAULT_PAYOUT_BPS[4]);
      const fee = bpsOf(holdback, PLATFORM_FEE_BPS);
      expect(await flusd.balanceOf(seller.address)).to.equal(sellerBefore + holdback - fee);
      expect(await flusd.balanceOf(feeWallet.address)).to.equal(feeBefore + fee);
    });

    it("emits EscrowFinalized", async function () {
      const { esm, operator } = suite;
      await increaseTime(suite.conn, DEFAULT_GRACE_PERIOD + 1n);
      const holdback = bpsOf(ESCROW_AMOUNT, DEFAULT_PAYOUT_BPS[4]);
      const fee = bpsOf(holdback, PLATFORM_FEE_BPS);
      await expect(esm.connect(operator).finalize(escrowId)).to.emit(esm, "EscrowFinalized").withArgs(escrowId, holdback - fee, fee);
    });

    it("sets state to FINALIZED", async function () {
      await increaseTime(suite.conn, DEFAULT_GRACE_PERIOD + 1n);
      await suite.esm.connect(suite.operator).finalize(escrowId);
      expect((await suite.esm.getEscrow(escrowId)).state).to.equal(6n);
    });

    it("reverts if not in DELIVERED state", async function () {
      const freshId = await createStandardEscrow(suite, ORDER_ID_2);
      await expect(suite.esm.connect(suite.operator).finalize(freshId)).to.be.revertedWithCustomError(suite.esm, "InvalidState");
    });
  });

  describe("initiateDispute", function () {
    let escrowId: bigint;
    beforeEach(async function () { escrowId = await createStandardEscrow(suite); });

    it("freezes remaining funds and sets DISPUTED", async function () {
      await suite.esm.connect(suite.operator).initiateDispute(escrowId, BUYER_EVIDENCE_CID);
      const escrow = await suite.esm.getEscrow(escrowId);
      expect(escrow.state).to.equal(7n);
      expect(escrow.frozenAmount).to.be.greaterThan(0n);
    });

    it("emits DisputeInitiated", async function () {
      await expect(suite.esm.connect(suite.operator).initiateDispute(escrowId, BUYER_EVIDENCE_CID))
        .to.emit(suite.esm, "DisputeInitiated");
    });

    it("reverts on double dispute", async function () {
      await suite.esm.connect(suite.operator).initiateDispute(escrowId, BUYER_EVIDENCE_CID);
      await expect(suite.esm.connect(suite.operator).initiateDispute(escrowId, BUYER_EVIDENCE_CID))
        .to.be.revertedWithCustomError(suite.esm, "InvalidTransition");
    });

    it("reverts on FINALIZED escrow", async function () {
      for (let i = 0; i < 4; i++) await suite.esm.connect(suite.operator).advanceState(escrowId);
      await increaseTime(suite.conn, DEFAULT_GRACE_PERIOD + 1n);
      await suite.esm.connect(suite.operator).finalize(escrowId);
      await expect(suite.esm.connect(suite.operator).initiateDispute(escrowId, BUYER_EVIDENCE_CID))
        .to.be.revertedWithCustomError(suite.esm, "InvalidTransition");
    });
  });

  describe("executeResolution", function () {
    let escrowId: bigint;
    beforeEach(async function () {
      escrowId = await createStandardEscrow(suite);
      await suite.esm.connect(suite.operator).initiateDispute(escrowId, BUYER_EVIDENCE_CID);
    });

    it("full release to seller (refundBps=0)", async function () {
      const { esm, dr, conn } = suite;
      const drAddr = await dr.getAddress();
      await conn.networkHelpers.setBalance(drAddr, 10n ** 18n);
      const drSigner = await conn.ethers.getImpersonatedSigner(drAddr);
      await esm.connect(drSigner).executeResolution(escrowId, 0);
      expect((await esm.getEscrow(escrowId)).state).to.equal(6n);
    });

    it("50/50 split distributes correctly", async function () {
      const { flusd, esm, dr, buyer, seller, conn } = suite;
      const drAddr = await dr.getAddress();
      await conn.networkHelpers.setBalance(drAddr, 10n ** 18n);
      const drSigner = await conn.ethers.getImpersonatedSigner(drAddr);
      const frozen = (await esm.getEscrow(escrowId)).frozenAmount;
      const buyerBefore = await flusd.balanceOf(buyer.address);
      const sellerBefore = await flusd.balanceOf(seller.address);
      await esm.connect(drSigner).executeResolution(escrowId, 5000);
      const buyerRefund = bpsOf(frozen, 5000);
      const sellerGross = frozen - buyerRefund;
      const fee = bpsOf(sellerGross, PLATFORM_FEE_BPS);
      expect(await flusd.balanceOf(buyer.address)).to.equal(buyerBefore + buyerRefund);
      expect(await flusd.balanceOf(seller.address)).to.equal(sellerBefore + sellerGross - fee);
    });

    it("reverts when called by non-disputeResolver", async function () {
      await expect(suite.esm.connect(suite.other).executeResolution(escrowId, 10_000))
        .to.be.revertedWithCustomError(suite.esm, "UnauthorizedCaller");
    });

    it("reverts on refundBps > 10000", async function () {
      const { esm, dr, conn } = suite;
      const drAddr = await dr.getAddress();
      await conn.networkHelpers.setBalance(drAddr, 10n ** 18n);
      const drSigner = await conn.ethers.getImpersonatedSigner(drAddr);
      await expect(esm.connect(drSigner).executeResolution(escrowId, 10_001))
        .to.be.revertedWithCustomError(esm, "InvalidRefundBps");
    });
  });

  describe("Config & access control", function () {
    it("owner can set operator", async function () {
      const { esm, owner, other } = suite;
      await esm.connect(owner).setOperator(other.address);
      expect(await esm.operator()).to.equal(other.address);
    });
    it("non-owner cannot set operator", async function () {
      await expect(suite.esm.connect(suite.other).setOperator(suite.other.address))
        .to.be.revertedWithCustomError(suite.esm, "OwnableUnauthorizedAccount");
    });
    it("owner can set platform fee bps", async function () {
      await suite.esm.connect(suite.owner).setPlatformFeeBps(500);
      expect(await suite.esm.platformFeeBps()).to.equal(500n);
    });
    it("reverts if fee exceeds 10%", async function () {
      await expect(suite.esm.connect(suite.owner).setPlatformFeeBps(1001))
        .to.be.revertedWithCustomError(suite.esm, "InvalidRefundBps");
    });
    it("owner can pause and unpause", async function () {
      await suite.esm.connect(suite.owner).pause();
      expect(await suite.esm.paused()).to.equal(true);
      await suite.esm.connect(suite.owner).unpause();
      expect(await suite.esm.paused()).to.equal(false);
    });
    it("createEscrow reverts when paused", async function () {
      const { flusd, esm, owner, operator, buyer, seller } = suite;
      await esm.connect(owner).pause();
      await flusd.connect(owner).mint(buyer.address, ESCROW_AMOUNT);
      await flusd.connect(buyer).approve(await esm.getAddress(), ESCROW_AMOUNT);
      await expect(
        esm.connect(operator).createEscrow(ORDER_ID_1, buyer.address, seller.address, await flusd.getAddress(), ESCROW_AMOUNT, DEFAULT_PAYOUT_BPS),
      ).to.be.revertedWithCustomError(esm, "EnforcedPause");
    });
  });
});
