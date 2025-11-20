#!/bin/bash

################################################################################
# Dive Game - Unified Development Script
################################################################################
#
# This script handles EVERYTHING:
# - Validator setup (start/restart/clean)
# - Program build & deploy
# - Game config & vault initialization
# - Frontend development server
# - Log streaming
#
# Usage:
#   ./dev.sh          # Start everything (idempotent)
#   ./dev.sh --clean  # Clean restart (kills everything, rebuilds)
#   ./dev.sh --local  # Use LocalGameChain (no Solana)
#   ./dev.sh --help   # Show this help
#
################################################################################

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

# Directories
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ANCHOR_DIR="$PROJECT_ROOT/anchor_project/the_fool"
FRONTEND_DIR="$PROJECT_ROOT/frontend/the_fool"
SCRIPTS_DIR="$PROJECT_ROOT/scripts"

# Log files
VALIDATOR_LOG="/tmp/dive-validator.log"
FRONTEND_LOG="/tmp/dive-frontend.log"

# Parse arguments
CLEAN_START=true  # Default to clean start
USE_LOCAL=false
SHOW_HELP=false

for arg in "$@"; do
    case $arg in
        --no-clean) CLEAN_START=false ;;  # Allow opting out of clean start
        --local) USE_LOCAL=true ;;
        --help|-h) SHOW_HELP=true ;;
        *) echo -e "${RED}Unknown argument: $arg${NC}"; exit 1 ;;
    esac
done

################################################################################
# Help
################################################################################

if [ "$SHOW_HELP" = true ]; then
    cat << 'EOF'
Dive Game - Unified Development Script

USAGE:
    ./dev.sh [OPTIONS]

OPTIONS:
    --no-clean  Skip clean restart (reuse existing validator state)
    --local     Use LocalGameChain instead of real Solana blockchain
    --help, -h  Show this help message

WHAT IT DOES:
    1. ALWAYS does a clean restart (stops validator, cleans ledger)
    2. Starts fresh validator
    3. Builds and deploys Anchor program
    4. Initializes game config and house vault
    5. Updates frontend .env.local
    6. Starts Next.js dev server
    7. Shows live logs in a split view

EXAMPLES:
    # Normal usage (clean start - DEFAULT):
    ./dev.sh

    # Reuse existing validator state (faster, but may have stale data):
    ./dev.sh --no-clean

    # Test without blockchain:
    ./dev.sh --local

LOGS:
    Validator:  /tmp/dive-validator.log
    Frontend:   /tmp/dive-frontend.log

STOP:
    Press Ctrl+C to stop (cleans up processes)

MORE INFO:
    See README.md or SETUP_FIXES.md for details.

EOF
    exit 0
fi

################################################################################
# Pre-flight Checks
################################################################################

check_command() {
    if ! command -v $1 &> /dev/null; then
        echo -e "${RED}ERROR: $1 not found${NC}"
        echo -e "${YELLOW}Please install: $2${NC}"
        exit 1
    fi
}

if [ "$USE_LOCAL" = false ]; then
    check_command "solana" "Solana CLI (sh -c \"\$(curl -sSfL https://release.solana.com/stable/install)\")"
    check_command "solana-test-validator" "Solana CLI tools"
    check_command "anchor" "Anchor framework (cargo install --git https://github.com/coral-xyz/anchor avm --locked --force)"
fi

check_command "node" "Node.js (https://nodejs.org)"
check_command "npm" "npm (comes with Node.js)"

