#!/usr/bin/env ts-node
/**
 * Fund House Vault on Devnet
 * 
 * This script transfers SOL from the house authority wallet to the house vault PDA.
 * The vault needs sufficient funds to cover max payouts for player bets.
 * 
 * Usage:
 *   npm run fund-vault -- <amount_in_sol>
 *   
 * Example:
 *   npm run fund-vault -- 100
 */

import { Connection, PublicKey, SystemProgram, Transaction, sendAndConfirmTransaction, Keypair } from '@solana/web3.js';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  // Parse command line args
  const amountSol = parseFloat(process.argv[2] || '100');
  
  if (isNaN(amountSol) || amountSol <= 0) {
    console.error('❌ Invalid amount. Usage: npm run fund-vault -- <amount_in_sol>');
    process.exit(1);
  }

  console.log('🏦 Funding House Vault on Devnet');
  console.log('================================\n');

  // Load environment
  const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || 'https://api.devnet.solana.com';
  const PROGRAM_ID = process.env.NEXT_PUBLIC_PROGRAM_ID;
  const HOUSE_AUTHORITY = process.env.NEXT_PUBLIC_HOUSE_AUTHORITY;

  if (!PROGRAM_ID || !HOUSE_AUTHORITY) {
    console.error('❌ Missing environment variables:');
    console.error('   NEXT_PUBLIC_PROGRAM_ID:', PROGRAM_ID);
    console.error('   NEXT_PUBLIC_HOUSE_AUTHORITY:', HOUSE_AUTHORITY);
    process.exit(1);
  }

  console.log('📋 Configuration:');
  console.log(`   RPC: ${RPC_URL}`);
  console.log(`   Program ID: ${PROGRAM_ID}`);
  console.log(`   House Authority: ${HOUSE_AUTHORITY}`);
  console.log(`   Amount: ${amountSol} SOL\n`);

  // Connect to devnet
  const connection = new Connection(RPC_URL, 'confirmed');

  // Load house authority keypair
  const keypairPath = path.join(process.env.HOME || '', '.config/solana/id.json');
  
  if (!fs.existsSync(keypairPath)) {
    console.error(`❌ Keypair not found at: ${keypairPath}`);
    console.error('   Run: solana-keygen new');
    process.exit(1);
  }

  const keypairData = JSON.parse(fs.readFileSync(keypairPath, 'utf-8'));
  const houseAuthKeypair = Keypair.fromSecretKey(new Uint8Array(keypairData));

  // Verify the keypair matches the house authority
  if (houseAuthKeypair.publicKey.toBase58() !== HOUSE_AUTHORITY) {
    console.error('❌ Keypair mismatch!');
    console.error(`   Expected: ${HOUSE_AUTHORITY}`);
    console.error(`   Got: ${houseAuthKeypair.publicKey.toBase58()}`);
    console.error('\n   Make sure your Solana CLI keypair matches NEXT_PUBLIC_HOUSE_AUTHORITY');
    process.exit(1);
  }

  console.log('✅ House authority keypair loaded\n');

  // Derive vault PDA
  const programId = new PublicKey(PROGRAM_ID);
  const houseAuthPubkey = new PublicKey(HOUSE_AUTHORITY);

  const [vaultPda, bump] = PublicKey.findProgramAddressSync(
    [Buffer.from('house_vault'), houseAuthPubkey.toBuffer()],
    programId
  );

  console.log('🔑 Vault PDA:');
  console.log(`   Address: ${vaultPda.toBase58()}`);
  console.log(`   Bump: ${bump}\n`);

  // Check balances
  const houseAuthBalance = await connection.getBalance(houseAuthKeypair.publicKey);
  const vaultBalance = await connection.getBalance(vaultPda);

  console.log('💰 Current Balances:');
  console.log(`   House Authority: ${(houseAuthBalance / 1e9).toFixed(4)} SOL`);
  console.log(`   Vault PDA: ${(vaultBalance / 1e9).toFixed(4)} SOL\n`);

  // Check if house has enough balance
  const amountLamports = amountSol * 1e9;
  if (houseAuthBalance < amountLamports) {
    console.error(`❌ Insufficient balance in house authority wallet`);
    console.error(`   Need: ${amountSol} SOL`);
    console.error(`   Have: ${(houseAuthBalance / 1e9).toFixed(4)} SOL`);
    console.error('\n   Request airdrop first:');
    console.error(`   solana airdrop ${Math.ceil(amountSol - houseAuthBalance / 1e9)} ${HOUSE_AUTHORITY}`);
    process.exit(1);
  }

  // Create transfer transaction
  console.log('📤 Creating transfer transaction...');
  
  const transaction = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: houseAuthKeypair.publicKey,
      toPubkey: vaultPda,
      lamports: amountLamports,
    })
  );

  // Send transaction
  console.log('📡 Sending transaction...');
  const signature = await sendAndConfirmTransaction(
    connection,
    transaction,
    [houseAuthKeypair],
    { commitment: 'confirmed' }
  );

  console.log(`✅ Transaction confirmed: ${signature}\n`);

  // Check new balances
  const newHouseAuthBalance = await connection.getBalance(houseAuthKeypair.publicKey);
  const newVaultBalance = await connection.getBalance(vaultPda);

  console.log('💰 New Balances:');
  console.log(`   House Authority: ${(newHouseAuthBalance / 1e9).toFixed(4)} SOL`);
  console.log(`   Vault PDA: ${(newVaultBalance / 1e9).toFixed(4)} SOL`);
  console.log(`\n🎉 Successfully transferred ${amountSol} SOL to vault!`);
  console.log(`\n   View on explorer:`);
  console.log(`   https://explorer.solana.com/tx/${signature}?cluster=devnet`);
}

main().catch((error) => {
  console.error('\n❌ Error:', error.message);
  process.exit(1);
});
