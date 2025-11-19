#!/bin/bash

# Fresh Setup Script
# Completely resets and redeploys everything for a clean start

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}>>> Fresh Setup - Dive Game${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Step 1: Kill existing validator
echo -e "${YELLOW}1️⃣  Stopping existing validator...${NC}"
pkill -9 solana-test-validator 2>/dev/null || true
sleep 2
echo -e "${GREEN}   OK: Validator stopped${NC}"
echo ""

# Step 2: Clean ledger
echo -e "${YELLOW}2️⃣  Cleaning ledger data...${NC}"
rm -rf anchor_project/the_fool/test-ledger 2>/dev/null || true
rm -rf ~/.local/share/solana/test-ledger 2>/dev/null || true
echo -e "${GREEN}   OK: Ledger cleaned${NC}"
echo ""

# Step 3: Start fresh validator
echo -e "${YELLOW}3️⃣  Starting fresh validator...${NC}"
cd anchor_project/the_fool
solana-test-validator --reset > /tmp/validator.log 2>&1 &
VALIDATOR_PID=$!
echo "   Validator PID: $VALIDATOR_PID"
cd ../..

# Wait for validator to be ready
echo -n "   Waiting for validator"
for i in {1..10}; do
    sleep 1
    echo -n "."
    if solana cluster-version > /dev/null 2>&1; then
        echo ""
        echo -e "${GREEN}   OK: Validator ready${NC}"
        break
    fi
done
echo ""

# Step 4: Build program
echo -e "${YELLOW}4️⃣  Building Anchor program...${NC}"
cd anchor_project/the_fool
anchor build > /dev/null 2>&1
echo -e "${GREEN}   OK: Program built${NC}"
echo ""

# Step 5: Sync IDL
echo -e "${YELLOW}5️⃣  Syncing IDL to frontend...${NC}"
cd ../..
npm run sync-idl > /dev/null 2>&1
echo -e "${GREEN}   OK: IDL synced${NC}"
echo ""

# Step 6: Deploy program
echo -e "${YELLOW}6️⃣  Deploying program...${NC}"
cd anchor_project/the_fool
DEPLOY_OUTPUT=$(anchor deploy --provider.cluster localnet 2>&1)
PROGRAM_ID=$(echo "$DEPLOY_OUTPUT" | grep "Program Id:" | awk '{print $3}')
echo "   Program ID: $PROGRAM_ID"
echo -e "${GREEN}   OK: Program deployed${NC}"
echo ""

# Step 7: Initialize
echo -e "${YELLOW}7️⃣  Initializing game config and vault...${NC}"
npm run init-localnet > /tmp/init-output.txt 2>&1
if [ $? -eq 0 ]; then
    CONFIG_PDA=$(grep "Config PDA:" /tmp/init-output.txt | awk '{print $3}')
    VAULT_PDA=$(grep "Vault PDA:" /tmp/init-output.txt | awk '{print $3}')
    HOUSE_AUTH=$(grep "House Authority:" /tmp/init-output.txt | tail -1 | awk '{print $3}')
    
    echo "   Config PDA: $CONFIG_PDA"
    echo "   Vault PDA: $VAULT_PDA"
    echo "   House Authority: $HOUSE_AUTH"
    echo -e "${GREEN}   OK: Initialized${NC}"
else
    echo -e "${RED}   ERROR: Initialization failed${NC}"
    cat /tmp/init-output.txt
    exit 1
fi
echo ""
cd ../..

# Step 8: Update .env.local
echo -e "${YELLOW}8️⃣  Updating frontend .env.local...${NC}"
ENV_FILE="frontend/the_fool/.env.local"

# Backup existing .env.local
if [ -f "$ENV_FILE" ]; then
    cp "$ENV_FILE" "${ENV_FILE}.backup"
    echo -e "${BLUE}   📋 Backed up to .env.local.backup${NC}"
fi

# Update or create .env.local
cat > "$ENV_FILE" << EOF
# Solana Configuration (Localnet)
NEXT_PUBLIC_USE_SOLANA=true
NEXT_PUBLIC_PROGRAM_ID=$PROGRAM_ID
NEXT_PUBLIC_HOUSE_AUTHORITY=$HOUSE_AUTH
NEXT_PUBLIC_RPC_URL=http://localhost:8899
NEXT_PUBLIC_CONFIG_PDA=$CONFIG_PDA
NEXT_PUBLIC_VAULT_PDA=$VAULT_PDA

# Development Settings
# Set to "false" to use LocalGameChain instead of real Solana
EOF

echo -e "${GREEN}   OK: .env.local updated${NC}"
echo ""

# Step 9: Success summary
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}>>> Setup Complete!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${BLUE}📋 Configuration:${NC}"
echo "   Program ID:      $PROGRAM_ID"
echo "   Config PDA:      $CONFIG_PDA"
echo "   Vault PDA:       $VAULT_PDA"
echo "   House Authority: $HOUSE_AUTH"
echo ""
echo -e "${BLUE}>>> Next Steps:${NC}"
echo "   1. Start frontend: cd frontend/the_fool && npm run dev"
echo "   2. Open browser: http://localhost:3000"
echo "   3. Connect wallet (Phantom/Solflare to Localhost)"
echo "   4. Request airdrop via Network panel"
echo "   5. Play!"
echo ""
echo -e "${YELLOW}💡 Tips:${NC}"
echo "   • Validator running in background (PID: $VALIDATOR_PID)"
echo "   • View logs: tail -f /tmp/validator.log"
echo "   • Stop validator: pkill solana-test-validator"
echo "   • Re-run setup: ./setup-fresh.sh"
echo ""
