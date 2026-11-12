#!/usr/bin/env bash
# Starts local Geth private network in dev mode (--dev)

DATA_DIR="./blockchain/.geth_dev_data"
RPC_PORT="8545"
NETWORK_ID="1337"

mkdir -p "$DATA_DIR"

echo "[Geth] Starting private dev network on http://127.0.0.1:${RPC_PORT}..."
geth --datadir "$DATA_DIR" \
  --dev \
  --dev.period 0 \
  --http \
  --http.addr "127.0.0.1" \
  --http.port "$RPC_PORT" \
  --http.corsdomain "*" \
  --http.api "eth,net,web3,personal,txpool" \
  --networkid "$NETWORK_ID"

