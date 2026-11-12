import React, { useState } from "react";
import { ShieldCheck, Cpu, FileSignature, UploadCloud, CheckCircle, AlertTriangle, FileText } from "lucide-react";

export default function App() {
  const [activeTab, setActiveTab] = useState("draft"); // 'draft' | 'verify'

  // Contract State
  const [contractId, setContractId] = useState(null);
  const [contractType, setContractType] = useState("JEONSE");
  const [propertyAddress, setPropertyAddress] = useState("서울특별시 마포구 공덕동 100 래미안아파트 102동 501호");
  const [depositAmount, setDepositAmount] = useState(380000000);
  const [monthlyRent, setMonthlyRent] = useState(0);
  const [lessorName, setLessorName] = useState("홍길동");
  const [lessorIdNumber, setLessorIdNumber] = useState("800101-1234567");
  const [lesseeName, setLesseeName] = useState("이몽룡");
  const [lesseeIdNumber, setLesseeIdNumber] = useState("900505-1234567");

  // Clauses State
  const [clauses, setClauses] = useState([
    "임차인은 현 시설 상태대로 임차하며, 보일러 및 배관 고장 시 수리비용은 전액 임차인이 부담한다.",
    "임대인은 잔금 지급일 당일 타 금융기관에 근저당권을 설정할 수 있다.",
    "전세자금대출 미승인 시에도 계약금은 일체 반환하지 아니한다."
  ]);
  const [newClause, setNewClause] = useState("");

  // AI & Workflow State
  const [aiReview, setAiReview] = useState(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [signatures, setSignatures] = useState({ lessor: false, lessee: false });
  const [onchainResult, setOnchainResult] = useState(null);
  const [isFinalizing, setIsFinalizing] = useState(false);

  // Verification Portal State
  const [verifyContractId, setVerifyContractId] = useState("");
  const [verifyFile, setVerifyFile] = useState(null);
  const [verificationResult, setVerificationResult] = useState(null);
  const [isVerifying, setIsVerifying] = useState(false);

  // 1. Add Clause
  const handleAddClause = () => {
    if (!newClause.trim()) return;
    setClauses([...clauses, newClause.trim()]);
    setNewClause("");
  };

  const handleRemoveClause = (idx) => {
    setClauses(clauses.filter((_, i) => i !== idx));
  };

  // 2. Draft & Request AI Review
  const handleRequestAiReview = async () => {
    try {
      setIsAiLoading(true);

      // Create Draft Contract if not exists
      let currentId = contractId;
      if (!currentId) {
        const createRes = await fetch("/api/contracts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contractType,
            propertyAddress,
            depositAmount: Number(depositAmount),
            monthlyRent: Number(monthlyRent),
            lessorName,
            lessorIdNumber,
            lesseeName,
            lesseeIdNumber,
            specialClauses: clauses
          })
        });
        const created = await createRes.json();
        currentId = created.data.id;
        setContractId(currentId);
      }

      // Call AI Review via Backend
      const reviewRes = await fetch(`/api/contracts/${currentId}/ai-review`, {
        method: "POST"
      });
      const reviewData = await reviewRes.json();
      setAiReview(reviewData.data);
    } catch (err) {
      alert("AI 분석 요청 실패: " + err.message);
    } finally {
      setIsAiLoading(false);
    }
  };

  // 3. Electronic Signature
  const handleSign = async (role) => {
    if (!contractId) {
      alert("먼저 계약서를 작성하거나 AI 검토를 진행해 주세요.");
      return;
    }
    try {
      await fetch(`/api/contracts/${contractId}/sign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signerRole: role === "lessor" ? "LESSOR" : "LESSEE",
          signerName: role === "lessor" ? lessorName : lesseeName,
          signatureData: `E-SIG-${role.toUpperCase()}-${Date.now()}`
        })
      });
      setSignatures((prev) => ({ ...prev, [role]: true }));
    } catch (err) {
      alert("서명 처리 실패: " + err.message);
    }
  };

  // 4. Finalize & Register on Geth Blockchain
  const handleFinalizeOnChain = async () => {
    if (!signatures.lessor || !signatures.lessee) {
      alert("임대인과 임차인 모두 서명을 완료해야 블록체인 등록이 가능합니다.");
      return;
    }
    try {
      setIsFinalizing(true);
      const res = await fetch(`/api/contracts/${contractId}/finalize`, {
        method: "POST"
      });
      const data = await res.json();
      if (data.success) {
        setOnchainResult(data.data);
        setVerifyContractId(data.data.contractId);
      } else {
        alert("온체인 등록 실패: " + data.message);
      }
    } catch (err) {
      alert("온체인 등록 에러: " + err.message);
    } finally {
      setIsFinalizing(false);
    }
  };

  // 5. Verify PDF against Geth Blockchain
  const handleVerifyPdf = async (e) => {
    e.preventDefault();
    if (!verifyContractId || !verifyFile) {
      alert("계약 ID와 검증할 PDF 파일을 선택해 주세요.");
      return;
    }
    try {
      setIsVerifying(true);
      const formData = new FormData();
      formData.append("contractId", verifyContractId);
      formData.append("pdfFile", verifyFile);

      const res = await fetch("/api/contracts/verify", {
        method: "POST",
        body: formData
      });
      const data = await res.json();
      setVerificationResult(data.data);
    } catch (err) {
      alert("검증 에러: " + err.message);
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="container">
      <header>
        <div>
          <h1 style={{ fontSize: "24px", fontWeight: "bold" }}>Hybrid Real Estate Contract SaaS</h1>
          <p style={{ color: "var(--text-muted)", fontSize: "14px" }}>
            Off-chain PII 보호 + LangChain AI 특약 분석 + Geth 프라이빗 블록체인 무결성 검증
          </p>
        </div>
        <div>
          <span className="badge badge-chain">Geth Private Network (Relayer)</span>
        </div>
      </header>

      {/* Navigation Tabs */}
      <div className="tabs">
        <button
          className={`tab-btn ${activeTab === "draft" ? "active" : ""}`}
          onClick={() => setActiveTab("draft")}
        >
          계약서 작성 & AI 검토 & 블록체인 서명
        </button>
        <button
          className={`tab-btn ${activeTab === "verify" ? "active" : ""}`}
          onClick={() => setActiveTab("verify")}
        >
          PDF 위변조 원클릭 검증 포털
        </button>
      </div>

      {activeTab === "draft" && (
        <>
          {/* 1. Contract Details Form */}
          <div className="card">
            <h2 style={{ fontSize: "18px", marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
              <FileText size={20} color="var(--primary)" /> 1. 기본 계약 정보 작성 (Off-Chain PII 격리 저장)
            </h2>
            <div className="grid">
              <div>
                <div className="form-group">
                  <label>계약 유형</label>
                  <select value={contractType} onChange={(e) => setContractType(e.target.value)}>
                    <option value="SALE">매매 (SALE)</option>
                    <option value="JEONSE">전세 (JEONSE)</option>
                    <option value="MONTHLY_RENT">월세 (MONTHLY_RENT)</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>부동산 소재지 주소</label>
                  <input
                    type="text"
                    value={propertyAddress}
                    onChange={(e) => setPropertyAddress(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label>보증금 / 전세금 (원)</label>
                  <input
                    type="number"
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <div className="form-group">
                  <label>임대인(매도인) 이름 및 주민번호</label>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <input
                      type="text"
                      placeholder="이름"
                      value={lessorName}
                      onChange={(e) => setLessorName(e.target.value)}
                    />
                    <input
                      type="text"
                      placeholder="주민번호"
                      value={lessorIdNumber}
                      onChange={(e) => setLessorIdNumber(e.target.value)}
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label>임차인(매수인) 이름 및 주민번호</label>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <input
                      type="text"
                      placeholder="이름"
                      value={lesseeName}
                      onChange={(e) => setLesseeName(e.target.value)}
                    />
                    <input
                      type="text"
                      placeholder="주민번호"
                      value={lesseeIdNumber}
                      onChange={(e) => setLesseeIdNumber(e.target.value)}
                    />
                  </div>
                </div>
                {contractType === "MONTHLY_RENT" && (
                  <div className="form-group">
                    <label>월세 (원)</label>
                    <input
                      type="number"
                      value={monthlyRent}
                      onChange={(e) => setMonthlyRent(e.target.value)}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Special Clauses Section */}
            <div style={{ marginTop: "16px" }}>
              <label style={{ fontSize: "14px", fontWeight: "600", marginBottom: "8px", display: "block" }}>
                특약사항 (Special Clauses)
              </label>
              {clauses.map((clause, idx) => (
                <div key={idx} className="clause-item">
                  <span style={{ fontSize: "14px" }}>{idx + 1}. {clause}</span>
                  <button className="clause-delete" onClick={() => handleRemoveClause(idx)}>삭제</button>
                </div>
              ))}
              <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
                <input
                  type="text"
                  placeholder="특약사항 문구를 입력하세요..."
                  value={newClause}
                  onChange={(e) => setNewClause(e.target.value)}
                />
                <button className="btn btn-primary" onClick={handleAddClause}>추가</button>
              </div>
            </div>

            <div style={{ marginTop: "20px", display: "flex", justifyContent: "flex-end" }}>
              <button
                className="btn btn-ai"
                onClick={handleRequestAiReview}
                disabled={isAiLoading}
                style={{ display: "flex", alignItems: "center", gap: "8px" }}
              >
                <Cpu size={18} /> {isAiLoading ? "LangChain AI 분석 중..." : "AI 법률 독소조항 분석 실행"}
              </button>
            </div>
          </div>

          {/* 2. AI Risk Review Results Panel */}
          {aiReview && (
            <div className="card" style={{ borderLeft: "4px solid #7c3aed" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                <h2 style={{ fontSize: "18px", display: "flex", alignItems: "center", gap: "8px" }}>
                  <Cpu size={20} color="#7c3aed" /> 2. AI 법률 위험도 분석 결과 (Ollama gemma4:e2b)
                </h2>
                <div>
                  <span className={`badge ${aiReview.risk_grade === "SAFE" ? "badge-safe" : aiReview.risk_grade === "CAUTION" ? "badge-caution" : "badge-dangerous"}`}>
                    위험도 점수: {aiReview.risk_score} / 100 ({aiReview.risk_grade})
                  </span>
                </div>
              </div>

              <p style={{ fontSize: "14px", color: "var(--text-main)", marginBottom: "16px", background: "#f8fafc", padding: "12px", borderRadius: "6px" }}>
                <strong>총평:</strong> {aiReview.summary}
              </p>

              {/* Toxic Clauses */}
              {aiReview.toxic_clauses && aiReview.toxic_clauses.length > 0 && (
                <div style={{ marginBottom: "16px" }}>
                  <h3 style={{ fontSize: "15px", color: "var(--danger)", marginBottom: "8px", display: "flex", alignItems: "center", gap: "6px" }}>
                    <AlertTriangle size={18} /> 검출된 독소 조항 ({aiReview.toxic_clauses.length}건)
                  </h3>
                  {aiReview.toxic_clauses.map((item, idx) => (
                    <div key={idx} style={{ background: "#fff1f2", border: "1px solid #fecdd3", padding: "12px", borderRadius: "6px", marginBottom: "8px" }}>
                      <p style={{ fontSize: "13px", fontWeight: "bold", color: "#9f1239" }}>
                        [{item.risk_level}] 원본: "{item.original_clause}"
                      </p>
                      <p style={{ fontSize: "13px", color: "#4c0519", marginTop: "4px" }}>
                        <strong>문제점:</strong> {item.issue_description}
                      </p>
                      <p style={{ fontSize: "13px", color: "#065f46", marginTop: "4px" }}>
                        <strong>추천 수정안:</strong> {item.suggested_revision}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {/* Checklist */}
              {aiReview.checklist && (
                <div>
                  <h3 style={{ fontSize: "15px", marginBottom: "8px" }}>법률 체크리스트</h3>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                    {aiReview.checklist.map((item, idx) => (
                      <div key={idx} style={{ background: "#f8fafc", border: "1px solid var(--border)", padding: "10px", borderRadius: "6px", fontSize: "13px" }}>
                        <span style={{ fontWeight: "bold" }}>{item.passed ? "✅ [통과]" : "❌ [보완 필요]"}</span> {item.category}
                        <p style={{ color: "var(--text-muted)", fontSize: "12px", marginTop: "2px" }}>{item.detail}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 3. Electronic Signature & On-chain Finalize */}
          <div className="card">
            <h2 style={{ fontSize: "18px", marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
              <FileSignature size={20} color="var(--primary)" /> 3. 전자서명 및 블록체인 온체인 등록 (Relayer)
            </h2>
            <div style={{ display: "flex", gap: "16px", marginBottom: "20px" }}>
              <button
                className={`btn ${signatures.lessor ? "btn-primary" : ""}`}
                style={{ flex: 1, padding: "14px", background: signatures.lessor ? "var(--success)" : "#e2e8f0", color: signatures.lessor ? "white" : "#475569" }}
                onClick={() => handleSign("lessor")}
                disabled={signatures.lessor}
              >
                {signatures.lessor ? `✅ 임대인 서명 완료 (${lessorName})` : `✍️ 임대인 전자서명 하기 (${lessorName})`}
              </button>
              <button
                className={`btn ${signatures.lessee ? "btn-primary" : ""}`}
                style={{ flex: 1, padding: "14px", background: signatures.lessee ? "var(--success)" : "#e2e8f0", color: signatures.lessee ? "white" : "#475569" }}
                onClick={() => handleSign("lessee")}
                disabled={signatures.lessee}
              >
                {signatures.lessee ? `✅ 임차인 서명 완료 (${lesseeName})` : `✍️ 임차인 전자서명 하기 (${lesseeName})`}
              </button>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid var(--border)", paddingTop: "16px" }}>
              <span style={{ fontSize: "13px", color: "var(--text-muted)" }}>
                ※ 확정 시 서버가 PDF를 생성하고 SHA-256 해시를 Geth 개발망에 영구 등록합니다.
              </span>
              <button
                className="btn btn-primary"
                onClick={handleFinalizeOnChain}
                disabled={!signatures.lessor || !signatures.lessee || isFinalizing || !!onchainResult}
                style={{ display: "flex", alignItems: "center", gap: "8px" }}
              >
                <ShieldCheck size={18} /> {isFinalizing ? "Geth 블록체인 기록 중..." : onchainResult ? "온체인 등록 완료" : "계약서 최종 확정 & 온체인 등록"}
              </button>
            </div>

            {onchainResult && (
              <div style={{ marginTop: "16px", background: "#f0fdf4", border: "1px solid #bbf7d0", padding: "16px", borderRadius: "8px" }}>
                <h4 style={{ color: "#166534", marginBottom: "8px", display: "flex", alignItems: "center", gap: "6px" }}>
                  <CheckCircle size={18} /> Geth 블록체인 등록 성공 (트랜잭션 확정)
                </h4>
                <div style={{ fontSize: "13px", color: "#14532d", lineHeight: "1.8" }}>
                  <div><strong>Contract ID:</strong> {onchainResult.contractId}</div>
                  <div><strong>Document SHA-256 Hash:</strong> <code style={{ wordBreak: "break-all" }}>{onchainResult.documentHash}</code></div>
                  <div><strong>Geth Tx Hash:</strong> <code style={{ wordBreak: "break-all" }}>{onchainResult.txHash}</code></div>
                  <div><strong>PDF File Path:</strong> {onchainResult.pdfPath}</div>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {activeTab === "verify" && (
        <div className="card">
          <h2 style={{ fontSize: "18px", marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
            <UploadCloud size={20} color="var(--primary)" /> PDF 위변조 무결성 검증 포털
          </h2>
          <p style={{ fontSize: "14px", color: "var(--text-muted)", marginBottom: "20px" }}>
            사용자가 소지한 계약서 PDF를 업로드하면 바이트 단위로 SHA-256 해시를 추출하여 Geth 블록체인 기록과 즉시 대조합니다.
          </p>

          <form onSubmit={handleVerifyPdf}>
            <div className="form-group">
              <label>계약서 고유 ID (Contract UUID)</label>
              <input
                type="text"
                placeholder="예: 0af61b27-40a6-4c8b-8ef2-4566e1f14176"
                value={verifyContractId}
                onChange={(e) => setVerifyContractId(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label>검증할 계약서 PDF 파일 선택</label>
              <input
                type="file"
                accept="application/pdf"
                onChange={(e) => setVerifyFile(e.target.files[0])}
                required
              />
            </div>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isVerifying}
              style={{ display: "flex", alignItems: "center", gap: "8px" }}
            >
              <ShieldCheck size={18} /> {isVerifying ? "온체인 해시 대조 중..." : "블록체인 무결성 검증 실행"}
            </button>
          </form>

          {verificationResult && (
            <div style={{
              marginTop: "24px",
              padding: "16px",
              borderRadius: "8px",
              background: verificationResult.integrityStatus === "AUTHENTIC_AND_UNTOUCHED" ? "#f0fdf4" : "#fef2f2",
              border: `1px solid ${verificationResult.integrityStatus === "AUTHENTIC_AND_UNTOUCHED" ? "#bbf7d0" : "#fecaca"}`
            }}>
              <h3 style={{
                fontSize: "16px",
                color: verificationResult.integrityStatus === "AUTHENTIC_AND_UNTOUCHED" ? "#166534" : "#991b1b",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                marginBottom: "8px"
              }}>
                {verificationResult.integrityStatus === "AUTHENTIC_AND_UNTOUCHED" ? (
                  <><CheckCircle size={20} /> 검증 성공: 원본 보증 (단 1바이트의 위변조도 없음)</>
                ) : (
                  <><AlertTriangle size={20} /> 검증 실패: 위변조 감지 또는 미등록 문서</>
                )}
              </h3>
              <div style={{ fontSize: "13px", lineHeight: "1.8", color: "#334155" }}>
                <div><strong>업로드 파일 SHA-256 해시:</strong> <code>{verificationResult.uploadedDocumentHash}</code></div>
                <div><strong>블록체인 등록 여부:</strong> {verificationResult.onchainRegistered ? "등록됨 (TRUE)" : "미등록 (FALSE)"}</div>
                <div><strong>온체인 등록 일시:</strong> {verificationResult.onchainTimestamp || "N/A"}</div>
                <div><strong>가스비 대납 Relayer 주소:</strong> <code>{verificationResult.relayerAddress}</code></div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

