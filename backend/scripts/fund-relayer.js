import { ethers } from "ethers";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const GETH_RPC_URL = process.env.GETH_RPC_URL || "http://127.0.0.1:8545";
const RELAYER_PRIVATE_KEY = process.env.RELAYER_PRIVATE_KEY || "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

async function main() {
  const provider = new ethers.JsonRpcProvider(GETH_RPC_URL);

  const accounts = await provider.send("eth_accounts", []);
  if (!accounts || accounts.length === 0) {
    throw new Error("No unlocked accounts found in Geth dev node.");
  }

  const devCoinbase = accounts[0];
  const relayerWallet = new ethers.Wallet(RELAYER_PRIVATE_KEY, provider);

  console.log(`[Fund] Geth Dev Coinbase: ${devCoinbase}`);
  console.log(`[Fund] Target Relayer Address: ${relayerWallet.address}`);

  const startBalance = await provider.getBalance(relayerWallet.address);
  console.log(`[Fund] Relayer Start Balance: ${ethers.formatEther(startBalance)} ETH`);

  console.log("[Fund] Sending 100 ETH via RPC eth_sendTransaction...");
  
  // Use eth_sendTransaction with legacy gasPrice for Geth --dev instant block inclusion
  const txHash = await provider.send("eth_sendTransaction", [
    {
      from: devCoinbase,
      to: relayerWallet.address,
      value: ethers.toQuantity(ethers.parseEther("100.0")),
      gas: "0x5208", // 21000
      gasPrice: "0x3B9ACA00" // 1 Gwei
    }
  ]);

  console.log(`[Fund] Tx sent: ${txHash}. Waiting for confirmation...`);

  // Wait for receipt
  let receipt = null;
  for (let i = 0; i < 15; i++) {
    receipt = await provider.getTransactionReceipt(txHash);
    if (receipt) break;
    await new Promise((r) => setTimeout(r, 500));
  }

  const endBalance = await provider.getBalance(relayerWallet.address);
  console.log(`====================================================`);
  console.log(`[Fund] Block Number: ${receipt ? receipt.blockNumber : "pending"}`);
  console.log(`[Fund] New Relayer Balance: ${ethers.formatEther(endBalance)} ETH`);
  console.log(`====================================================`);
}

main().catch((err) => {
  console.error("[Fund Error]", err);
  process.exit(1);
});
