# FlowState Contracts

XRPL EVM smart contracts for the FlowState escrow flow live here.

## Contracts

- `FLUSD.sol` - mock stablecoin used for local demos and testnet flows
- `EscrowStateMachine.sol` - order escrow lifecycle and payout release logic
- `DisputeResolver.sol` - dispute creation, response, and resolution

## Prerequisites

- Node.js 20+
- XRPL EVM testnet wallet with XRP for gas
- Values copied into `.env` from `.env.example`

## Setup

```bash
cd packages/contracts
copy .env.example .env
npm install
```

## Common Commands

```bash
npm run build
npm test
npm run deploy:testnet
npm run seed:testnet
npm run demo:testnet
```

## Required Environment Variables

- `XRPL_EVM_RPC` - RPC endpoint, default is XRPL EVM testnet
- `DEPLOYER_PRIVATE_KEY` - deployer wallet private key
- `BUYER_WALLET` - recipient for seeded FLUSD
- `SELLER_WALLET` - recipient for seeded FLUSD
- `FLUSD_ADDRESS` - required by the seed and demo scripts after deployment
- `ESM_ADDRESS` - required by the demo flow script

## Notes

- The contract suite models the target payout flow more closely than the backend mock bridge does today.
- The backend currently uses stub blockchain and Pinata bridges, so on-chain settlement is not yet wired into the API server.
