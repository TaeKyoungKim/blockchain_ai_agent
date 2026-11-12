import { expect } from "chai";
import hre from "hardhat";

describe("RealEstateContractRegistry (Pure JS Unit Tests)", function () {
  let registry;
  let relayer;
  let otherAccount;

  beforeEach(async function () {
    [relayer, otherAccount] = await hre.ethers.getSigners();
    const RegistryFactory = await hre.ethers.getContractFactory("RealEstateContractRegistry");
    registry = await RegistryFactory.deploy();
    await registry.waitForDeployment();
  });

  it("should successfully register and verify a valid contract hash", async function () {
    const contractId = "contract-uuid-1001";
    // Dummy 32-byte SHA-256 hash
    const documentHash = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("Mock PDF Raw Buffer Content"));
    const signatureProof = hre.ethers.toUtf8Bytes("MockSignatureProof_Base64_Or_Bytes");

    // Register
    const tx = await registry.registerContract(contractId, documentHash, signatureProof);
    await tx.wait();

    // Verify
    const [isValid, timestamp, registeredBy] = await registry.verifyContract(contractId, documentHash);
    expect(isValid).to.equal(true);
    expect(timestamp).to.be.greaterThan(0);
    expect(registeredBy).to.equal(relayer.address);

    // Get Proof
    const proof = await registry.getContractProof(contractId);
    expect(proof.documentHash).to.equal(documentHash);
    expect(hre.ethers.toUtf8String(proof.signatureProof)).to.equal("MockSignatureProof_Base64_Or_Bytes");
  });

  it("should fail verification if document hash does not match (tampered document)", async function () {
    const contractId = "contract-uuid-1002";
    const documentHash = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("Original PDF"));
    const tamperedHash = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("Tampered PDF"));
    const signatureProof = hre.ethers.toUtf8Bytes("MockSignature");

    await registry.registerContract(contractId, documentHash, signatureProof);

    const [isValid] = await registry.verifyContract(contractId, tamperedHash);
    expect(isValid).to.equal(false);
  });

  it("should revert if attempting to register duplicate contractId", async function () {
    const contractId = "contract-uuid-duplicate";
    const documentHash = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("Content 1"));
    const signatureProof = hre.ethers.toUtf8Bytes("Sig");

    await registry.registerContract(contractId, documentHash, signatureProof);

    await expect(
      registry.registerContract(contractId, documentHash, signatureProof)
    ).to.be.revertedWithCustomError(registry, "ContractAlreadyRegistered");
  });

  it("should revert if documentHash is zero", async function () {
    const contractId = "contract-uuid-zero";
    const emptyHash = hre.ethers.ZeroHash;
    const signatureProof = hre.ethers.toUtf8Bytes("Sig");

    await expect(
      registry.registerContract(contractId, emptyHash, signatureProof)
    ).to.be.revertedWithCustomError(registry, "InvalidHash");
  });
});

