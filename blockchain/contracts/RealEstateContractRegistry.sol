// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title RealEstateContractRegistry
 * @dev Stores minimal tamper-proof verification proofs for real estate contracts.
 *      Strictly follows Split Hybrid Storage rules: NEVER store raw text, names, or PII.
 */
contract RealEstateContractRegistry {
    struct ContractRecord {
        bytes32 documentHash;   // SHA-256 hash of the finalized PDF
        bytes signatureProof;   // Combined or authorized signature proof
        uint256 timestamp;      // Block timestamp at registration
        address registeredBy;   // Relayer / signer address
        bool exists;
    }

    // contractId string (UUID/Identifier) -> ContractRecord
    mapping(string => ContractRecord) private _records;

    event ContractRegistered(
        string indexed contractId,
        bytes32 indexed documentHash,
        address indexed registeredBy,
        uint256 timestamp
    );

    error ContractAlreadyRegistered(string contractId);
    error ContractNotFound(string contractId);
    error InvalidHash();

    /**
     * @notice Registers a contract hash proof on-chain.
     * @param contractId Unique string identifier of the contract (off-chain reference).
     * @param documentHash SHA-256 byte digest (bytes32) of the finalized PDF document.
     * @param signatureProof Off-chain cryptographic signature proof buffer.
     */
    function registerContract(
        string calldata contractId,
        bytes32 documentHash,
        bytes calldata signatureProof
    ) external {
        if (documentHash == bytes32(0)) revert InvalidHash();
        if (_records[contractId].exists) revert ContractAlreadyRegistered(contractId);

        _records[contractId] = ContractRecord({
            documentHash: documentHash,
            signatureProof: signatureProof,
            timestamp: block.timestamp,
            registeredBy: msg.sender,
            exists: true
        });

        emit ContractRegistered(contractId, documentHash, msg.sender, block.timestamp);
    }

    /**
     * @notice Verifies whether a given documentHash matches the recorded hash on-chain.
     * @param contractId Unique string identifier.
     * @param documentHash SHA-256 byte digest to compare.
     * @return isValid True if record exists and hash matches exactly.
     * @return timestamp The on-chain recorded timestamp.
     * @return registeredBy The relayer address that registered the record.
     */
    function verifyContract(
        string calldata contractId,
        bytes32 documentHash
    ) external view returns (bool isValid, uint256 timestamp, address registeredBy) {
        ContractRecord memory record = _records[contractId];
        if (!record.exists) {
            return (false, 0, address(0));
        }
        return (record.documentHash == documentHash, record.timestamp, record.registeredBy);
    }

    /**
     * @notice Retrieves the raw recorded proof for a contract.
     * @param contractId Unique string identifier.
     */
    function getContractProof(
        string calldata contractId
    ) external view returns (
        bytes32 documentHash,
        bytes memory signatureProof,
        uint256 timestamp,
        address registeredBy
    ) {
        ContractRecord memory record = _records[contractId];
        if (!record.exists) revert ContractNotFound(contractId);
        return (record.documentHash, record.signatureProof, record.timestamp, record.registeredBy);
    }
}

