#!/bin/bash
#
# Deployment Verification Script
# Validates that local and Vercel environments are correctly configured
#

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo ""
echo "======================================"
echo "  Deployment Verification"
echo "======================================"
echo ""

ERRORS=0

# Check local .env.local
echo -e "${BLUE}Checking local environment (.env.local)...${NC}"

ENV_FILE="$(dirname "$0")/../frontend/the_fool/.env.local"

if [ ! -f "$ENV_FILE" ]; then
    echo -e "${RED}✗ .env.local not found${NC}"
    ERRORS=$((ERRORS + 1))
else
    LOCAL_PROGRAM_ID=$(grep NEXT_PUBLIC_PROGRAM_ID "$ENV_FILE" | cut -d'=' -f2)
    LOCAL_RPC_URL=$(grep NEXT_PUBLIC_RPC_URL "$ENV_FILE" | cut -d'=' -f2)
    LOCAL_HOUSE=$(grep NEXT_PUBLIC_HOUSE_AUTHORITY "$ENV_FILE" | cut -d'=' -f2)
    
    echo "  NEXT_PUBLIC_PROGRAM_ID:        $LOCAL_PROGRAM_ID"
    echo "  NEXT_PUBLIC_RPC_URL:           $LOCAL_RPC_URL"
    echo "  NEXT_PUBLIC_HOUSE_AUTHORITY:   $LOCAL_HOUSE"
    
    if [ -z "$LOCAL_PROGRAM_ID" ]; then
        echo -e "${RED}  ✗ NEXT_PUBLIC_PROGRAM_ID is empty${NC}"
        ERRORS=$((ERRORS + 1))
    fi
    
    if [ -z "$LOCAL_RPC_URL" ]; then
        echo -e "${RED}  ✗ NEXT_PUBLIC_RPC_URL is empty${NC}"
        ERRORS=$((ERRORS + 1))
    fi
    
    if [ -z "$LOCAL_HOUSE" ]; then
        echo -e "${RED}  ✗ NEXT_PUBLIC_HOUSE_AUTHORITY is empty${NC}"
        ERRORS=$((ERRORS + 1))
    fi
fi

echo ""

# Check Vercel environment
echo -e "${BLUE}Checking Vercel environment...${NC}"

cd "$(dirname "$0")/../frontend/the_fool"

# Pull Vercel env vars
if vercel env pull .env.verify 2>/dev/null; then
    VERCEL_PROGRAM_ID=$(grep NEXT_PUBLIC_PROGRAM_ID .env.verify | cut -d'=' -f2 | tr -d '"')
    VERCEL_RPC_URL=$(grep NEXT_PUBLIC_RPC_URL .env.verify | cut -d'=' -f2 | tr -d '"')
    VERCEL_HOUSE=$(grep NEXT_PUBLIC_HOUSE_AUTHORITY .env.verify | cut -d'=' -f2 | tr -d '"')
    
    echo "  NEXT_PUBLIC_PROGRAM_ID:        $VERCEL_PROGRAM_ID"
    echo "  NEXT_PUBLIC_RPC_URL:           $VERCEL_RPC_URL"
    echo "  NEXT_PUBLIC_HOUSE_AUTHORITY:   $VERCEL_HOUSE"
    
    rm .env.verify
else
    echo -e "${RED}  ✗ Could not fetch Vercel environment${NC}"
    ERRORS=$((ERRORS + 1))
fi

echo ""

# Compare local vs Vercel
if [ -n "$LOCAL_PROGRAM_ID" ] && [ -n "$VERCEL_PROGRAM_ID" ]; then
    if [ "$LOCAL_PROGRAM_ID" != "$VERCEL_PROGRAM_ID" ]; then
        echo -e "${RED}✗ MISMATCH: Local and Vercel PROGRAM_ID differ!${NC}"
        echo "  Local:  $LOCAL_PROGRAM_ID"
        echo "  Vercel: $VERCEL_PROGRAM_ID"
        ERRORS=$((ERRORS + 1))
    else
        echo -e "${GREEN}✓ PROGRAM_ID matches${NC}"
    fi
fi

if [ -n "$LOCAL_RPC_URL" ] && [ -n "$VERCEL_RPC_URL" ]; then
    if [ "$LOCAL_RPC_URL" != "$VERCEL_RPC_URL" ]; then
        echo -e "${YELLOW}⚠ WARNING: Local and Vercel RPC_URL differ${NC}"
        echo "  Local:  $LOCAL_RPC_URL"
        echo "  Vercel: $VERCEL_RPC_URL"
    else
        echo -e "${GREEN}✓ RPC_URL matches${NC}"
    fi
fi

if [ -n "$LOCAL_HOUSE" ] && [ -n "$VERCEL_HOUSE" ]; then
    if [ "$LOCAL_HOUSE" != "$VERCEL_HOUSE" ]; then
        echo -e "${RED}✗ MISMATCH: Local and Vercel HOUSE_AUTHORITY differ!${NC}"
        echo "  Local:  $LOCAL_HOUSE"
        echo "  Vercel: $VERCEL_HOUSE"
        ERRORS=$((ERRORS + 1))
    else
        echo -e "${GREEN}✓ HOUSE_AUTHORITY matches${NC}"
    fi
fi

echo ""

# Check deployed program on Solana
if [ -n "$LOCAL_PROGRAM_ID" ] && [ -n "$LOCAL_RPC_URL" ]; then
    echo -e "${BLUE}Checking program on Solana...${NC}"
    
    # Extract cluster from RPC URL
    if [[ "$LOCAL_RPC_URL" == *"devnet"* ]]; then
        CLUSTER="devnet"
    elif [[ "$LOCAL_RPC_URL" == *"mainnet"* ]]; then
        CLUSTER="mainnet-beta"
    else
        CLUSTER="localhost"
    fi
    
    if solana account "$LOCAL_PROGRAM_ID" --url "$LOCAL_RPC_URL" &>/dev/null; then
        echo -e "${GREEN}✓ Program found on $CLUSTER${NC}"
        echo "  Explorer: https://explorer.solana.com/address/$LOCAL_PROGRAM_ID?cluster=$CLUSTER"
    else
        echo -e "${RED}✗ Program NOT found on $CLUSTER${NC}"
        ERRORS=$((ERRORS + 1))
    fi
fi

echo ""
echo "======================================"

if [ $ERRORS -eq 0 ]; then
    echo -e "${GREEN}✓ All checks passed!${NC}"
    echo "======================================"
    exit 0
else
    echo -e "${RED}✗ Found $ERRORS error(s)${NC}"
    echo "======================================"
    echo ""
    echo "To fix:"
    echo "  1. Run: ./scripts/deploy-devnet.sh"
    echo "  2. Or manually update environment variables"
    exit 1
fi
