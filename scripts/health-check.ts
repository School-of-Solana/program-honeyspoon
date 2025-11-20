/**
 * Health check script for the fixed bet system
 * Verifies that the program and config are properly deployed and initialized
 */

import { Connection, PublicKey } from '@solana/web3.js';
import { Program, AnchorProvider, Wallet } from '@coral-xyz/anchor';
import { readFileSync } from 'fs';
import { join } from 'path';

const RPC_URL = 'http://localhost:8899';
const PROGRAM_ID = new PublicKey('2hMffkY1dCRo548Kj152LNyPomQAiFhw7dVAsgNbZ7F2');
const HOUSE_AUTHORITY = new PublicKey('7qdd7r1CJdnXVcr3bFD5CyBRyDF9eW4taoJqABhN5hXW');

async function healthCheck() {
  console.log('\n🏥 HEALTH CHECK: Fixed Bet System\n');
  console.log('═'.repeat(60));

  const connection = new Connection(RPC_URL, 'confirmed');
  
  // 1. Check validator is running
  try {
    const version = await connection.getVersion();
    console.log('✅ Validator: Running');
    console.log(`   Version: ${version['solana-core']}`);
  } catch (error) {
    console.log('❌ Validator: NOT RUNNING');
    console.log('   Run: ./dev.sh');
    return false;
  }

  // 2. Check program is deployed
  try {
    const accountInfo = await connection.getAccountInfo(PROGRAM_ID);
    if (!accountInfo) {
      console.log('❌ Program: NOT DEPLOYED');
      return false;
    }
    console.log('✅ Program: Deployed');
    console.log(`   ID: ${PROGRAM_ID.toBase58()}`);
    console.log(`   Executable: ${accountInfo.executable}`);
  } catch (error) {
    console.log('❌ Program: ERROR checking status');
    return false;
  }

  // 3. Check GameConfig
  try {
    const idlPath = join(__dirname, '../frontend/the_fool/lib/solana/idl/dive_game.json');
    const idl = JSON.parse(readFileSync(idlPath, 'utf-8'));
    
    // Create dummy wallet for provider (we don't need to sign anything)
    const dummyWallet = {
      publicKey: HOUSE_AUTHORITY,
      signTransaction: async (tx: any) => tx,
      signAllTransactions: async (txs: any[]) => txs,
      payer: {} as any,
    };
    
    const provider = new AnchorProvider(connection, dummyWallet as any, {});
    const program = new Program(idl, PROGRAM_ID, provider);
    
    const [configPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('game_config')],
      PROGRAM_ID
    );
    
    const config = await program.account.gameConfig.fetch(configPda);
    console.log('✅ GameConfig: Initialized');
    console.log(`   PDA: ${configPda.toBase58()}`);
    console.log(`   Fixed Bet: ${Number(config.fixedBet) / 1e9} SOL`);
    console.log(`   Max Dives: ${config.maxDives}`);
    console.log(`   Base Survival: ${config.baseSurvivalPpm / 10000}%`);
    console.log(`   Decay Per Dive: ${config.decayPerDivePpm / 10000}%`);
    
    if (Number(config.fixedBet) !== 10000000) {
      console.log('⚠️  WARNING: Fixed bet is not 0.01 SOL (10M lamports)');
    }
    if (config.maxDives !== 5) {
      console.log('⚠️  WARNING: Max dives is not 5');
    }
  } catch (error) {
    console.log('❌ GameConfig: NOT INITIALIZED');
    console.log('   Run: npm run init-localnet');
    return false;
  }

  // 4. Check HouseVault
  try {
    const idlPath = join(__dirname, '../frontend/the_fool/lib/solana/idl/dive_game.json');
    const idl = JSON.parse(readFileSync(idlPath, 'utf-8'));
    
    const dummyWallet = {
      publicKey: HOUSE_AUTHORITY,
      signTransaction: async (tx: any) => tx,
      signAllTransactions: async (txs: any[]) => txs,
      payer: {} as any,
    };
    
    const provider = new AnchorProvider(connection, dummyWallet as any, {});
    const program = new Program(idl, PROGRAM_ID, provider);
    
    const [vaultPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('house_vault'), HOUSE_AUTHORITY.toBuffer()],
      PROGRAM_ID
    );
    
    const vault = await program.account.houseVault.fetch(vaultPda);
    const balance = await connection.getBalance(vaultPda);
    
    console.log('✅ HouseVault: Initialized');
    console.log(`   PDA: ${vaultPda.toBase58()}`);
    console.log(`   Balance: ${balance / 1e9} SOL`);
    console.log(`   Reserved: ${Number(vault.totalReserved) / 1e9} SOL`);
    console.log(`   Available: ${(balance - Number(vault.totalReserved)) / 1e9} SOL`);
    console.log(`   Locked: ${vault.locked}`);
    
    if (balance < 10000000) {
      console.log('⚠️  WARNING: Vault balance is low (< 0.01 SOL)');
    }
  } catch (error) {
    console.log('❌ HouseVault: NOT INITIALIZED');
    console.log('   Run: npm run init-localnet');
    return false;
  }

  console.log('\n' + '═'.repeat(60));
  console.log('✅ ALL CHECKS PASSED - System is ready!');
  console.log('\n📝 Next steps:');
  console.log('   1. Open browser: http://localhost:3000');
  console.log('   2. Connect wallet (Phantom recommended)');
  console.log('   3. Airdrop SOL to your wallet');
  console.log('   4. Click "START GAME" (0.01 SOL)');
  console.log('   5. Play the game and test diving/cashing out');
  console.log('═'.repeat(60) + '\n');

  return true;
}

healthCheck()
  .then((success) => process.exit(success ? 0 : 1))
  .catch((error) => {
    console.error('\n❌ ERROR:', error.message);
    process.exit(1);
  });
