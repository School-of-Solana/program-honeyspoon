/**
 * Update/reinitialize Solana game config with new values
 * This script updates the config with reduced max_dives and max_bet
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
  console.log('Checking game config...\n');
  
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
  
  // Fetch current config
  try {
    const config = await program.account.gameConfig.fetch(configPda);
    console.log('Current config:');
    console.log(`  Base Survival: ${config.baseSurvivalPpm / 10000}%`);
    console.log(`  Decay Per Dive: ${config.decayPerDivePpm / 10000}%`);
    console.log(`  Min Survival: ${config.minSurvivalPpm / 10000}%`);
    console.log(`  Treasure Multiplier: ${config.treasureMultiplierNum}/${config.treasureMultiplierDen}`);
    console.log(`  Max Payout Multiplier: ${config.maxPayoutMultiplier}x`);
    console.log(`  Max Dives: ${config.maxDives}`);
    console.log(`  Min Bet: ${config.minBet.toString()} lamports (${config.minBet.toNumber() / 1_000_000_000} SOL)`);
    console.log(`  Max Bet: ${config.maxBet.toString()} lamports (${config.maxBet.toNumber() / 1_000_000_000} SOL)`);
    console.log('\nNOTE: Config already exists. The new defaults will only apply to NEW configs.');
    console.log('To use new values, you would need to:');
    console.log('  1. Add an update_config instruction to the program, OR');
    console.log('  2. Close and reinitialize (requires draining all active sessions)');
    console.log('\nThe updated program code has:');
    console.log('  - max_dives: 5 (current: ' + config.maxDives + ')');
    console.log('  - max_bet: 0.2 SOL (current: ' + (config.maxBet.toNumber() / 1_000_000_000) + ' SOL)');
    console.log('  - Relaxed vault requirement: 20% of max_payout instead of 100%');
  } catch (error) {
    console.log('Config not initialized yet.');
    console.log('Run init-game-config.ts to initialize with new defaults.');
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
