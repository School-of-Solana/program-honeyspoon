#!/bin/bash

################################################################################
# Full Localnet Setup Script
# 
# This script performs a complete setup of the Dive Game on Solana localnet:
# 1. Checks prerequisites (Solana CLI, Anchor, Node.js)
# 2. Starts solana-test-validator
# 3. Builds and deploys the Anchor program
# 4. Initializes GameConfig and HouseVault
# 5. Funds the house vault
# 6. Verifies the deployment
# 
# Usage:
#   ./setup-localnet.sh          # Full setup
#   ./setup-localnet.sh --quick  # Skip validator restart (if already running)
################################################################################

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Print header
echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "  🌊 Deep Sea Diver - Full Localnet Setup"
echo "═══════════════════════════════════════════════════════════════"
echo ""

# Check if quick mode
QUICK_MODE=false
if [ "$1" = "--quick" ]; then
    QUICK_MODE=true
    log_info "Quick mode enabled (skipping validator restart)"
fi

################################################################################
# Step 1: Check Prerequisites
################################################################################

log_info "Checking prerequisites..."

# Check Solana CLI
if ! command -v solana &> /dev/null; then
    log_error "Solana CLI not found. Install from: https://docs.solana.com/cli/install-solana-cli-tools"
    exit 1
fi
log_success "Solana CLI found: $(solana --version)"

# Check Anchor CLI
if ! command -v anchor &> /dev/null; then
    log_error "Anchor CLI not found. Install from: https://www.anchor-lang.com/docs/installation"
    exit 1
fi
log_success "Anchor CLI found: $(anchor --version)"

# Check Node.js
if ! command -v node &> /dev/null; then
    log_error "Node.js not found. Install from: https://nodejs.org/"
    exit 1
fi
log_success "Node.js found: $(node --version)"

# Check npm
if ! command -v npm &> /dev/null; then
    log_error "npm not found. Install Node.js from: https://nodejs.org/"
    exit 1
fi
log_success "npm found: $(npm --version)"

################################################################################
# Step 2: Start Solana Test Validator
################################################################################

if [ "$QUICK_MODE" = false ]; then
    log_info "Starting solana-test-validator..."
    
    # Kill any existing validator
    pkill -9 solana-test-validator 2>/dev/null || true
    sleep 2
    
    # Start validator in background
    solana-test-validator > /tmp/solana-test-validator.log 2>&1 &
    VALIDATOR_PID=$!
    
    log_info "Waiting for validator to start (PID: $VALIDATOR_PID)..."
    sleep 5
    
    # Check if validator is running
    if ! solana cluster-version --url localhost &> /dev/null; then
        log_error "Failed to start validator. Check logs: /tmp/solana-test-validator.log"
        exit 1
    fi
    
    log_success "Validator started and running"
else
    # Check if validator is already running
    if ! solana cluster-version --url localhost &> /dev/null; then
        log_error "Validator not running. Remove --quick flag to start it."
        exit 1
    fi
    log_success "Validator already running"
fi

# Configure Solana CLI to use localhost
solana config set --url localhost > /dev/null 2>&1
log_success "Solana CLI configured for localhost"

################################################################################
# Step 3: Build and Deploy Anchor Program
################################################################################

log_info "Building Anchor program..."
cd anchor_project/the_fool

# Build the program
if ! anchor build; then
    log_error "Failed to build Anchor program"
    exit 1
fi
log_success "Anchor program built"

log_info "Deploying program to localnet..."
if ! anchor deploy; then
    log_error "Failed to deploy program"
    exit 1
fi
log_success "Program deployed"

# Get program ID
PROGRAM_ID=$(anchor keys list | grep "dive_game" | awk '{print $2}')
log_success "Program ID: $PROGRAM_ID"

################################################################################
# Step 4: Initialize GameConfig and HouseVault
################################################################################

log_info "Initializing GameConfig and HouseVault..."

# Check if ts-node is available
if ! command -v ts-node &> /dev/null; then
    log_warning "ts-node not found, installing locally..."
    npm install --save-dev ts-node typescript
fi

# Run initialization script
if ! npm run init-localnet; then
    log_error "Failed to initialize contracts"
    exit 1
fi
log_success "Contracts initialized"

################################################################################
# Step 5: Verify Deployment
################################################################################

log_info "Verifying deployment..."

# Get keypair path
KEYPAIR_PATH="$HOME/.config/solana/id.json"
if [ ! -f "$KEYPAIR_PATH" ]; then
    log_error "Keypair not found at $KEYPAIR_PATH"
    exit 1
fi

# Get public key
PUBKEY=$(solana-keygen pubkey "$KEYPAIR_PATH")
log_success "Using keypair: $PUBKEY"

# Check balance
BALANCE=$(solana balance --url localhost)
log_success "Balance: $BALANCE"

# Airdrop if needed
if [[ "$BALANCE" == "0 SOL" ]]; then
    log_info "Airdropping 10 SOL..."
    solana airdrop 10 --url localhost
    log_success "Airdrop complete"
fi

################################################################################
# Step 6: Test Connection from Frontend
################################################################################

log_info "Testing frontend connection..."
cd ../../frontend/the_fool

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    log_info "Installing frontend dependencies..."
    npm install
fi

# Run connection test
if node test-solana-chain.mjs; then
    log_success "Frontend connection test passed"
else
    log_warning "Frontend connection test had issues (check output above)"
fi

################################################################################
# Done!
################################################################################

cd ../..

echo ""
echo "═══════════════════════════════════════════════════════════════"
log_success "Setup complete! 🎉"
echo "═══════════════════════════════════════════════════════════════"
echo ""
log_info "Next steps:"
echo ""
echo "  1. Start the frontend:"
echo "     cd frontend/the_fool"
echo "     npm run dev:solana"
echo ""
echo "  2. Open http://localhost:3000 in your browser"
echo ""
echo "  3. Connect your wallet:"
echo "     - Install Phantom wallet extension"
echo "     - Switch to Localnet in settings"
echo "     - Airdrop SOL: solana airdrop 10 <ADDRESS> --url localhost"
echo ""
echo "  4. Play the game!"
echo ""
log_info "Configuration:"
echo "  - Program ID: $PROGRAM_ID"
echo "  - RPC URL: http://localhost:8899"
echo "  - Network: Localnet"
echo ""
log_info "Useful commands:"
echo "  - View logs: solana logs --url localhost"
echo "  - Check balance: solana balance --url localhost"
echo "  - Stop validator: pkill solana-test-validator"
echo "  - Restart setup: ./setup-localnet.sh"
echo ""
