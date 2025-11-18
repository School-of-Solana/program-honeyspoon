/**
 * Initialize Solana game config
 * This script must be run once after deploying the program
 */

import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import { Program, AnchorProvider, Wallet } from '@coral-xyz/anchor';
import { readFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

// Load IDL
const idlPath = join(__dirname, '../frontend/the_fool/lib/solana/idl/dive_game.json');
const idl = JSON.parse(readFileSync(idlPath, 'utf-8'));

// Configuration
const RPC_URL = process.env.RPC_URL || 'http://localhost:8899';
const PROGRAM_ID = new PublicKey(process.env.PROGRAM_ID || '9GxDuBwkkzJWe7ij6xrYv5FFAuqkDW5hjtripZAJgKb7');

async function main() {
  console.log('🚀 Initializing game config...\n');
  
  // Load keypair from ~/.config/solana/id.json
  const keypairPath = join(homedir(), '.config', 'solana', 'id.json');
  const keypairData = JSON.parse(readFileSync(keypairPath, 'utf-8'));
  const admin = Keypair.fromSecretKey(new Uint8Array(keypairData));
  
  console.log(`Admin pubkey: ${admin.publicKey.toBase58()}`);
  
  // Setup connection and provider
  const connection = new Connection(RPC_URL, 'confirmed');
  const wallet = new Wallet(admin);
  const provider = new AnchorProvider(connection, wallet, {});
  
  // Create program instance
  const program = new Program(idl, PROGRAM_ID, provider);
  
  // Derive config PDA
  const [configPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('game_config')],
    PROGRAM_ID
  );
  
  console.log(`Config PDA: ${configPda.toBase58()}\n`);
  
  // Check if already initialized
  try {
    const config = await program.account.gameConfig.fetch(configPda);
    console.log('✅ Config already initialized!');
    console.log('Current settings:', config);
    return;
  } catch (error) {
    console.log('⏳ Config not initialized, proceeding...\n');
  }
  
  // Initialize with default parameters (all None = use contract defaults)
  console.log('📝 Calling init_config...');
  const tx = await program.methods
    .initConfig(
      null, // baseSurvivalPpm: use default (700000 = 70%)
      null, // decayPerDivePpm: use default
      null, // minSurvivalPpm: use default
      null, // treasureMultiplierNum: use default
      null, // treasureMultiplierDen: use default
      null, // maxPayoutMultiplier: use default (100)
      null, // maxDives: use default (50)
      null, // minBet: use default
      null, // maxBet: use default
    )
    .accounts({
      admin: admin.publicKey,
      config: configPda,
    })
    .rpc();
  
  console.log(`\n✅ Config initialized!`);
  console.log(`Transaction: ${tx}`);
  
  // Fetch and display config
  const config = await program.account.gameConfig.fetch(configPda);
  console.log('\n📊 Game Configuration:');
  console.log(`  Base Survival: ${config.baseSurvivalPpm / 10000}%`);
  console.log(`  Decay Per Dive: ${config.decayPerDivePpm / 10000}%`);
  console.log(`  Min Survival: ${config.minSurvivalPpm / 10000}%`);
  console.log(`  Treasure Multiplier: ${config.treasureMultiplierNum}/${config.treasureMultiplierDen}`);
  console.log(`  Max Payout Multiplier: ${config.maxPayoutMultiplier}x`);
  console.log(`  Max Dives: ${config.maxDives}`);
  console.log(`  Min Bet: ${config.minBet.toString()} lamports`);
  console.log(`  Max Bet: ${config.maxBet.toString()} lamports`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
