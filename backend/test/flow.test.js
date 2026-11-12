import fs from "fs";
import path from "path";

const API_BASE = "http://127.0.0.1:4000/api/contracts";

async function runTest() {
  console.log("==================================================");
  console.log("Starting Phase 2 Flow Test (Contract -> Web3 Geth)");
  console.log("==================================================");

  // 1. Create Contract
  console.log("\n[Step 1] Creating Draft Contract...");
  const createRes = await fetch(`${API_BASE}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contractType: "JEONSE",
      propertyAddress: "서울특별시 강남구 역삼동 테헤란로 123 아파트 101동 1502호",
      depositAmount: 500000000,
      monthlyRent: 0,
      lessorName: "홍길동",
      lessorIdNumber: "800101-1234567",
      lesseeName: "이몽룡",
      lesseeIdNumber: "900505-1234567",
      specialClauses: [
        "임대인은 잔금지급일 익일까지 해당 부동산에 근저당권 등 제한물권을 설정하지 아니한다.",
        "전세자금대출 미승인 시 본 계약은 무효로 하며 계약금은 즉시 반환한다."
      ]
    })
  });

  const created = await createRes.json();
  if (!created.success) {
    console.error("Failed to create contract:", created);
    return;
  }
  console.log("Created successfully, ID:", created.data.id);
  const contractId = created.data.id;

  // 2. Sign Contract
  console.log(`\n[Step 2] Signing Contract ${contractId}...`);
  await fetch(`${API_BASE}/${contractId}/sign`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      signerRole: "LESSOR",
      signerName: "홍길동",
      signatureData: "BASE64_SIGNATURE_PROOF_LESSOR"
    })
  });

  await fetch(`${API_BASE}/${contractId}/sign`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      signerRole: "LESSEE",
      signerName: "이몽룡",
      signatureData: "BASE64_SIGNATURE_PROOF_LESSEE"
    })
  });
  console.log("Both parties signed.");

  // 3. Finalize & Relay to Geth
  console.log(`\n[Step 3] Finalizing & Relaying to Geth Blockchain...`);
  const finalizeRes = await fetch(`${API_BASE}/${contractId}/finalize`, {
    method: "POST"
  });
  const finalized = await finalizeRes.json();
  console.log("Finalized Result:", finalized);

  if (!finalized.success) {
    console.error("\n>>> Finalize Failed:", finalized.message || finalized.errorCode);
    return;
  }

  // 4. Verify Document via Upload
  console.log(`\n[Step 4] Verifying Original PDF against Geth On-chain Record...`);
  const pdfPath = finalized.data.pdfPath;
  const pdfBytes = fs.readFileSync(path.resolve(pdfPath));

  const formData = new FormData();
  formData.append("contractId", contractId);
  formData.append("pdfFile", new Blob([pdfBytes], { type: "application/pdf" }), "contract.pdf");

  const verifyRes = await fetch(`${API_BASE}/verify`, {
    method: "POST",
    body: formData
  });
  const verification = await verifyRes.json();
  console.log("Verification Result:", verification);

  if (verification.data?.integrityStatus === "AUTHENTIC_AND_UNTOUCHED") {
    console.log("\n>>> SUCCESS: PDF byte hash matches on-chain proof 100%! <<<");
  } else {
    console.log("\n>>> FAILED: Hash mismatch or not found on-chain. <<<");
  }
}

runTest().catch(console.error);
