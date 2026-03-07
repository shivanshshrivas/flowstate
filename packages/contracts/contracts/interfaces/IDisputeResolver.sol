// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IDisputeResolver {
    enum DisputeState {
        OPEN,         // 0
        RESPONDED,    // 1 (unused — goes straight to UNDER_REVIEW)
        UNDER_REVIEW, // 2
        RESOLVED      // 3
    }

    enum Outcome {
        PENDING,        // 0
        REFUND_BUYER,   // 1
        RELEASE_SELLER, // 2
        SPLIT           // 3
    }

    struct Dispute {
        uint256 escrowId;
        address buyer;
        address seller;
        string buyerEvidenceCid;
        string sellerEvidenceCid;
        DisputeState state;
        Outcome outcome;
        uint16 refundBps;
        uint64 openedAt;
        uint64 respondedAt;
        uint64 resolvedAt;
    }

    event DisputeCreated(uint256 indexed disputeId, uint256 indexed escrowId, address buyer, address seller);
    event DisputeResponded(uint256 indexed disputeId, string sellerEvidenceCid);
    event DisputeUnderReview(uint256 indexed disputeId);
    event DisputeResolved(uint256 indexed disputeId, Outcome outcome, uint16 refundBps);
    event DisputeAutoResolved(uint256 indexed disputeId);

    error DisputeNotFound(uint256 disputeId);
    error InvalidDisputeState(uint256 disputeId, DisputeState current);
    error ResponseWindowOpen(uint256 disputeId, uint64 windowClosesAt);
    error UnauthorizedCaller(address caller);
    error ZeroAddress();
    error InvalidRefundBps(uint16 bps);

    function createDispute(uint256 escrowId, string calldata buyerEvidenceCid) external returns (uint256 disputeId);
    function respondToDispute(uint256 disputeId, string calldata sellerEvidenceCid) external;
    function resolveDispute(uint256 disputeId, Outcome outcome, uint16 refundBps) external;
    function autoResolve(uint256 disputeId) external;
    function getDispute(uint256 disputeId) external view returns (Dispute memory);

    function setOperator(address operator) external;
    function setAdmin(address admin) external;
    function setEscrowStateMachine(address esm) external;
}
