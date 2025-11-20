# Deployment Guide

Complete guide for deploying the Deep Sea Diver game to Solana Devnet and Vercel.

## Table of Contents
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Manual Deployment](#manual-deployment)
- [Verification](#verification)
- [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required Tools
1. **Solana CLI** (v1.18.0+)
   ```bash
   sh -c "$(curl -sSfL https://release.solana.com/stable/install)"
   ```

2. **Anchor CLI** (v0.29.0+)
   ```bash
   cargo install --git https://github.com/coral-xyz/anchor anchor-cli --locked
   ```

3. **Node.js** (v18+) and npm
   ```bash
   # Check version
   node --version
   npm --version
   ```

4. **Vercel CLI**
   ```bash
   npm install -g vercel
   ```

### Wallet Setup
1. **Create or import Solana wallet:**
   ```bash
   solana-keygen new
   ```

2. **Get Devnet SOL** (need ~5 SOL for deployment):
   ```bash
   solana airdrop 5 --url https://api.devnet.solana.com
   ```
   
   Or use faucet: https://faucet.solana.com

3. **Set Solana CLI to devnet:**
   ```bash
   solana config set --url https://api.devnet.solana.com
   ```

---

## Quick Start

### One-Command Deployment

```bash
./scripts/deploy-devnet.sh
```

This script will:
1. ✅ Check prerequisites
2. ✅ Build and deploy program to devnet
3. ✅ Initialize game config and house vault
4. ✅ Sync IDL to frontend
5. ✅ Update environment variables
6. ✅ Deploy frontend to Vercel

---

## Manual Deployment

If you prefer manual control, follow these steps:

### Step 1: Build and Deploy Program

```bash
cd anchor_project/the_fool
anchor build
anchor deploy --provider.cluster devnet
```

**Copy the Program ID** from the output.

### Step 2: Update Program ID in Code

Update `programs/dive_game/src/lib.rs`:
```rust
declare_id!("YOUR_PROGRAM_ID_HERE");
```

Rebuild:
```bash
anchor build
```

### Step 3: Initialize On-Chain

```bash
cd anchor_project/the_fool
RPC_URL=https://api.devnet.solana.com npx ts-node scripts/init-localnet.ts
```

This initializes:
- Game configuration (fixed bet, survival rates, etc.)
- House vault PDA
- Initial vault funding

### Step 4: Sync IDL to Frontend

```bash
cd ../..
./scripts/sync-idl.sh
```

### Step 5: Update Frontend Environment

Edit `frontend/the_fool/.env.local`:
```bash
NEXT_PUBLIC_USE_SOLANA=true
NEXT_PUBLIC_RPC_URL=https://api.devnet.solana.com
NEXT_PUBLIC_PROGRAM_ID=YOUR_PROGRAM_ID
NEXT_PUBLIC_HOUSE_AUTHORITY=YOUR_WALLET_ADDRESS
```

### Step 6: Update Vercel Environment

```bash
cd frontend/the_fool

# Remove old values
vercel env rm NEXT_PUBLIC_PROGRAM_ID production --yes
vercel env rm NEXT_PUBLIC_HOUSE_AUTHORITY production --yes
vercel env rm NEXT_PUBLIC_RPC_URL production --yes

# Add new values
echo "YOUR_PROGRAM_ID" | vercel env add NEXT_PUBLIC_PROGRAM_ID production
echo "YOUR_WALLET_ADDRESS" | vercel env add NEXT_PUBLIC_HOUSE_AUTHORITY production
echo "https://api.devnet.solana.com" | vercel env add NEXT_PUBLIC_RPC_URL production
```

### Step 7: Deploy to Vercel

```bash
vercel --prod
```

---

## Verification

### Verify Deployment

Run the verification script:
```bash
./scripts/verify-deployment.sh
```

This checks:
- ✅ Local `.env.local` configuration
- ✅ Vercel environment variables
- ✅ Local vs Vercel consistency
- ✅ Program exists on Solana

### Manual Verification

1. **Check Program on Solana:**
   ```bash
   solana account YOUR_PROGRAM_ID --url https://api.devnet.solana.com
   ```

2. **Check Config PDA:**
   ```bash
   # Get config address (use output from init script)
   solana account CONFIG_PDA --url https://api.devnet.solana.com
   ```

3. **Check House Vault:**
   ```bash
   solana balance VAULT_PDA --url https://api.devnet.solana.com
   ```

4. **Test Frontend:**
   - Open Vercel URL in browser
   - Connect wallet (with devnet SOL)
   - Try starting a game

---

## Troubleshooting

### Common Issues

#### 1. "Program is not deployed" Error

**Problem:** Frontend shows "Program CBdZ8F... is not deployed"

**Solution:**
```bash
# Verify Vercel env vars match local
./scripts/verify-deployment.sh

# If mismatch, redeploy
./scripts/deploy-devnet.sh
```

#### 2. "Insufficient balance for rent" Error

**Problem:** Not enough SOL in wallet

**Solution:**
```bash
# Get more devnet SOL
solana airdrop 5 --url https://api.devnet.solana.com
```

#### 3. "Vault has insufficient balance" Error

**Problem:** House vault needs more SOL

**Solution:**
```bash
# Fund vault (replace with your vault PDA)
solana transfer VAULT_PDA 10 --url https://api.devnet.solana.com --allow-unfunded-recipient
```

#### 4. Environment Variable Mismatch

**Problem:** Local and Vercel configs differ

**Solution:**
```bash
# Check for mismatches
./scripts/verify-deployment.sh

# Fix by redeploying
cd frontend/the_fool
vercel --prod
```

#### 5. IDL Out of Sync

**Problem:** Frontend shows type errors or serialization issues

**Solution:**
```bash
# Rebuild and sync IDL
cd anchor_project/the_fool
anchor build
cd ../..
./scripts/sync-idl.sh

# Redeploy frontend
cd frontend/the_fool
vercel --prod
```

---

## Network Configuration

### Devnet (Default)
```bash
RPC_URL="https://api.devnet.solana.com"
```
- Best for testing
- Free SOL from faucets
- No real money risk

### Localhost (Development)
```bash
# Terminal 1: Start test validator
solana-test-validator

# Terminal 2: Deploy
solana config set --url http://localhost:8899
./scripts/deploy-devnet.sh
```

### Mainnet (Production) ⚠️

**⚠️ NOT RECOMMENDED without audit**

This game uses simple on-chain RNG which is predictable. Mainnet deployment requires:
1. Professional security audit
2. VRF integration (Switchboard/Chainlink)
3. Comprehensive testing
4. Insurance fund

---

## Key Addresses

After deployment, save these addresses:

```bash
# Example (yours will be different)
Program ID:       2hMffkY1dCRo548Kj152LNyPomQAiFhw7dVAsgNbZ7F2
Config PDA:       6yjLvyLBcZ5sh98qtuTxEAu928MhXECCU9o4kgxxoUyA
House Vault:      BNBY3qdBkoay6MC8tuUbjDWZGiWTTRKeS3jzDnR49xAe
House Authority:  7qdd7r1CJdnXVcr3bFD5CyBRyDF9eW4taoJqABhN5hXW
```

View on Explorer:
- https://explorer.solana.com/address/YOUR_PROGRAM_ID?cluster=devnet

---

## Scripts Reference

### Deployment Scripts

| Script | Purpose |
|--------|---------|
| `./scripts/deploy-devnet.sh` | Complete automated deployment |
| `./scripts/verify-deployment.sh` | Verify configuration consistency |
| `./scripts/sync-idl.sh` | Sync IDL from Rust to frontend |

### Anchor Scripts

| Script | Purpose |
|--------|---------|
| `anchor_project/the_fool/scripts/init-localnet.ts` | Initialize game on-chain |
| `anchor_project/the_fool/scripts/vault-admin.ts` | Vault management utilities |

---

## Security Checklist

Before going live, ensure:

- [ ] Program audited by professionals
- [ ] VRF integrated for randomness
- [ ] Rate limiting implemented
- [ ] House vault adequately funded
- [ ] Emergency pause mechanism tested
- [ ] All tests passing (Rust + TypeScript)
- [ ] Frontend error handling complete
- [ ] Monitoring and alerting set up

---

## Support

- **Issues:** https://github.com/YOUR_REPO/issues
- **Solana Docs:** https://docs.solana.com
- **Anchor Docs:** https://www.anchor-lang.com

---

## License

[Your License Here]
