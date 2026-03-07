// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IEscrowStateMachine {
    enum State {
        INITIATED,     // 0
        ESCROWED,      // 1
        LABEL_CREATED, // 2
        SHIPPED,       // 3
        IN_TRANSIT,    // 4
        DELIVERED,     // 5
        FINALIZED,     // 6
        DISPUTED       // 7
    }

    struct Escrow {
        bytes32 orderId;
        address buyer;
        address seller;
        address token;
        uint128 totalAmount;
        uint128 releasedAmount;
        uint128 frozenAmount;
        uint64 deliveredAt;
        uint64 gracePeriod;
        State state;
        uint16[5] payoutBps;
    }

    event EscrowCreated(
        uint256 indexed escrowId,
        bytes32 indexed orderId,
        address indexed buyer,
        address seller,
        address token,
        uint128 amount
    );
    event StateAdvanced(uint256 indexed escrowId, State indexed from, State indexed to, uint128 released);
    event EscrowFinalized(uint256 indexed escrowId, uint128 sellerAmount, uint128 feeAmount);
    event DisputeInitiated(uint256 indexed escrowId, uint128 frozenAmount, string evidenceCid);
    event ResolutionExecuted(uint256 indexed escrowId, uint128 buyerRefund, uint128 sellerRelease, uint128 feeAmount);

    error InvalidState(uint256 escrowId, State current, State required);
    error InvalidTransition(uint256 escrowId, State current);
    error GracePeriodNotElapsed(uint256 escrowId, uint64 availableAt);
    error UnauthorizedCaller(address caller);
    error ZeroAddress();
    error ZeroAmount();
    error InvalidPayoutBps(uint16[5] bps, uint256 sum);
    error InvalidRefundBps(uint16 bps);
    error OrderIdExists(bytes32 orderId);
    error EscrowNotFound(uint256 escrowId);
    error OrderNotFound(bytes32 orderId);

    function createEscrow(
        bytes32 orderId,
        address buyer,
        address seller,
        address token,
        uint128 amount,
        uint16[5] calldata payoutBps
    ) external returns (uint256 escrowId);

    function advanceState(uint256 escrowId) external;
    function initiateDispute(uint256 escrowId, string calldata evidenceCid) external;
    function finalize(uint256 escrowId) external;
    function executeResolution(uint256 escrowId, uint16 refundBps) external;

    function getEscrow(uint256 escrowId) external view returns (Escrow memory);
    function getEscrowByOrderId(bytes32 orderId) external view returns (Escrow memory);

    function setOperator(address operator) external;
    function setDisputeResolver(address resolver) external;
    function setPlatformFeeWallet(address wallet) external;
    function setPlatformFeeBps(uint16 bps) external;
    function setDefaultGracePeriod(uint64 seconds_) external;
}
