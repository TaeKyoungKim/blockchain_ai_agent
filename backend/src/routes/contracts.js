import { Router } from "express";
import { v4 as uuidv4 } from "uuid";
import multer from "multer";
import { dbInstance } from "../db.js";
import { generateContractPDF, calculateBufferHash } from "../pdf.js";
import { registerContractOnChain, verifyContractOnChain } from "../web3.js";
import { config } from "../config.js";

const upload = multer({ limits: { fileSize: 25 * 1024 * 1024 } }); // 25MB max
export const contractsRouter = Router();

/**
 * POST /api/contracts
 * Create a new contract draft in off-chain database.
 */
contractsRouter.post("/", async (req, res, next) => {
  try {
    const {
      contractType,
      propertyAddress,
      depositAmount,
      monthlyRent,
      lessorName,
      lessorIdNumber,
      lesseeName,
      lesseeIdNumber,
      specialClauses
    } = req.body;

    if (!contractType || !propertyAddress || !lessorName || !lesseeName) {
      return res.status(400).json({
        success: false,
        errorCode: "INVALID_INPUT",
        message: "Missing mandatory contract fields (contractType, propertyAddress, parties)"
      });
    }

    const id = uuidv4();
    const clausesJson = JSON.stringify(specialClauses || []);

    await dbInstance.run(
      `INSERT INTO contracts (
        id, contract_type, property_address, deposit_amount, monthly_rent,
        lessor_name, lessor_id_number, lessee_name, lessee_id_number, special_clauses, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'DRAFT')`,
      [
        id,
        contractType,
        propertyAddress,
        depositAmount || 0,
        monthlyRent || 0,
        lessorName,
        lessorIdNumber || "",
        lesseeName,
        lesseeIdNumber || "",
        clausesJson
      ]
    );

    const created = await dbInstance.get("SELECT * FROM contracts WHERE id = ?", [id]);

    res.status(201).json({
      success: true,
      data: created
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/contracts/:id/ai-review
 * Requests Python AI Agent to review contract special clauses and caches result in off-chain DB.
 */
contractsRouter.post("/:id/ai-review", async (req, res, next) => {
  try {
    const { id } = req.params;
    const contract = await dbInstance.get("SELECT * FROM contracts WHERE id = ?", [id]);

    if (!contract) {
      return res.status(404).json({
        success: false,
        errorCode: "CONTRACT_NOT_FOUND",
        message: "Contract not found"
      });
    }

    const clauses = JSON.parse(contract.special_clauses || "[]");

    console.log(`[Contract API] Calling Python AI Agent for contract ${id}...`);
    const aiResponse = await fetch(`${config.aiAgentUrl}/api/ai/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contract_type: contract.contract_type,
        property_address: contract.property_address,
        deposit_amount: contract.deposit_amount,
        monthly_rent: contract.monthly_rent,
        special_clauses: clauses
      })
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      throw new Error(`AI Agent service error: ${errText}`);
    }

    const reviewResult = await aiResponse.json();

    // Cache review result and advance contract status to REVIEWED
    await dbInstance.run(
      `UPDATE contracts
       SET ai_review_result = ?, status = 'REVIEWED', updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [JSON.stringify(reviewResult), id]
    );

    res.json({
      success: true,
      message: "AI risk review completed and cached",
      data: reviewResult
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/contracts/:id
 * Retrieve contract details and verification status.
 */
contractsRouter.get("/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    const contract = await dbInstance.get("SELECT * FROM contracts WHERE id = ?", [id]);

    if (!contract) {
      return res.status(404).json({
        success: false,
        errorCode: "CONTRACT_NOT_FOUND",
        message: `Contract with ID '${id}' does not exist`
      });
    }

    const signatures = await dbInstance.all("SELECT * FROM signatures WHERE contract_id = ?", [id]);

    res.json({
      success: true,
      data: {
        ...contract,
        special_clauses: JSON.parse(contract.special_clauses || "[]"),
        ai_review_result: contract.ai_review_result ? JSON.parse(contract.ai_review_result) : null,
        signatures
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/contracts/:id/sign
 * Record electronic signatures for the contract parties.
 */
contractsRouter.post("/:id/sign", async (req, res, next) => {
  try {
    const { id } = req.params;
    const { signerRole, signerName, signatureData } = req.body;

    const contract = await dbInstance.get("SELECT * FROM contracts WHERE id = ?", [id]);
    if (!contract) {
      return res.status(404).json({
        success: false,
        errorCode: "CONTRACT_NOT_FOUND",
        message: "Contract not found"
      });
    }

    const sigId = uuidv4();
    await dbInstance.run(
      `INSERT INTO signatures (id, contract_id, signer_role, signer_name, signature_data)
       VALUES (?, ?, ?, ?, ?)`,
      [sigId, id, signerRole, signerName, signatureData || "DIGITAL_SIGNATURE_CONFIRMED"]
    );

    // Update status to SIGNED
    await dbInstance.run(
      "UPDATE contracts SET status = 'SIGNED', updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      [id]
    );

    res.json({
      success: true,
      message: "Signature recorded successfully",
      signatureId: sigId
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/contracts/:id/finalize
 * Generates deterministic PDF, computes SHA-256 hash, and registers proof to Geth private network.
 */
contractsRouter.post("/:id/finalize", async (req, res, next) => {
  try {
    const { id } = req.params;
    const contract = await dbInstance.get("SELECT * FROM contracts WHERE id = ?", [id]);

    if (!contract) {
      return res.status(404).json({
        success: false,
        errorCode: "CONTRACT_NOT_FOUND",
        message: "Contract not found"
      });
    }

    if (contract.status === "FINALIZED_ONCHAIN") {
      return res.status(400).json({
        success: false,
        errorCode: "ALREADY_FINALIZED",
        message: "Contract is already finalized and registered on-chain",
        data: {
          documentHash: contract.document_hash,
          txHash: contract.tx_hash
        }
      });
    }

    // 1. Generate PDF & deterministic SHA-256 hash
    console.log(`[Contract API] Generating PDF for ${id}...`);
    const { documentHash, filePath } = await generateContractPDF(contract);

    // 2. Register to Geth via Relayer
    console.log(`[Contract API] Relaying on-chain registration for ${id}...`);
    const signatureProof = `PROOF_FOR_${contract.lessor_name}_AND_${contract.lessee_name}`;
    const onchainResult = await registerContractOnChain(id, documentHash, signatureProof);

    // 3. Update off-chain database
    const nowTimestamp = Math.floor(Date.now() / 1000);
    await dbInstance.run(
      `UPDATE contracts
       SET status = 'FINALIZED_ONCHAIN',
           pdf_path = ?,
           document_hash = ?,
           tx_hash = ?,
           onchain_timestamp = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [filePath, documentHash, onchainResult.txHash, nowTimestamp, id]
    );

    res.json({
      success: true,
      message: "Contract successfully finalized and registered on Geth blockchain",
      data: {
        contractId: id,
        documentHash,
        txHash: onchainResult.txHash,
        gasUsed: onchainResult.gasUsed,
        pdfPath: filePath
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/contracts/verify
 * Verifies any PDF file against Geth blockchain record.
 */
contractsRouter.post("/verify", upload.single("pdfFile"), async (req, res, next) => {
  try {
    const { contractId } = req.body;

    if (!contractId || !req.file) {
      return res.status(400).json({
        success: false,
        errorCode: "INVALID_REQUEST",
        message: "contractId and pdfFile (multipart form-data) are required"
      });
    }

    // Calculate uploaded PDF's byte hash
    const uploadedHash = calculateBufferHash(req.file.buffer);

    // Verify against on-chain proof
    const onchainVerification = await verifyContractOnChain(contractId, uploadedHash);

    // Check off-chain DB record
    const offchainRecord = await dbInstance.get(
      "SELECT id, status, document_hash FROM contracts WHERE id = ?",
      [contractId]
    );

    const isMatch = onchainVerification.isValid;

    res.json({
      success: true,
      data: {
        contractId,
        uploadedDocumentHash: uploadedHash,
        onchainRegistered: onchainVerification.isValid,
        onchainTimestamp: onchainVerification.timestamp ? new Date(onchainVerification.timestamp * 1000).toISOString() : null,
        relayerAddress: onchainVerification.registeredBy,
        integrityStatus: isMatch ? "AUTHENTIC_AND_UNTOUCHED" : "TAMPERED_OR_UNREGISTERED",
        offchainRecordExists: !!offchainRecord
      }
    });
  } catch (error) {
    next(error);
  }
});
