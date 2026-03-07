export const EscrowStateMachineAbi = [
  {
    inputs: [
      { internalType: "address", name: "_token", type: "address" },
      { internalType: "address", name: "_paymentSplitter", type: "address" },
      { internalType: "uint256", name: "_gracePeriod", type: "uint256" },
    ],
    stateMutability: "nonpayable",
    type: "constructor",
  },
  {
    inputs: [
      { internalType: "string", name: "orderId", type: "string" },
      { internalType: "address", name: "seller", type: "address" },
      { internalType: "uint256", name: "amount", type: "uint256" },
    ],
    name: "transferAndEscrow",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "string", name: "orderId", type: "string" },
      { internalType: "uint8", name: "newState", type: "uint8" },
    ],
    name: "advanceState",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "string", name: "orderId", type: "string" },
      { internalType: "string", name: "evidenceCid", type: "string" },
    ],
    name: "initiateDispute",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ internalType: "string", name: "orderId", type: "string" }],
    name: "finalize",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ internalType: "string", name: "orderId", type: "string" }],
    name: "getEscrow",
    outputs: [
      {
        components: [
          { internalType: "address", name: "buyer", type: "address" },
          { internalType: "address", name: "seller", type: "address" },
          { internalType: "uint256", name: "totalAmount", type: "uint256" },
          { internalType: "uint256", name: "remainingAmount", type: "uint256" },
          { internalType: "uint8", name: "state", type: "uint8" },
          { internalType: "uint256", name: "createdAt", type: "uint256" },
          { internalType: "uint256", name: "deliveredAt", type: "uint256" },
        ],
        internalType: "struct EscrowStateMachine.Escrow",
        name: "",
        type: "tuple",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "string", name: "orderId", type: "string" },
      { indexed: false, internalType: "uint8", name: "fromState", type: "uint8" },
      { indexed: false, internalType: "uint8", name: "toState", type: "uint8" },
      { indexed: false, internalType: "uint256", name: "payoutAmount", type: "uint256" },
      { indexed: false, internalType: "uint256", name: "timestamp", type: "uint256" },
    ],
    name: "StateAdvanced",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "string", name: "orderId", type: "string" },
      { indexed: false, internalType: "uint256", name: "amount", type: "uint256" },
      { indexed: false, internalType: "uint256", name: "timestamp", type: "uint256" },
    ],
    name: "EscrowCreated",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "string", name: "orderId", type: "string" },
      { indexed: false, internalType: "string", name: "evidenceCid", type: "string" },
      { indexed: false, internalType: "uint256", name: "timestamp", type: "uint256" },
    ],
    name: "DisputeInitiated",
    type: "event",
  },
] as const;
