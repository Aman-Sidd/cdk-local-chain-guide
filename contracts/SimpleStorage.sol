// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title  SimpleStorage
 * @notice Store and retrieve a uint256 value on the CDK L2 chain.
 *         Intentionally minimal — one contract, two functions, one event.
 *         Perfect for verifying a new chain is alive and accepting txs.
 */
contract SimpleStorage {
    uint256 public value;
    address public lastSetter;

    event ValueSet(address indexed by, uint256 newValue, uint256 blockNumber);

    constructor(uint256 _initial) {
        value = _initial;
        lastSetter = msg.sender;
    }

    /// @notice Store a new value
    function set(uint256 _value) external {
        value = _value;
        lastSetter = msg.sender;
        emit ValueSet(msg.sender, _value, block.number);
    }

    /// @notice Return the current value (explicit getter for clarity)
    function get() external view returns (uint256) {
        return value;
    }
}
