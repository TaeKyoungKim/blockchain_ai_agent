@echo off
REM ============================================================================
REM Starts a local Geth private network in developer mode (--dev) for Phase 1.
REM Enables JSON-RPC on http://127.0.0.1:8545 with required APIs.
REM ============================================================================

setlocal

set "DATA_DIR=%~dp0..\.geth_dev_data"
set "RPC_PORT=8545"
set "NETWORK_ID=1337"

where geth >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Geth executable was not found in PATH.
    echo Please install Geth or ensure geth.exe is accessible in your PATH.
    exit /b 1
)

if not exist "%DATA_DIR%" (
    mkdir "%DATA_DIR%"
    echo [Geth] Created data directory: %DATA_DIR%
)

echo [Geth] Starting private dev network on http://127.0.0.1:%RPC_PORT%...
echo [Geth] Data directory: %DATA_DIR%
echo [Geth] Network ID: %NETWORK_ID%

geth --datadir "%DATA_DIR%" ^
  --dev ^
  --dev.period 0 ^
  --http ^
  --http.addr "127.0.0.1" ^
  --http.port %RPC_PORT% ^
  --http.corsdomain "*" ^
  --http.api "eth,net,web3,personal,txpool" ^
  --networkid %NETWORK_ID%

endlocal

