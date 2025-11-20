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
const RPC_URL = process.env.RPC_URL || 'https://api.devnet.solana.com';
const PROGRAM_ID = new PublicKey(process.env.PROGRAM_ID || '2hMffkY1dCRo548Kj152LNyPomQAiFhw7dVAsgNbZ7F2');

async function main() {
  console.log('Launch: Initializing game config...\n');
  
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
    console.log('OK: Config already initialized!');
    console.log('Current settings:', config);
    return;
  } catch (error) {
    console.log('⏳ Config not initialized, proceeding...\n');
  }
  
  // Initialize with default parameters (all None = use contract defaults)
  console.log('Note: Calling init_config...');
  const tx = await program.methods
    .initConfig({
      baseSurvivalPpm: null, // use default (700000 = 70%)
      decayPerDivePpm: null, // use default
      minSurvivalPpm: null, // use default
      treasureMultiplierNum: null, // use default
      treasureMultiplierDen: null, // use default
      maxPayoutMultiplier: null, // use default (100)
      maxDives: null, // use default (5)
      fixedBet: null, // use default (0.01 SOL)
    })
    .accounts({
      admin: admin.publicKey,
      config: configPda,
    })
    .rpc();
  
  console.log(`\nOK: Config initialized!`);
  console.log(`Transaction: ${tx}`);
  
  // Fetch and display config
  const config = await program.account.gameConfig.fetch(configPda);
  console.log('\nInfo: Game Configuration:');
  console.log(`  Base Survival: ${config.baseSurvivalPpm / 10000}%`);
  console.log(`  Decay Per Dive: ${config.decayPerDivePpm / 10000}%`);
  console.log(`  Min Survival: ${config.minSurvivalPpm / 10000}%`);
  console.log(`  Treasure Multiplier: ${config.treasureMultiplierNum}/${config.treasureMultiplierDen}`);
  console.log(`  Max Payout Multiplier: ${config.maxPayoutMultiplier}x`);
  console.log(`  Max Dives: ${config.maxDives}`);
  console.log(`  Fixed Bet: ${config.fixedBet.toString()} lamports (${Number(config.fixedBet) / 1e9} SOL)`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('ERROR: Error:', error);
    process.exit(1);
  });
