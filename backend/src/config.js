import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load root .env
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

export const config = {
  port: parseInt(process.env.PORT || "4000", 10),
  databasePath: process.env.DATABASE_URL?.replace(/^file:/, "") || "./dev.db",
  geth: {
    rpcUrl: process.env.GETH_RPC_URL || "http://127.0.0.1:8545",
    chainId: parseInt(process.env.GETH_CHAIN_ID || "1337", 10),
    relayerPrivateKey: process.env.RELAYER_PRIVATE_KEY || "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
    contractAddress: process.env.CONTRACT_ADDRESS || ""
  },
  aiAgentUrl: process.env.AI_AGENT_SERVICE_URL || "http://127.0.0.1:8000"
};

