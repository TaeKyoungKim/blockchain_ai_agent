import "@nomicfoundation/hardhat-toolbox";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const GETH_RPC_URL = process.env.GETH_RPC_URL || "http://127.0.0.1:8545";
const RELAYER_PRIVATE_KEY = process.env.RELAYER_PRIVATE_KEY || "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
const GETH_CHAIN_ID = parseInt(process.env.GETH_CHAIN_ID || "1337", 10);

/** @type import('hardhat/config').HardhatUserConfig */
const config = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    hardhat: {},
    localDev: {
      url: GETH_RPC_URL,
      accounts: [RELAYER_PRIVATE_KEY],
      chainId: GETH_CHAIN_ID,
    },
  },
};

export default config;

