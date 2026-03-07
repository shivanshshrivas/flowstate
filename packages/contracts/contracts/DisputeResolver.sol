// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./interfaces/IDisputeResolver.sol";
import "./interfaces/IEscrowStateMachine.sol";

/// @title DisputeResolver
/// @notice Manages dispute lifecycle for FlowState escrows.
///         Seller has 72h to respond; if no response, anyone can call autoResolve for a full buyer refund.
contract DisputeResolver is IDisputeResolver, Ownable {
    uint64 public constant SELLER_RESPONSE_WINDOW = 72 hours;
    uint16 public constant BPS_DENOMINATOR = 10_000;

    address public operator;
    address public admin;
    IEscrowStateMachine public escrowStateMachine;

    uint256 private _nextDisputeId;
    mapping(uint256 => Dispute) private _disputes;
    mapping(uint256 => uint256) private _escrowToDisputeId;
    mapping(uint256 => bool) private _escrowHasDispute;

    error EscrowAlreadyDisputed(uint256 escrowId);

    modifier onlyOperator() {
        if (msg.sender != operator) revert UnauthorizedCaller(msg.sender);
        _;
    }

    modifier onlyAdmin() {
        if (msg.sender != admin) revert UnauthorizedCaller(msg.sender);
        _;
    }

    modifier disputeExists(uint256 disputeId) {
        if (disputeId >= _nextDisputeId) revert DisputeNotFound(disputeId);
        _;
    }

    constructor(
        address initialOwner,
        address _operator,
        address _admin,
        address _escrowStateMachine
    ) Ownable(initialOwner) {
        if (_operator == address(0) || _admin == address(0) || _escrowStateMachine == address(0))
            revert ZeroAddress();
        operator = _operator;
        admin = _admin;
        escrowStateMachine = IEscrowStateMachine(_escrowStateMachine);
    }

    function createDispute(uint256 escrowId, string calldata buyerEvidenceCid)
        external
        onlyOperator
        returns (uint256 disputeId)
    {
        if (_escrowHasDispute[escrowId]) revert EscrowAlreadyDisputed(escrowId);

        IEscrowStateMachine.Escrow memory escrow = escrowStateMachine.getEscrow(escrowId);

        // Freeze funds in ESM
        escrowStateMachine.initiateDispute(escrowId, buyerEvidenceCid);

        disputeId = _nextDisputeId++;
        _disputes[disputeId] = Dispute({
            escrowId: escrowId,
            buyer: escrow.buyer,
            seller: escrow.seller,
            buyerEvidenceCid: buyerEvidenceCid,
            sellerEvidenceCid: "",
            state: DisputeState.OPEN,
            outcome: Outcome.PENDING,
            refundBps: 0,
            openedAt: uint64(block.timestamp),
            respondedAt: 0,
            resolvedAt: 0
        });
        _escrowToDisputeId[escrowId] = disputeId;
        _escrowHasDispute[escrowId] = true;

        emit DisputeCreated(disputeId, escrowId, escrow.buyer, escrow.seller);
    }

    function respondToDispute(uint256 disputeId, string calldata sellerEvidenceCid)
        external
        onlyOperator
        disputeExists(disputeId)
    {
        Dispute storage dispute = _disputes[disputeId];
        if (dispute.state != DisputeState.OPEN) revert InvalidDisputeState(disputeId, dispute.state);

        dispute.sellerEvidenceCid = sellerEvidenceCid;
        dispute.respondedAt = uint64(block.timestamp);
        dispute.state = DisputeState.UNDER_REVIEW;

        emit DisputeResponded(disputeId, sellerEvidenceCid);
        emit DisputeUnderReview(disputeId);
    }

    function resolveDispute(uint256 disputeId, Outcome outcome, uint16 refundBps)
        external
        onlyAdmin
        disputeExists(disputeId)
    {
        Dispute storage dispute = _disputes[disputeId];
        if (dispute.state == DisputeState.RESOLVED) revert InvalidDisputeState(disputeId, dispute.state);
        if (outcome == Outcome.PENDING) revert InvalidDisputeState(disputeId, dispute.state);
        if (refundBps > BPS_DENOMINATOR) revert InvalidRefundBps(refundBps);

        uint16 executedBps = _outcomeToRefundBps(outcome, refundBps);

        dispute.state = DisputeState.RESOLVED;
        dispute.outcome = outcome;
        dispute.refundBps = executedBps;
        dispute.resolvedAt = uint64(block.timestamp);

        escrowStateMachine.executeResolution(dispute.escrowId, executedBps);

        emit DisputeResolved(disputeId, outcome, executedBps);
    }

    function autoResolve(uint256 disputeId) external disputeExists(disputeId) {
        Dispute storage dispute = _disputes[disputeId];
        if (dispute.state != DisputeState.OPEN) revert InvalidDisputeState(disputeId, dispute.state);

        uint64 windowClosesAt = dispute.openedAt + SELLER_RESPONSE_WINDOW;
        if (uint64(block.timestamp) < windowClosesAt) revert ResponseWindowOpen(disputeId, windowClosesAt);

        dispute.state = DisputeState.RESOLVED;
        dispute.outcome = Outcome.REFUND_BUYER;
        dispute.refundBps = BPS_DENOMINATOR;
        dispute.resolvedAt = uint64(block.timestamp);

        escrowStateMachine.executeResolution(dispute.escrowId, BPS_DENOMINATOR);

        emit DisputeAutoResolved(disputeId);
        emit DisputeResolved(disputeId, Outcome.REFUND_BUYER, BPS_DENOMINATOR);
    }

    function getDispute(uint256 disputeId) external view disputeExists(disputeId) returns (Dispute memory) {
        return _disputes[disputeId];
    }

    function getDisputeIdByEscrowId(uint256 escrowId) external view returns (uint256) {
        if (!_escrowHasDispute[escrowId]) revert DisputeNotFound(escrowId);
        return _escrowToDisputeId[escrowId];
    }

    function disputeCount() external view returns (uint256) {
        return _nextDisputeId;
    }

    function setOperator(address _operator) external onlyOwner {
        if (_operator == address(0)) revert ZeroAddress();
        operator = _operator;
    }

    function setAdmin(address _admin) external onlyOwner {
        if (_admin == address(0)) revert ZeroAddress();
        admin = _admin;
    }

    function setEscrowStateMachine(address esm) external onlyOwner {
        if (esm == address(0)) revert ZeroAddress();
        escrowStateMachine = IEscrowStateMachine(esm);
    }

    function _outcomeToRefundBps(Outcome outcome, uint16 refundBps) internal pure returns (uint16) {
        if (outcome == Outcome.REFUND_BUYER) return BPS_DENOMINATOR;
        if (outcome == Outcome.RELEASE_SELLER) return 0;
        return refundBps;
    }
}
