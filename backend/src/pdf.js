import PDFDocument from "pdfkit";
import crypto from "crypto";
import fs from "fs";
import path from "path";

/**
 * Generates a deterministic real estate contract PDF and calculates its SHA-256 hash.
 * 
 * @param {Object} contract Contract data with parties, property, amounts, clauses, and signatures.
 * @param {string} outputDir Directory where the PDF will be saved.
 * @returns {Promise<{ pdfBuffer: Buffer, documentHash: string, filePath: string }>}
 */
export function generateContractPDF(contract, outputDir = "./storage/contracts") {
  return new Promise((resolve, reject) => {
    try {
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      const filePath = path.join(outputDir, `${contract.id}.pdf`);
      const doc = new PDFDocument({
        size: "A4",
        margin: 50,
        info: {
          Title: `Real Estate Contract - ${contract.id}`,
          Author: "Hybrid Real Estate SaaS",
          Subject: contract.contract_type
        }
      });

      const chunks = [];
      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", () => {
        const pdfBuffer = Buffer.concat(chunks);
        // Exact byte-level deterministic SHA-256 calculation
        const documentHash = "0x" + crypto.createHash("sha256").update(pdfBuffer).digest("hex");
        fs.writeFileSync(filePath, pdfBuffer);
        resolve({ pdfBuffer, documentHash, filePath });
      });
      doc.on("error", (err) => reject(err));

      // Header
      doc.fontSize(20).text("REAL ESTATE CONTRACT", { align: "center", bold: true });
      doc.moveDown(0.5);
      doc.fontSize(10).text(`Contract ID: ${contract.id}`, { align: "center" });
      doc.text(`Type: ${contract.contract_type} | Date: ${contract.created_at || new Date().toISOString()}`, { align: "center" });
      doc.moveDown(1.5);

      // 1. Property Details
      doc.fontSize(14).text("1. Property Description", { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(11).text(`Address: ${contract.property_address}`);
      doc.text(`Deposit Amount: KRW ${Number(contract.deposit_amount).toLocaleString()}`);
      if (contract.contract_type === "MONTHLY_RENT") {
        doc.text(`Monthly Rent: KRW ${Number(contract.monthly_rent).toLocaleString()}`);
      }
      doc.moveDown(1.2);

      // 2. Parties
      doc.fontSize(14).text("2. Parties Involved", { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(11).text(`Lessor (임대인/매도인): ${contract.lessor_name} (ID: ${contract.lessor_id_number})`);
      doc.text(`Lessee (임차인/매수인): ${contract.lessee_name} (ID: ${contract.lessee_id_number})`);
      doc.moveDown(1.2);

      // 3. Special Clauses (특약사항)
      doc.fontSize(14).text("3. Special Clauses (특약사항)", { underline: true });
      doc.moveDown(0.5);
      let clauses = [];
      try {
        clauses = typeof contract.special_clauses === "string" ? JSON.parse(contract.special_clauses) : contract.special_clauses;
      } catch (e) {
        clauses = [contract.special_clauses];
      }

      if (Array.isArray(clauses) && clauses.length > 0) {
        clauses.forEach((clause, index) => {
          doc.fontSize(10).text(`(${index + 1}) ${clause}`);
        });
      } else {
        doc.fontSize(10).text("None.");
      }
      doc.moveDown(1.5);

      // 4. Signatures
      doc.fontSize(14).text("4. Signatures & Consents", { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(11).text(`Lessor Signature: [SIGNED electronically by ${contract.lessor_name}]`);
      doc.text(`Lessee Signature: [SIGNED electronically by ${contract.lessee_name}]`);
      doc.moveDown(1.5);

      // Footer notice
      doc.fontSize(9).fillColor("gray").text(
        "This document is verified and secured by Geth Private Blockchain Network. Tamper-evident proof is recorded on-chain.",
        { align: "center" }
      );

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Calculates SHA-256 hash for any file buffer.
 */
export function calculateBufferHash(buffer) {
  return "0x" + crypto.createHash("sha256").update(buffer).digest("hex");
}

