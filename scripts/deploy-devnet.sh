#!/bin/bash
#
# Complete Devnet Deployment Script
# This script handles end-to-end deployment to Solana devnet and Vercel
#

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
NETWORK="devnet"
RPC_URL="https://api.devnet.solana.com"
MIN_BALANCE=3.0  # Minimum SOL needed for deployment

echo ""
echo "======================================"
echo "  Devnet Deployment Script"
echo "======================================"
echo ""

# Step 1: Check prerequisites
echo -e "${BLUE}Step 1: Checking prerequisites...${NC}"

# Check if solana CLI is installed
if ! command -v solana &> /dev/null; then
    echo -e "${RED}ERROR: Solana CLI not found${NC}"
    echo "Install from: https://docs.solana.com/cli/install-solana-cli-tools"
    exit 1
fi

# Check if anchor CLI is installed
if ! command -v anchor &> /dev/null; then
    echo -e "${RED}ERROR: Anchor CLI not found${NC}"
    echo "Install from: https://www.anchor-lang.com/docs/installation"
    exit 1
fi

# Check if vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    echo -e "${RED}ERROR: Vercel CLI not found${NC}"
    echo "Install: npm install -g vercel"
    exit 1
fi

echo -e "${GREEN}✓ All prerequisites installed${NC}"

# Step 2: Check wallet balance
echo ""
echo -e "${BLUE}Step 2: Checking wallet balance...${NC}"

BALANCE=$(solana balance --url $RPC_URL | awk '{print $1}')
echo "Current balance: $BALANCE SOL"

if (( $(echo "$BALANCE < $MIN_BALANCE" | bc -l) )); then
    echo -e "${YELLOW}WARNING: Low balance (need ~${MIN_BALANCE} SOL for deployment)${NC}"
    echo ""
    echo "Get devnet SOL from:"
    echo "  - https://faucet.solana.com"
    echo "  - solana airdrop 5 --url $RPC_URL"
    echo ""
    read -p "Continue anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Step 3: Build and deploy program
echo ""
echo -e "${BLUE}Step 3: Building and deploying program...${NC}"

cd "$(dirname "$0")/../anchor_project/the_fool"

echo "Building program..."
if ! anchor build; then
    echo -e "${RED}ERROR: Build failed${NC}"
    exit 1
fi

echo "Deploying to devnet..."
if ! anchor deploy --provider.cluster devnet; then
    echo -e "${RED}ERROR: Deployment failed${NC}"
    exit 1
fi

# Extract program ID
PROGRAM_KEYPAIR_PATH="target/deploy/dive_game-keypair.json"
PROGRAM_ID=$(solana address -k "$PROGRAM_KEYPAIR_PATH")

echo -e "${GREEN}✓ Program deployed${NC}"
echo "Program ID: $PROGRAM_ID"

# Step 4: Sync IDL to frontend
echo ""
echo -e "${BLUE}Step 4: Syncing IDL to frontend...${NC}"

cd "$(dirname "$0")/.."
if bash scripts/sync-idl.sh; then
    echo -e "${GREEN}✓ IDL synced${NC}"
else
    echo -e "${YELLOW}WARNING: IDL sync failed${NC}"
fi

# Step 5: Initialize game on-chain
echo ""
echo -e "${BLUE}Step 5: Initializing game on devnet...${NC}"

cd anchor_project/the_fool

# Run init script
if RPC_URL=$RPC_URL npx ts-node scripts/init-localnet.ts; then
    echo -e "${GREEN}✓ Game initialized${NC}"
else
    echo -e "${RED}ERROR: Initialization failed${NC}"
    exit 1
fi

# Get PDAs for reference
WALLET_ADDRESS=$(solana address)
CONFIG_PDA=$(solana address -k <(echo '[0]') --program $PROGRAM_ID --seed "game_config" 2>/dev/null || echo "N/A")
VAULT_PDA=$(solana address -k <(echo '[0]') --program $PROGRAM_ID --seed "house_vault" --seed "$WALLET_ADDRESS" 2>/dev/null || echo "N/A")

# Step 6: Update frontend environment
echo ""
echo -e "${BLUE}Step 6: Updating frontend configuration...${NC}"

cd "$(dirname "$0")/../frontend/the_fool"

# Update .env.local
cat > .env.local << EOF
# Solana Devnet Configuration
NEXT_PUBLIC_USE_SOLANA=true
NEXT_PUBLIC_RPC_URL=$RPC_URL
NEXT_PUBLIC_PROGRAM_ID=$PROGRAM_ID
NEXT_PUBLIC_HOUSE_AUTHORITY=$WALLET_ADDRESS
EOF

echo -e "${GREEN}✓ Frontend .env.local updated${NC}"

# Step 7: Update Vercel environment variables
echo ""
echo -e "${BLUE}Step 7: Updating Vercel environment...${NC}"

# Remove old variables
vercel env rm NEXT_PUBLIC_PROGRAM_ID production --yes 2>/dev/null || true
vercel env rm NEXT_PUBLIC_HOUSE_AUTHORITY production --yes 2>/dev/null || true
vercel env rm NEXT_PUBLIC_RPC_URL production --yes 2>/dev/null || true

# Add new variables (use printf to prevent any extra characters)
printf '%s' "$PROGRAM_ID" | vercel env add NEXT_PUBLIC_PROGRAM_ID production
printf '%s' "$WALLET_ADDRESS" | vercel env add NEXT_PUBLIC_HOUSE_AUTHORITY production
printf '%s' "$RPC_URL" | vercel env add NEXT_PUBLIC_RPC_URL production

echo -e "${GREEN}✓ Vercel environment updated${NC}"

# Step 8: Deploy to Vercel
echo ""
echo -e "${BLUE}Step 8: Deploying frontend to Vercel...${NC}"

if vercel --prod --yes; then
    echo -e "${GREEN}✓ Frontend deployed${NC}"
else
    echo -e "${RED}ERROR: Vercel deployment failed${NC}"
    exit 1
fi

# Get production URL
PROD_URL=$(vercel ls 2>&1 | grep "Production" | head -1 | awk '{print $2}')

# Step 9: Summary
echo ""
echo "======================================"
echo -e "${GREEN}✓ Deployment Complete!${NC}"
echo "======================================"
echo ""
echo "Deployment Summary:"
echo "-----------------------------------"
echo "Network:          $NETWORK"
echo "RPC URL:          $RPC_URL"
echo "Program ID:       $PROGRAM_ID"
echo "House Authority:  $WALLET_ADDRESS"
echo "Frontend URL:     $PROD_URL"
echo ""
echo "Solana Explorer:"
echo "  Program:        https://explorer.solana.com/address/$PROGRAM_ID?cluster=devnet"
if [ "$CONFIG_PDA" != "N/A" ]; then
    echo "  Config:         https://explorer.solana.com/address/$CONFIG_PDA?cluster=devnet"
fi
if [ "$VAULT_PDA" != "N/A" ]; then
    echo "  Vault:          https://explorer.solana.com/address/$VAULT_PDA?cluster=devnet"
fi
echo ""
echo "Next Steps:"
echo "  1. Get devnet SOL: https://faucet.solana.com"
echo "  2. Test the game at: $PROD_URL"
echo "  3. Check logs: vercel logs"
echo ""
