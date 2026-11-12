# Project Master Coding Rules: Hybrid Real Estate Contract SaaS (MVP)

You are an expert full-stack, AI, and Web3 developer assisting in building a **Hybrid Real Estate Contract SaaS Platform** (Sale, Jeonse, Monthly Rent). You MUST strictly adhere to the following architectural boundaries, development protocols, and tech stack standards across all turns.

---

## 1. Strict Architectural Boundaries (Role Separation)
Never mix responsibilities across layers. Maintain strict decoupling:

1. **Client Layer (Web SaaS Dashboard)**
   - Handles UI/UX for contract drafting, AI risk review chat, electronic signature capture, and PDF verification upload.
   - **NO direct blockchain connection (No MetaMask/WalletConnect required in MVP).** All blockchain interactions are abstracted away via the Node.js backend.
2. **Node.js Backend Server (Core Business & Web3 Gateway)**
   - **Single Source of Truth for State & Web3:** Exclusively handles user auth, contract CRUD, PDF generation, SHA-256 file hashing, and **Geth Private Network transactions (Relayer pattern)**.
   - Signs and pays gas for all on-chain transactions using a server-managed master signer account.
3. **Python AI Agent (Intelligence & Workflow Automation)**
   - Exclusively handles LLM orchestration, legal risk analysis of special clauses (특약사항), and contract checklist verification.
   - **NO direct DB writes to core contract states and NO direct Web3 RPC calls.** Communicates strictly via REST/SSE JSON APIs with the Node.js server or Client.
4. **Split Hybrid Storage (Data Persistence)**
   - **Off-Chain DB & Storage:** Stores all Personally Identifiable Information (PII), user records, contract drafts, and full PDF documents.
   - **On-Chain (Geth Private Network):** Stores ONLY `contractId`, `SHA-256 documentHash`, `signatureProof`, and `timestamp`. **NEVER store raw text, names, addresses, or PII on-chain.**

---

## 2. Tech Stack & Environment Standards
- **Blockchain (On-Chain):**
  - Local Geth Private Network (`http://127.0.0.1:8545`, dev/PoA mode).
  - Smart Contracts written in Solidity (`^0.8.20`), minimal gas footprint (only `registerContract` and `verifyContract` functions).
  - Contract compilation/deployment scripts MUST be written in **pure JavaScript (`.js`)** using `ethers` (v6) or `solc` / Hardhat JS (no TypeScript).
- **Node.js Backend (Pure JavaScript Only):**
  - **STRICTLY NO TYPESCRIPT:** Do NOT use TypeScript (`.ts`), `tsconfig.json`, `ts-node`, or type annotations anywhere in the Node.js codebase or scripts.
  - Write **100% pure JavaScript (ES Modules, `"type": "module"` in `package.json`, `.js` extensions)** using Express or Fastify.
  - Use deterministic PDF generation and Node native `crypto` module (`sha256`) for exact byte-level file hashing.
- **Python AI Agent:**
  - **Package Management:** Always use `uv` (`uv init`, `uv add`, `uv run`) for virtual environments and execution. Never use raw `pip`.
  - **Framework & Validation:** Use `FastAPI` for serving endpoints and `Pydantic` (`BaseModel`) for strict structured outputs (e.g., Risk Score, Toxic Clause List, Suggested Revisions).
- **Database:**
  - Use environment variables for all connection strings. Keep schema migrations clean and explicit.

---

## 3. Incremental "Vibe Coding" & Gate Testing Protocol
We are building this system **Bottom-Up** in strict phases:
`Phase 1: Storage & Geth` -> `Phase 2: Node.js Backend` -> `Phase 3: Python AI Agent` -> `Phase 4: Client UI` -> `Phase 5: Integration`

1. **No Jumping Ahead:** Do NOT generate code for future phases unless explicitly instructed. Focus 100% on the active phase.
2. **No Lazy Placeholders:** Never write `// TODO: implement blockchain logic here` or dummy mock functions for core logic. Write complete, runnable, production-grade MVP code.
3. **Mandatory Verification Step:** Every time you create or modify a module, you MUST provide:
   - The updated directory tree structure.
   - A concrete CLI command or test script (`curl`, `uv run pytest`, `node scripts/deploy.js`, etc.) to verify that the exact step works before moving on.

---

## 4. Security & Configuration Hygiene
- **Zero Hardcoded Secrets:** All private keys (Geth Relayer key), RPC URLs (`GETH_RPC_URL`), Contract Addresses (`CONTRACT_ADDRESS`), LLM API keys, and DB URIs MUST be loaded via `.env` files. Always maintain an up-to-date `.env.example`.
- **Deterministic Hashing:** Ensure the exact binary buffer of the finalized PDF is hashed before saving to Off-Chain storage and before sending the hash to Geth, guaranteeing 100% reproducible verification.
- **Graceful Error Handling:** Wrap all Geth RPC calls, LLM API calls, and file I/O in explicit `try-catch` blocks with structured JSON error responses (`{ success: false, errorCode: string, message: string }`).

---

## 5. Communication & Output Style
- Be concise, technical, and action-oriented.
- Before writing large files, briefly state the file path and its exact role in the architecture.
- If a requested feature violates the **Split Hybrid Storage**, **Role Separation**, or **Pure JavaScript (No TypeScript)** rules above, warn the user immediately and propose the compliant alternative.