import { ethers } from "ethers";
import { config } from "./config.js";

// Minimal ABI strictly matching RealEstateContractRegistry.sol
const REGISTRY_ABI = [
  "function registerContract(string calldata contractId, bytes32 documentHash, bytes calldata signatureProof) external",
  "function verifyContract(string calldata contractId, bytes32 documentHash) external view returns (bool isValid, uint256 timestamp, address registeredBy)",
  "function getContractProof(string calldata contractId) external view returns (bytes32 documentHash, bytes memory signatureProof, uint256 timestamp, address registeredBy)",
  "event ContractRegistered(string indexed contractId, bytes32 indexed documentHash, address indexed registeredBy, uint256 timestamp)"
];

let provider;
let relayerWallet;
let contract;

export function initWeb3() {
  try {
    provider = new ethers.JsonRpcProvider(config.geth.rpcUrl);
    relayerWallet = new ethers.Wallet(config.geth.relayerPrivateKey, provider);

    if (config.geth.contractAddress) {
      contract = new ethers.Contract(config.geth.contractAddress, REGISTRY_ABI, relayerWallet);
      console.log("[Web3] Relayer initialized. Signer:", relayerWallet.address);
      console.log("[Web3] Target Contract:", config.geth.contractAddress);
    } else {
      console.warn("[Web3] Warning: CONTRACT_ADDRESS is not set. On-chain calls will be unavailable.");
    }
  } catch (error) {
    console.error("[Web3] Initialization error:", error.message);
  }
}

/**
 * Registers contract hash and signature proof to Geth private network.
 * Server pays gas fees on behalf of users (Relayer pattern).
 */
export async function registerContractOnChain(contractId, documentHashHex, signatureProofBytes) {
  if (!contract) {
    throw new Error("Smart contract is not initialized. Please verify CONTRACT_ADDRESS in .env");
  }

  // Ensure 32-byte hex string
  const formattedHash = documentHashHex.startsWith("0x") ? documentHashHex : `0x${documentHashHex}`;
  const formattedProof = signatureProofBytes
    ? (ethers.isBytesLike(signatureProofBytes) ? signatureProofBytes : ethers.toUtf8Bytes(signatureProofBytes))
    : ethers.toUtf8Bytes("SIGNATURE_PROOF_DEFAULT");

  console.log(`[Web3 Relayer] Submitting registerContract: ID=${contractId}, Hash=${formattedHash}`);

  const tx = await contract.registerContract(contractId, formattedHash, formattedProof);
  const receipt = await tx.wait();

  return {
    txHash: receipt.hash,
    blockNumber: receipt.blockNumber,
    gasUsed: receipt.gasUsed.toString()
  };
}

/**
 * Queries Geth on-chain state to verify document hash integrity.
 */
export async function verifyContractOnChain(contractId, documentHashHex) {
  if (!contract) {
    throw new Error("Smart contract is not initialized. Please verify CONTRACT_ADDRESS in .env");
  }

  const formattedHash = documentHashHex.startsWith("0x") ? documentHashHex : `0x${documentHashHex}`;
  const [isValid, timestamp, registeredBy] = await contract.verifyContract(contractId, formattedHash);

  return {
    isValid,
    timestamp: Number(timestamp),
    registeredBy
  };
}

