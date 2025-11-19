#!/bin/bash

# Deploy Fixed Program and Reset Vault
# This script deploys the program with overflow fixes and resets the vault's total_reserved

set -e

echo "========================================="
echo "Deploy & Fix Vault Script"
echo "========================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Check SOL balance
BALANCE=$(solana balance --url https://api.devnet.solana.com | awk '{print $1}')
echo "Current balance: $BALANCE SOL"

if (( $(echo "$BALANCE < 2.5" | bc -l) )); then
    echo -e "${RED}ERROR: Insufficient balance for deployment (need ~2.5 SOL)${NC}"
    echo ""
    echo "Get devnet SOL from:"
    echo "  - https://faucet.solana.com"
    echo "  - https://solfaucet.com"
    echo "  - solana airdrop 5 (may be rate limited)"
    echo ""
    exit 1
fi

echo -e "${GREEN}✓ Sufficient balance for deployment${NC}"
echo ""

# Step 1: Deploy program
echo "Step 1: Deploying program to devnet..."
cd "$(dirname "$0")/../anchor_project/the_fool"

if anchor deploy --provider.cluster devnet; then
    echo -e "${GREEN}✓ Program deployed successfully${NC}"
else
    echo -e "${RED}ERROR: Program deployment failed${NC}"
    exit 1
fi

echo ""

# Step 2: Sync IDL to frontend
echo "Step 2: Syncing IDL to frontend..."
cd "$(dirname "$0")/.."

if bash scripts/sync-idl.sh; then
    echo -e "${GREEN}✓ IDL synced${NC}"
else
    echo -e "${YELLOW}WARNING: IDL sync failed (may need to run manually)${NC}"
fi

echo ""

# Step 3: Reset vault reserved
echo "Step 3: Resetting vault total_reserved..."

# Create temporary Node script
cat > /tmp/reset_vault_tmp.js << 'NODESCRIPT'
const anchor = require('@coral-xyz/anchor');
const { Connection, PublicKey, Keypair } = require('@solana/web3.js');
const fs = require('fs');
const path = require('path');

async function main() {
  const projectRoot = process.argv[2];
  const idlPath = path.join(projectRoot, 'anchor_project/the_fool/target/idl/dive_game.json');
  const idl = JSON.parse(fs.readFileSync(idlPath, 'utf8'));
  const programId = new PublicKey('CBdZ8FbqsgSSiKunsJgr8vogMD4pKqkoXzzi9ZB4URz1');
  
  const keypairPath = path.join(process.env.HOME, '.config/solana/id.json');
  const keypairData = JSON.parse(fs.readFileSync(keypairPath, 'utf8'));
  const admin = Keypair.fromSecretKey(new Uint8Array(keypairData));
  
  const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
  const wallet = new anchor.Wallet(admin);
  const provider = new anchor.AnchorProvider(connection, wallet, {});
  
  const program = new anchor.Program(idl, programId, provider);
  
  const [vaultPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('house_vault'), admin.publicKey.toBuffer()],
    programId
  );
  
  console.log('Vault PDA:', vaultPda.toString());
  
  try {
    const tx = await program.methods
      .resetVaultReserved()
      .accounts({
        houseAuthority: admin.publicKey,
        houseVault: vaultPda,
      })
      .rpc();
    
    console.log('✓ Vault reserved reset to 0');
    console.log('Transaction:', tx);
    
    // Fetch and display vault state
    const vaultAccount = await program.account.houseVault.fetch(vaultPda);
    const vaultInfo = await connection.getAccountInfo(vaultPda);
    
    console.log('\nVault State:');
    console.log('  Balance:', vaultInfo.lamports / 1e9, 'SOL');
    console.log('  Reserved:', vaultAccount.totalReserved.toNumber() / 1e9, 'SOL');
    console.log('  Available:', (vaultInfo.lamports - vaultAccount.totalReserved.toNumber()) / 1e9, 'SOL');
    
  } catch (error) {
    console.error('ERROR:', error.message);
    process.exit(1);
  }
}

main().catch(console.error);
NODESCRIPT

if node /tmp/reset_vault_tmp.js "$(dirname "$0")/.."; then
    echo -e "${GREEN}✓ Vault fixed${NC}"
else
    echo -e "${RED}ERROR: Failed to reset vault${NC}"
    echo ""
    echo "You can manually reset the vault later with:"
    echo "  cd anchor_project/the_fool"
    echo "  anchor run reset-vault"
    exit 1
fi

rm /tmp/reset_vault_tmp.js

echo ""
echo "========================================="
echo -e "${GREEN}✓ Deployment and Fix Complete!${NC}"
echo "========================================="
echo ""
echo "Next steps:"
echo "  1. Test the game at your frontend URL"
echo "  2. Verify transactions work correctly"
echo "  3. Monitor vault accounting"
echo ""
