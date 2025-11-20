#!/usr/bin/env ts-node
/**
 * Unified Vault Admin Tool
 * Combines monitoring, reset, and funding operations
 * 
 * Usage:
 *   npx ts-node scripts/vault-admin.ts status           # Check vault health
 *   npx ts-node scripts/vault-admin.ts reset            # Emergency reset (use with caution)
 *   npx ts-node scripts/vault-admin.ts fund <amount>    # Add SOL to vault
 */

import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
  LAMPORTS_PER_SOL,
  SystemProgram,
} from '@solana/web3.js';
import { readFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

const PROGRAM_ID = new PublicKey('CBdZ8FbqsgSSiKunsJgr8vogMD4pKqkoXzzi9ZB4URz1');
const HOUSE_VAULT_SEED = 'house_vault';
const RPC_URL = process.env.RPC_URL || 'https://api.devnet.solana.com';

interface VaultStatus {
  vaultPda: string;
  balance: number;
  reserved: number;
  available: number;
  utilizationPercent: number;
  status: 'healthy' | 'warning' | 'critical';
  issues: string[];
}

function getHouseVaultPDA(authority: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from(HOUSE_VAULT_SEED), authority.toBuffer()],
    PROGRAM_ID
  );
  return pda;
}

async function loadKeypair(): Promise<Keypair> {
  const keypairPath = join(homedir(), '.config/solana/id.json');
  const keypairData = JSON.parse(readFileSync(keypairPath, 'utf-8'));
  return Keypair.fromSecretKey(new Uint8Array(keypairData));
}

async function getVaultStatus(connection: Connection, vaultPda: PublicKey): Promise<VaultStatus> {
  const account = await connection.getAccountInfo(vaultPda);
  
  if (!account) {
    throw new Error('Vault account not found');
  }

  const balance = account.lamports / LAMPORTS_PER_SOL;
  const totalReserved = Number(account.data.readBigUInt64LE(73)) / LAMPORTS_PER_SOL;
  const available = balance - totalReserved;
  const utilizationPercent = balance > 0 ? (totalReserved / balance) * 100 : 0;

  const issues: string[] = [];
  let status: 'healthy' | 'warning' | 'critical' = 'healthy';

  if (totalReserved > balance) {
    issues.push('CRITICAL: Reserved > Balance (accounting error)');
    status = 'critical';
  } else if (utilizationPercent > 90) {
    issues.push('CRITICAL: >90% funds reserved');
    status = 'critical';
  } else if (utilizationPercent > 70) {
    issues.push('WARNING: >70% funds reserved');
    status = status === 'healthy' ? 'warning' : status;
  }

  if (available < 1) {
    issues.push('WARNING: <1 SOL available');
    status = status === 'healthy' ? 'warning' : status;
  }

  if (balance < 5) {
    issues.push('WARNING: Low balance (<5 SOL)');
    status = status === 'healthy' ? 'warning' : status;
  }

  return {
    vaultPda: vaultPda.toBase58(),
    balance,
    reserved: totalReserved,
    available,
    utilizationPercent,
    status,
    issues,
  };
}

async function showStatus() {
  console.log('🏥 Vault Status\n');
  
  const connection = new Connection(RPC_URL, 'confirmed');
  const authority = await loadKeypair();
  const vaultPda = getHouseVaultPDA(authority.publicKey);

  const health = await getVaultStatus(connection, vaultPda);

  const statusEmoji = {
    healthy: '✅',
    warning: '⚠️',
    critical: '🚨',
  };

  console.log(`${statusEmoji[health.status]} Status: ${health.status.toUpperCase()}\n`);
  console.log('📊 Metrics:');
  console.log(`  Vault:       ${health.vaultPda}`);
  console.log(`  Balance:     ${health.balance.toFixed(4)} SOL`);
  console.log(`  Reserved:    ${health.reserved.toFixed(4)} SOL`);
  console.log(`  Available:   ${health.available.toFixed(4)} SOL`);
  console.log(`  Utilization: ${health.utilizationPercent.toFixed(1)}%\n`);

  if (health.issues.length > 0) {
    console.log('⚠️  Issues:');
    health.issues.forEach(issue => console.log(`  - ${issue}`));
  } else {
    console.log('✅ No issues');
  }
}

async function resetVault() {
  console.log('🔧 Resetting Vault Reserved\n');
  console.log('⚠️  WARNING: Only use this when NO active sessions exist!\n');

  const connection = new Connection(RPC_URL, 'confirmed');
  const authority = await loadKeypair();
  const vaultPda = getHouseVaultPDA(authority.publicKey);

  const health = await getVaultStatus(connection, vaultPda);
  
  console.log('Current state:');
  console.log(`  Reserved: ${health.reserved.toFixed(4)} SOL\n`);

  if (health.reserved === 0) {
    console.log('✅ Already at 0, no reset needed');
    return;
  }

  console.log('Sending reset transaction...');
  
  const discriminator = Buffer.from([234, 184, 164, 210, 94, 125, 213, 53]);
  const instruction = new TransactionInstruction({
    keys: [
      { pubkey: authority.publicKey, isSigner: true, isWritable: true },
      { pubkey: vaultPda, isSigner: false, isWritable: true },
    ],
    programId: PROGRAM_ID,
    data: discriminator,
  });

  const transaction = new Transaction().add(instruction);
  const signature = await sendAndConfirmTransaction(connection, transaction, [authority]);

  console.log(`✅ Reset complete!`);
  console.log(`   TX: ${signature}`);
  console.log(`   Explorer: https://explorer.solana.com/tx/${signature}?cluster=devnet`);
}

async function fundVault(amount: number) {
  console.log(`💰 Funding Vault with ${amount} SOL\n`);

  const connection = new Connection(RPC_URL, 'confirmed');
  const authority = await loadKeypair();
  const vaultPda = getHouseVaultPDA(authority.publicKey);

  const lamports = amount * LAMPORTS_PER_SOL;

  const instruction = SystemProgram.transfer({
    fromPubkey: authority.publicKey,
    toPubkey: vaultPda,
    lamports,
  });

  const transaction = new Transaction().add(instruction);
  const signature = await sendAndConfirmTransaction(connection, transaction, [authority]);

  console.log(`✅ Funded ${amount} SOL to vault`);
  console.log(`   TX: ${signature}`);
  console.log(`   Explorer: https://explorer.solana.com/tx/${signature}?cluster=devnet`);
}

async function main() {
  const command = process.argv[2];
  const arg = process.argv[3];

  try {
    switch (command) {
      case 'status':
      case 'check':
      case undefined:
        await showStatus();
        break;
      
      case 'reset':
        await resetVault();
        break;
      
      case 'fund':
        if (!arg) {
          console.error('❌ Error: Amount required');
          console.error('Usage: vault-admin.ts fund <amount>');
          process.exit(1);
        }
        await fundVault(parseFloat(arg));
        break;
      
      default:
        console.error(`❌ Unknown command: ${command}`);
        console.error('\nUsage:');
        console.error('  vault-admin.ts status           # Check vault health');
        console.error('  vault-admin.ts reset            # Emergency reset');
        console.error('  vault-admin.ts fund <amount>    # Add SOL to vault');
        process.exit(1);
    }
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();
