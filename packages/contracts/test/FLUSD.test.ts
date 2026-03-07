import { expect } from "chai";
import { network } from "hardhat";
import type { FLUSD } from "../typechain-types/index.js";
import { FAUCET_AMOUNT, FAUCET_COOLDOWN, DECIMALS } from "./helpers/constants.js";
import { increaseTime } from "./helpers/time.js";

describe("FLUSD", function () {
  let flusd: FLUSD;
  let owner: any, alice: any, bob: any;
  let conn: Awaited<ReturnType<typeof network.connect>>;

  beforeEach(async function () {
    conn = await network.connect();
    const { ethers } = conn;
    [owner, alice, bob] = await ethers.getSigners();
    flusd = await ethers.deployContract("FLUSD", [owner.address]) as unknown as FLUSD;
    await flusd.waitForDeployment();
  });

  describe("Metadata", function () {
    it("name is 'Flow USD'", async function () {
      expect(await flusd.name()).to.equal("Flow USD");
    });
    it("symbol is 'FLUSD'", async function () {
      expect(await flusd.symbol()).to.equal("FLUSD");
    });
    it("has 6 decimals", async function () {
      expect(await flusd.decimals()).to.equal(DECIMALS);
    });
    it("starts with zero total supply", async function () {
      expect(await flusd.totalSupply()).to.equal(0n);
    });
  });

  describe("mint (owner only)", function () {
    it("owner can mint to any address", async function () {
      await flusd.connect(owner).mint(alice.address, 1_000n * 10n ** 6n);
      expect(await flusd.balanceOf(alice.address)).to.equal(1_000n * 10n ** 6n);
    });
    it("non-owner cannot mint", async function () {
      await expect(flusd.connect(alice).mint(alice.address, 1n))
        .to.be.revertedWithCustomError(flusd, "OwnableUnauthorizedAccount")
        .withArgs(alice.address);
    });
    it("mint increases totalSupply", async function () {
      await flusd.connect(owner).mint(alice.address, 500n * 10n ** 6n);
      expect(await flusd.totalSupply()).to.equal(500n * 10n ** 6n);
    });
    it("mint accumulates across recipients", async function () {
      await flusd.connect(owner).mint(alice.address, 100n * 10n ** 6n);
      await flusd.connect(owner).mint(bob.address, 200n * 10n ** 6n);
      expect(await flusd.totalSupply()).to.equal(300n * 10n ** 6n);
    });
  });

  describe("faucet", function () {
    it("mints FAUCET_AMOUNT to caller", async function () {
      await flusd.connect(alice).faucet();
      expect(await flusd.balanceOf(alice.address)).to.equal(FAUCET_AMOUNT);
    });
    it("different users can each use the faucet", async function () {
      await flusd.connect(alice).faucet();
      await flusd.connect(bob).faucet();
      expect(await flusd.balanceOf(alice.address)).to.equal(FAUCET_AMOUNT);
      expect(await flusd.balanceOf(bob.address)).to.equal(FAUCET_AMOUNT);
    });
    it("reverts within cooldown period", async function () {
      await flusd.connect(alice).faucet();
      await expect(flusd.connect(alice).faucet())
        .to.be.revertedWithCustomError(flusd, "FaucetCooldown");
    });
    it("allows second claim after cooldown", async function () {
      await flusd.connect(alice).faucet();
      await increaseTime(conn, FAUCET_COOLDOWN + 1n);
      await flusd.connect(alice).faucet();
      expect(await flusd.balanceOf(alice.address)).to.equal(FAUCET_AMOUNT * 2n);
    });
  });

  describe("ERC-20 operations", function () {
    beforeEach(async function () {
      await flusd.connect(owner).mint(alice.address, 1_000n * 10n ** 6n);
    });
    it("transfer works correctly", async function () {
      await flusd.connect(alice).transfer(bob.address, 100n * 10n ** 6n);
      expect(await flusd.balanceOf(alice.address)).to.equal(900n * 10n ** 6n);
      expect(await flusd.balanceOf(bob.address)).to.equal(100n * 10n ** 6n);
    });
    it("approve and transferFrom work", async function () {
      await flusd.connect(alice).approve(bob.address, 200n * 10n ** 6n);
      await flusd.connect(bob).transferFrom(alice.address, bob.address, 200n * 10n ** 6n);
      expect(await flusd.balanceOf(bob.address)).to.equal(200n * 10n ** 6n);
    });
    it("reverts on insufficient balance", async function () {
      await expect(flusd.connect(alice).transfer(bob.address, 2_000n * 10n ** 6n))
        .to.be.revertedWithCustomError(flusd, "ERC20InsufficientBalance");
    });
  });
});
