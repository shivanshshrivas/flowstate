// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./interfaces/IEscrowStateMachine.sol";

/// @title EscrowStateMachine
/// @notice Core FlowState escrow contract with 7-state FSM and integrated payment splitting.
///
/// State flow:
///   ESCROWED(1) → LABEL_CREATED(2) → SHIPPED(3) → IN_TRANSIT(4) → DELIVERED(5) → FINALIZED(6)
///                                                                        ↕
///                                                                   DISPUTED(7)
///
/// Default payout schedule (basis points, sum = 10_000):
///   [0] ESCROWED→LABEL_CREATED  : 1500 (15%) — released immediately on createEscrow
///   [1] LABEL_CREATED→SHIPPED   : 1500 (15%)
///   [2] SHIPPED→IN_TRANSIT      : 2000 (20%)
///   [3] IN_TRANSIT→DELIVERED    : 3500 (35%)
///   [4] DELIVERED→FINALIZED     : 1500 (15%, holdback) — platform fee deducted here
contract EscrowStateMachine is IEscrowStateMachine, ReentrancyGuard, Pausable, Ownable {
    using SafeERC20 for IERC20;

    uint16 public constant BPS_DENOMINATOR = 10_000;
    uint16 public constant MAX_PLATFORM_FEE_BPS = 1_000; // 10% cap
    uint64 public constant MIN_GRACE_PERIOD = 1 days;
    uint64 public constant MAX_GRACE_PERIOD = 30 days;

    address public operator;
    address public disputeResolver;
    address public platformFeeWallet;
    uint16 public platformFeeBps = 250; // 2.5%
    uint64 public defaultGracePeriod = 3 days;

    uint256 private _nextEscrowId;
    mapping(uint256 => Escrow) private _escrows;
    mapping(bytes32 => uint256) private _orderIdToEscrowId;
    mapping(bytes32 => bool) private _orderIdExists;

    modifier onlyOperator() {
        if (msg.sender != operator) revert UnauthorizedCaller(msg.sender);
        _;
    }

    modifier onlyDisputeResolver() {
        if (msg.sender != disputeResolver) revert UnauthorizedCaller(msg.sender);
        _;
    }

    modifier escrowExists(uint256 escrowId) {
        if (escrowId >= _nextEscrowId) revert EscrowNotFound(escrowId);
        _;
    }

    constructor(
        address initialOwner,
        address _operator,
        address _platformFeeWallet
    ) Ownable(initialOwner) {
        if (_operator == address(0)) revert ZeroAddress();
        if (_platformFeeWallet == address(0)) revert ZeroAddress();
        operator = _operator;
        platformFeeWallet = _platformFeeWallet;
    }

    // ─── Core ────────────────────────────────────────────────────────────────

    function createEscrow(
        bytes32 orderId,
        address buyer,
        address seller,
        address token,
        uint128 amount,
        uint16[5] calldata payoutBps
    ) external onlyOperator whenNotPaused nonReentrant returns (uint256 escrowId) {
        if (buyer == address(0) || seller == address(0) || token == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        if (_orderIdExists[orderId]) revert OrderIdExists(orderId);

        uint256 bpsSum;
        for (uint256 i; i < 5; ++i) bpsSum += payoutBps[i];
        if (bpsSum != BPS_DENOMINATOR) revert InvalidPayoutBps(payoutBps, bpsSum);

        escrowId = _nextEscrowId++;
        _escrows[escrowId] = Escrow({
            orderId: orderId,
            buyer: buyer,
            seller: seller,
            token: token,
            totalAmount: amount,
            releasedAmount: 0,
            frozenAmount: 0,
            deliveredAt: 0,
            gracePeriod: defaultGracePeriod,
            state: State.ESCROWED,
            payoutBps: payoutBps
        });
        _orderIdToEscrowId[orderId] = escrowId;
        _orderIdExists[orderId] = true;

        IERC20(token).safeTransferFrom(buyer, address(this), amount);
        emit EscrowCreated(escrowId, orderId, buyer, seller, token, amount);

        // Release payout[0] (15%) immediately to seller
        _releasePartial(escrowId, 0);
    }

    function advanceState(uint256 escrowId)
        external
        onlyOperator
        whenNotPaused
        nonReentrant
        escrowExists(escrowId)
    {
        Escrow storage escrow = _escrows[escrowId];
        State current = escrow.state;

        if (
            current == State.INITIATED ||
            current == State.DELIVERED ||
            current == State.FINALIZED ||
            current == State.DISPUTED
        ) revert InvalidTransition(escrowId, current);

        State next = State(uint8(current) + 1);
        escrow.state = next;

        // payout[0] was released on createEscrow.
        // Each advanceState releases payout[current]:
        //   ESCROWED(1)→LABEL_CREATED : payout[1] (15%)
        //   LABEL_CREATED(2)→SHIPPED  : payout[2] (20%)
        //   SHIPPED(3)→IN_TRANSIT     : payout[3] (35%)
        //   IN_TRANSIT(4)→DELIVERED   : no payout (payout[4] is holdback, released at finalize)
        uint128 payout = 0;
        if (current != State.IN_TRANSIT) {
            payout = _releasePartial(escrowId, uint8(current));
        }

        if (next == State.DELIVERED) {
            escrow.deliveredAt = uint64(block.timestamp);
        }

        emit StateAdvanced(escrowId, current, next, payout);
    }

    function finalize(uint256 escrowId)
        external
        onlyOperator
        whenNotPaused
        nonReentrant
        escrowExists(escrowId)
    {
        Escrow storage escrow = _escrows[escrowId];
        if (escrow.state != State.DELIVERED) revert InvalidState(escrowId, escrow.state, State.DELIVERED);

        uint64 availableAt = escrow.deliveredAt + escrow.gracePeriod;
        if (uint64(block.timestamp) < availableAt) revert GracePeriodNotElapsed(escrowId, availableAt);

        escrow.state = State.FINALIZED;

        uint128 holdback = _bpsOf(escrow.totalAmount, escrow.payoutBps[4]);
        uint128 fee = _bpsOf(holdback, platformFeeBps);
        uint128 sellerAmount = holdback - fee;
        escrow.releasedAmount += holdback;

        IERC20(escrow.token).safeTransfer(escrow.seller, sellerAmount);
        if (fee > 0) IERC20(escrow.token).safeTransfer(platformFeeWallet, fee);

        emit EscrowFinalized(escrowId, sellerAmount, fee);
    }

    function initiateDispute(uint256 escrowId, string calldata evidenceCid)
        external
        whenNotPaused
        nonReentrant
        escrowExists(escrowId)
    {
        // Allow operator (direct call) or disputeResolver (called via DisputeResolver.createDispute)
        if (msg.sender != operator && msg.sender != disputeResolver) revert UnauthorizedCaller(msg.sender);

        Escrow storage escrow = _escrows[escrowId];
        State current = escrow.state;

        if (
            current == State.INITIATED ||
            current == State.FINALIZED ||
            current == State.DISPUTED
        ) revert InvalidTransition(escrowId, current);

        uint128 frozen = escrow.totalAmount - escrow.releasedAmount;
        escrow.frozenAmount = frozen;
        escrow.state = State.DISPUTED;

        emit DisputeInitiated(escrowId, frozen, evidenceCid);
    }

    function executeResolution(uint256 escrowId, uint16 refundBps)
        external
        onlyDisputeResolver
        nonReentrant
        escrowExists(escrowId)
    {
        if (refundBps > BPS_DENOMINATOR) revert InvalidRefundBps(refundBps);

        Escrow storage escrow = _escrows[escrowId];
        if (escrow.state != State.DISPUTED) revert InvalidState(escrowId, escrow.state, State.DISPUTED);

        escrow.state = State.FINALIZED;

        uint128 frozen = escrow.frozenAmount;
        escrow.frozenAmount = 0;

        uint128 buyerRefund = _bpsOf(frozen, refundBps);
        uint128 sellerGross = frozen - buyerRefund;
        uint128 fee = _bpsOf(sellerGross, platformFeeBps);
        uint128 sellerNet = sellerGross - fee;

        escrow.releasedAmount += frozen;

        if (buyerRefund > 0) IERC20(escrow.token).safeTransfer(escrow.buyer, buyerRefund);
        if (sellerNet > 0) IERC20(escrow.token).safeTransfer(escrow.seller, sellerNet);
        if (fee > 0) IERC20(escrow.token).safeTransfer(platformFeeWallet, fee);

        emit ResolutionExecuted(escrowId, buyerRefund, sellerNet, fee);
    }

    // ─── Views ───────────────────────────────────────────────────────────────

    function getEscrow(uint256 escrowId) external view escrowExists(escrowId) returns (Escrow memory) {
        return _escrows[escrowId];
    }

    function getEscrowByOrderId(bytes32 orderId) external view returns (Escrow memory) {
        if (!_orderIdExists[orderId]) revert OrderNotFound(orderId);
        return _escrows[_orderIdToEscrowId[orderId]];
    }

    function getEscrowIdByOrderId(bytes32 orderId) external view returns (uint256) {
        if (!_orderIdExists[orderId]) revert OrderNotFound(orderId);
        return _orderIdToEscrowId[orderId];
    }

    function escrowCount() external view returns (uint256) {
        return _nextEscrowId;
    }

    // ─── Config (owner) ──────────────────────────────────────────────────────

    function setOperator(address _operator) external onlyOwner {
        if (_operator == address(0)) revert ZeroAddress();
        operator = _operator;
    }

    function setDisputeResolver(address resolver) external onlyOwner {
        if (resolver == address(0)) revert ZeroAddress();
        disputeResolver = resolver;
    }

    function setPlatformFeeWallet(address wallet) external onlyOwner {
        if (wallet == address(0)) revert ZeroAddress();
        platformFeeWallet = wallet;
    }

    function setPlatformFeeBps(uint16 bps) external onlyOwner {
        if (bps > MAX_PLATFORM_FEE_BPS) revert InvalidRefundBps(bps);
        platformFeeBps = bps;
    }

    function setDefaultGracePeriod(uint64 seconds_) external onlyOwner {
        if (seconds_ < MIN_GRACE_PERIOD || seconds_ > MAX_GRACE_PERIOD) revert ZeroAmount();
        defaultGracePeriod = seconds_;
    }

    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }

    // ─── Internal ────────────────────────────────────────────────────────────

    function _releasePartial(uint256 escrowId, uint8 payoutIdx) internal returns (uint128 payout) {
        Escrow storage escrow = _escrows[escrowId];
        payout = _bpsOf(escrow.totalAmount, escrow.payoutBps[payoutIdx]);
        if (payout == 0) return 0;
        escrow.releasedAmount += payout;
        IERC20(escrow.token).safeTransfer(escrow.seller, payout);
    }

    function _bpsOf(uint128 amount, uint16 bps) internal pure returns (uint128) {
        return uint128((uint256(amount) * bps) / BPS_DENOMINATOR);
    }
}
