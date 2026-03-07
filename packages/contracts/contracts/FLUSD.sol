// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @title FLUSD — Flow USD mock stablecoin (testnet only)
/// @notice 6-decimal ERC-20 with a public faucet and owner-controlled minting.
///         Intended to simulate RLUSD on the XRPL EVM Sidechain Testnet.
contract FLUSD is ERC20, Ownable {
    uint256 public constant FAUCET_AMOUNT = 50_000 * 10 ** 6; // 50,000 FLUSD
    uint256 public constant FAUCET_COOLDOWN = 1 hours;

    error FaucetCooldown(uint256 availableAt);

    mapping(address => uint256) public lastFaucet;

    constructor(address initialOwner) ERC20("Flow USD", "FLUSD") Ownable(initialOwner) {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    /// @notice Mints 50,000 FLUSD to the caller. 1-hour cooldown per address.
    function faucet() external {
        uint256 available = lastFaucet[msg.sender] + FAUCET_COOLDOWN;
        if (block.timestamp < available) revert FaucetCooldown(available);
        lastFaucet[msg.sender] = block.timestamp;
        _mint(msg.sender, FAUCET_AMOUNT);
    }

    /// @notice Owner-only minting for seeding test environments.
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }
}