################################################################################
# Header
################################################################################

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}🌊 Dive Game - Development Environment${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${CYAN}Project: ${NC}$PROJECT_ROOT"
echo -e "${CYAN}Mode:    ${NC}$([ "$USE_LOCAL" = true ] && echo "LocalGameChain (No Solana)" || echo "Solana Localnet")"
echo -e "${CYAN}Clean:   ${NC}$([ "$CLEAN_START" = true ] && echo "Yes (DEFAULT)" || echo "No (--no-clean)")"
echo ""

################################################################################
# Cleanup on Exit
################################################################################

cleanup() {
    echo ""
    echo -e "${YELLOW}🧹 Cleaning up...${NC}"
    
    # Kill frontend dev server
    pkill -f "next dev" 2>/dev/null || true
    
    # Only kill validator if doing a clean start
    if [ "$CLEAN_START" = true ]; then
        pkill -9 solana-test-validator 2>/dev/null || true
        echo -e "${GREEN}   OK: Stopped all processes${NC}"
    else
        echo -e "${GREEN}   OK: Stopped frontend (validator still running)${NC}"
    fi
    
    exit 0
}

trap cleanup SIGINT SIGTERM

################################################################################
# Step 1: Validator Setup
################################################################################

if [ "$USE_LOCAL" = false ]; then
    echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${YELLOW}Step 1: Validator Setup${NC}"
    echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""

    # Check if validator is running
    VALIDATOR_RUNNING=false
    if pgrep -f solana-test-validator > /dev/null 2>&1; then
        VALIDATOR_RUNNING=true
    fi

    if [ "$CLEAN_START" = true ]; then
        echo -e "${BLUE}🔄 Clean start requested - stopping existing validator...${NC}"
        pkill -9 solana-test-validator 2>/dev/null || true
        sleep 2
        
        # Clean ledger
        echo -e "${BLUE}🧹 Cleaning ledger data...${NC}"
        rm -rf "$ANCHOR_DIR/test-ledger" 2>/dev/null || true
        rm -rf ~/.local/share/solana/test-ledger 2>/dev/null || true
        
        VALIDATOR_RUNNING=false
        echo -e "${GREEN}   OK: Cleaned${NC}"
        echo ""
    fi

    if [ "$VALIDATOR_RUNNING" = true ]; then
        echo -e "${GREEN}OK: Validator already running${NC}"
        VALIDATOR_PID=$(pgrep -f solana-test-validator)
        echo -e "${CYAN}   PID: $VALIDATOR_PID${NC}"
    else
        echo -e "${BLUE}>>> Starting validator...${NC}"
        cd "$ANCHOR_DIR"
        # Filter out repetitive slot status logs
        solana-test-validator --reset 2>&1 | grep -v "Processed Slot:" > "$VALIDATOR_LOG" &
        VALIDATOR_PID=$!
        echo -e "${CYAN}   PID: $VALIDATOR_PID${NC}"
        cd "$PROJECT_ROOT"
        
        # Wait for validator to be ready
        echo -n "   Waiting for validator"
        for i in {1..20}; do
            sleep 1
            echo -n "."
            if solana cluster-version > /dev/null 2>&1; then
                echo ""
                echo -e "${GREEN}   OK: Validator ready${NC}"
                break
            fi
            if [ $i -eq 20 ]; then
                echo ""
                echo -e "${RED}   ERROR: Validator failed to start (timeout)${NC}"
                echo -e "${YELLOW}   Check logs: tail -f $VALIDATOR_LOG${NC}"
                exit 1
            fi
        done
    fi
    echo ""
fi

################################################################################
# Step 2: Build & Deploy Program
################################################################################

if [ "$USE_LOCAL" = false ]; then
    echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${YELLOW}Step 2: Build & Deploy Program${NC}"
    echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""

    # Check if program needs rebuilding
    NEED_BUILD=true
    PROGRAM_SO="$ANCHOR_DIR/target/deploy/dive_game.so"
    if [ -f "$PROGRAM_SO" ] && [ "$CLEAN_START" = false ]; then
        # Check if source files are newer than binary
        NEWEST_SOURCE=$(find "$ANCHOR_DIR/programs" -type f -name "*.rs" -exec stat -f "%m" {} \; | sort -n | tail -1)
        BINARY_TIME=$(stat -f "%m" "$PROGRAM_SO")
        if [ "$BINARY_TIME" -gt "$NEWEST_SOURCE" ]; then
            NEED_BUILD=false
        fi
    fi

    if [ "$NEED_BUILD" = true ]; then
        echo -e "${BLUE}🔨 Building program...${NC}"
        cd "$ANCHOR_DIR"
        anchor build
        echo -e "${GREEN}   OK: Built${NC}"
        echo ""
        
        # Sync IDL to frontend
        echo -e "${BLUE}📋 Syncing IDL to frontend...${NC}"
        cd "$PROJECT_ROOT"
        bash "$SCRIPTS_DIR/sync-idl.sh"
        echo -e "${GREEN}   OK: IDL synced${NC}"
        echo ""
        
        # Deploy program
        echo -e "${BLUE}>>> Deploying program...${NC}"
        cd "$ANCHOR_DIR"
        DEPLOY_OUTPUT=$(anchor deploy --provider.cluster localnet 2>&1)
        PROGRAM_ID=$(echo "$DEPLOY_OUTPUT" | grep "Program Id:" | awk '{print $3}')
        echo -e "${CYAN}   Program ID: $PROGRAM_ID${NC}"
        echo -e "${GREEN}   OK: Deployed${NC}"
        cd "$PROJECT_ROOT"
    else
        echo -e "${GREEN}OK: Program up to date (no rebuild needed)${NC}"
        # Get existing program ID
        PROGRAM_ID=$(solana address -k "$ANCHOR_DIR/target/deploy/dive_game-keypair.json" 2>/dev/null || echo "")
        if [ -n "$PROGRAM_ID" ]; then
            echo -e "${CYAN}   Program ID: $PROGRAM_ID${NC}"
        fi
    fi
    echo ""
fi

################################################################################
# Step 3: Initialize Game Config & Vault
################################################################################

if [ "$USE_LOCAL" = false ]; then
    echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${YELLOW}Step 3: Initialize Game Config & Vault (Idempotent)${NC}"
    echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""

    # Run initialization script
    echo -e "${BLUE}⚙️  Running initialization...${NC}"
    
    # Run the comprehensive init script that handles both config and vault
    INIT_OUTPUT="/tmp/dive-init.log"
    cd "$ANCHOR_DIR"
    
    # Install dependencies if needed
    if [ ! -d "node_modules" ]; then
        echo -e "${BLUE}📦 Installing dependencies...${NC}"
        npm install > /dev/null 2>&1
        echo -e "${GREEN}   OK: Dependencies installed${NC}"
    fi
    
    npm run init-localnet > "$INIT_OUTPUT" 2>&1
    INIT_EXIT_CODE=$?
    
    # Show init output (filter noise)
    grep -E "(Launch:|Step |OK:|ERROR:|Amount:|Config PDA:|Vault PDA:|House Authority:|Program ID:)" "$INIT_OUTPUT" || cat "$INIT_OUTPUT"
    echo ""
    
    if [ $INIT_EXIT_CODE -eq 0 ]; then
        # Parse output for house authority
        HOUSE_AUTH=$(grep "House Authority:" "$INIT_OUTPUT" | awk '{print $3}' | head -1)
        if [ -z "$HOUSE_AUTH" ]; then
            HOUSE_AUTH=$(solana address ~/.config/solana/id.json 2>/dev/null || echo "")
        fi
        echo -e "${GREEN}   ✅ Initialization complete${NC}"
    else
        echo -e "${YELLOW}   ⚠️  Initialization had issues (might be already initialized)${NC}"
        echo -e "${CYAN}   💡 This is usually OK if you've run this before${NC}"
        HOUSE_AUTH=$(solana address ~/.config/solana/id.json 2>/dev/null || echo "")
    fi
    
    cd "$PROJECT_ROOT"
    echo ""
fi

################################################################################
# Step 4: Update Frontend Environment
################################################################################

echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}Step 4: Update Frontend Configuration${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

ENV_FILE="$FRONTEND_DIR/.env.local"

# Backup if exists
if [ -f "$ENV_FILE" ]; then
    cp "$ENV_FILE" "${ENV_FILE}.backup.$(date +%s)" 2>/dev/null || true
fi

if [ "$USE_LOCAL" = true ]; then
    cat > "$ENV_FILE" << EOF
# LocalGameChain Mode (No Solana)
NEXT_PUBLIC_USE_SOLANA=false
NEXT_PUBLIC_RPC_URL=http://localhost:8899
NEXT_PUBLIC_PROGRAM_ID=9GxDuBwkkzJWe7ij6xrYv5FFAuqkDW5hjtripZAJgKb7
NEXT_PUBLIC_HOUSE_AUTHORITY=7qdd7r1CJdnXVcr3bFD5CyBRyDF9eW4taoJqABhN5hXW
EOF
    echo -e "${CYAN}   Mode: LocalGameChain${NC}"
else
    PROGRAM_ID=${PROGRAM_ID:-"9GxDuBwkkzJWe7ij6xrYv5FFAuqkDW5hjtripZAJgKb7"}
    HOUSE_AUTH=${HOUSE_AUTH:-"7qdd7r1CJdnXVcr3bFD5CyBRyDF9eW4taoJqABhN5hXW"}
    
    cat > "$ENV_FILE" << EOF
# Solana Localnet Mode
NEXT_PUBLIC_USE_SOLANA=true
NEXT_PUBLIC_RPC_URL=http://localhost:8899
NEXT_PUBLIC_PROGRAM_ID=$PROGRAM_ID
NEXT_PUBLIC_HOUSE_AUTHORITY=$HOUSE_AUTH
EOF
    echo -e "${CYAN}   Mode: Solana Localnet${NC}"
    echo -e "${CYAN}   Program ID: $PROGRAM_ID${NC}"
    echo -e "${CYAN}   House Authority: $HOUSE_AUTH${NC}"
fi

echo -e "${GREEN}   OK: Configuration updated${NC}"
echo ""

################################################################################
# Step 5: Start Frontend
################################################################################

echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}Step 5: Start Frontend${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Kill any existing frontend process
pkill -f "next dev" 2>/dev/null || true
sleep 1

echo -e "${BLUE}>>> Starting Next.js dev server...${NC}"
cd "$FRONTEND_DIR"
npm run dev:$([ "$USE_LOCAL" = true ] && echo "local" || echo "solana") > "$FRONTEND_LOG" 2>&1 &
FRONTEND_PID=$!
cd "$PROJECT_ROOT"

# Wait for frontend to be ready
echo -n "   Waiting for frontend"
for i in {1..30}; do
    sleep 1
    echo -n "."
    if curl -s http://localhost:3000 > /dev/null 2>&1; then
        echo ""
        echo -e "${GREEN}   OK: Frontend ready${NC}"
        echo -e "${CYAN}   URL: http://localhost:3000${NC}"
        break
    fi
    if [ $i -eq 30 ]; then
        echo ""
        echo -e "${RED}   ERROR: Frontend failed to start (timeout)${NC}"
        echo -e "${YELLOW}   Check logs: tail -f $FRONTEND_LOG${NC}"
        exit 1
    fi
done
echo ""

################################################################################
# Step 6: Show Status & Logs
################################################################################

echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✨ Development Environment Ready!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${BLUE}🚀 Status:${NC}"
if [ "$USE_LOCAL" = false ]; then
    echo -e "   ${GREEN}●${NC} Validator:   Running (PID: ${VALIDATOR_PID:-unknown})"
    echo -e "   ${GREEN}●${NC} Program:     Deployed"
    echo -e "   ${GREEN}●${NC} Config:      Initialized"
    echo -e "   ${GREEN}●${NC} Vault:       Funded"
fi
echo -e "   ${GREEN}●${NC} Frontend:    Running (PID: $FRONTEND_PID)"
echo ""
echo -e "${BLUE}🌐 URLs:${NC}"
echo -e "   Frontend:    ${CYAN}http://localhost:3000${NC}"
if [ "$USE_LOCAL" = false ]; then
    echo -e "   RPC:         ${CYAN}http://localhost:8899${NC}"
    echo -e "   Explorer:    ${CYAN}https://explorer.solana.com/?cluster=custom&customUrl=http://localhost:8899${NC}"
fi
echo ""
echo -e "${BLUE}📋 Logs:${NC}"
if [ "$USE_LOCAL" = false ]; then
    echo -e "   Validator:   ${CYAN}$VALIDATOR_LOG${NC}"
fi
echo -e "   Frontend:    ${CYAN}$FRONTEND_LOG${NC}"
echo ""
echo -e "${BLUE}🎮 Getting Started:${NC}"
echo "   1. Open ${CYAN}http://localhost:3000${NC} in your browser"
echo "   2. Connect your Phantom wallet:"
echo "      ${CYAN}→ Settings → Change Network → Localhost${NC}"
echo "   3. Use the ${YELLOW}Airdrop Panel${NC} to get test SOL"
echo "   4. Click ${GREEN}Start Game${NC} to play!"
echo ""
echo -e "${YELLOW}💡 Tips:${NC}"
echo "   • ${RED}Ctrl+C${NC} to stop everything"
echo "   • ${GREEN}Clean restart is DEFAULT${NC} (always fresh state)"
echo "   • ${CYAN}./dev.sh --no-clean${NC} to reuse existing validator"
echo "   • ${CYAN}./dev.sh --local${NC} to test without Solana"
echo "   • ${CYAN}./dev.sh --help${NC} for more options"
echo ""
echo -e "${BLUE}📊 Game Config:${NC}"
echo "   • Fixed Bet: ${CYAN}0.01 SOL${NC} (10M lamports)"
echo "   • Max Dives: ${CYAN}5${NC}"
echo "   • Max Payout: ${CYAN}1 SOL${NC} (100x multiplier)"
echo "   • Session Timeout: ${CYAN}5 minutes${NC}"
echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}📡 Streaming Logs (Ctrl+C to stop)...${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Stream logs in split view
if [ "$USE_LOCAL" = false ]; then
    # Show both validator and frontend logs
    tail -f "$VALIDATOR_LOG" "$FRONTEND_LOG" 2>/dev/null | while IFS= read -r line; do
        if [[ "$line" == "==>"* ]]; then
            # File header from tail -f
            echo -e "${BLUE}$line${NC}"
        elif [[ "$line" == *"Program log:"* ]]; then
            # Solana program logs
            echo -e "${YELLOW}$line${NC}"
        elif [[ "$line" == *"[ERROR]"* ]] || [[ "$line" == *"ERROR"* ]]; then
            echo -e "${RED}$line${NC}"
        elif [[ "$line" == *"[WARN]"* ]] || [[ "$line" == *"WARN"* ]]; then
            echo -e "${YELLOW}$line${NC}"
        else
            echo "$line"
        fi
    done
else
    # Local mode - only frontend logs
    tail -f "$FRONTEND_LOG" 2>/dev/null | while IFS= read -r line; do
        if [[ "$line" == *"[ERROR]"* ]] || [[ "$line" == *"ERROR"* ]]; then
            echo -e "${RED}$line${NC}"
        elif [[ "$line" == *"[WARN]"* ]] || [[ "$line" == *"WARN"* ]]; then
            echo -e "${YELLOW}$line${NC}"
        else
            echo "$line"
        fi
    done
fi
