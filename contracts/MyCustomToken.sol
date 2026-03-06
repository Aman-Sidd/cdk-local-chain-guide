// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract MyCustomToken is ERC20, Ownable {
    constructor(
        address initialOwner
    ) ERC20("My Custom Gas Token", "MCT") Ownable(initialOwner) {
        // Mint initial supply to deployer
        _mint(msg.sender, 1_000_000_000 * 10 ** decimals());
    }

    // Allow owner to mint more tokens (e.g. for bridging)
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }
}
