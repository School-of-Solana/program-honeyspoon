/**
 * Update game config using raw transactions
 */

import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const PROGRAM_ID = new PublicKey('CBdZ8FbqsgSSiKunsJgr8vogMD4pKqkoXzzi9ZB4URz1');
const GAME_CONFIG_SEED = 'game_config';

function serializeOption(value: number | null | undefined, size: number): Buffer {
  if (value === null || value === undefined) {
    return Buffer.from([0]);
  }
  const buffer = Buffer.alloc(1 + size);
  buffer.writeUInt8(1, 0);
  if (size === 2) buffer.writeUInt16LE(value, 1);
  else if (size === 4) buffer.writeUInt32LE(value, 1);
  else if (size === 8) {
    const low = value & 0xffffffff;
    const high = Math.floor(value / 0x100000000);
    buffer.writeUInt32LE(low, 1);
    buffer.writeUInt32LE(high, 5);
  }
  return buffer;
}

function getConfigPDA(): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from(GAME_CONFIG_SEED)],
    PROGRAM_ID
  );
  return pda;
}

async function main() {
  console.log('🔧 Updating game config...\n');

  const rpcUrl = process.env.RPC_URL || 'https://api.devnet.solana.com';
  const connection = new Connection(rpcUrl, 'confirmed');

  // Load keypair
  const keypairPath = path.join(os.homedir(), '.config/solana/id.json');
  const keypairData = JSON.parse(fs.readFileSync(keypairPath, 'utf-8'));
  const admin = Keypair.fromSecretKey(new Uint8Array(keypairData));

  console.log(`Admin: ${admin.publicKey.toBase58()}`);

  const configPda = getConfigPDA();
  console.log(`Config PDA: ${configPda.toBase58()}\n`);

  // Fetch current config
  const configAccount = await connection.getAccountInfo(configPda);
  if (!configAccount) {
    console.log('❌ Config not found');
    return;
  }

  // Parse current values (offset 8 for discriminator)
  const currentMaxDives = configAccount.data.readUInt16LE(8 + 32 + 4 + 4 + 4 + 2 + 2 + 2);
  const currentFixedBet = configAccount.data.readBigUInt64LE(8 + 32 + 4 + 4 + 4 + 2 + 2 + 2 + 2);

  console.log('Current config:');
  console.log(`  Max Dives: ${currentMaxDives}`);
  console.log(`  Fixed Bet: ${Number(currentFixedBet) / LAMPORTS_PER_SOL} SOL\n`);

  // Get discriminator from IDL
  const updateConfigDiscriminator = Buffer.from([29, 158, 252, 191, 10, 83, 219, 99]);

  // Build update params
  const data = Buffer.concat([
    updateConfigDiscriminator,
    serializeOption(null, 4), // base_survival_ppm
    serializeOption(null, 4), // decay_per_dive_ppm
    serializeOption(null, 4), // min_survival_ppm
    serializeOption(null, 2), // treasure_multiplier_num
    serializeOption(null, 2), // treasure_multiplier_den
    serializeOption(null, 2), // max_payout_multiplier
    serializeOption(5, 2),    // max_dives
    serializeOption(10_000_000, 8), // fixed_bet (0.01 SOL)
  ]);

  const instruction = new TransactionInstruction({
    keys: [
      { pubkey: admin.publicKey, isSigner: true, isWritable: true },
      { pubkey: configPda, isSigner: false, isWritable: true },
    ],
    programId: PROGRAM_ID,
    data,
  });

  const transaction = new Transaction().add(instruction);

  console.log('Updating to:');
  console.log('  Max Dives: 5');
  console.log('  Fixed Bet: 0.01 SOL\n');

  console.log('Sending transaction...');
  const signature = await sendAndConfirmTransaction(connection, transaction, [admin], {
    commitment: 'confirmed',
  });

  console.log(`✅ Success! Transaction: ${signature}`);
  console.log(`   Explorer: https://explorer.solana.com/tx/${signature}?cluster=devnet\n`);

  // Verify
  const updatedAccount = await connection.getAccountInfo(configPda);
  if (updatedAccount) {
    const maxDives = updatedAccount.data.readUInt16LE(8 + 32 + 4 + 4 + 4 + 2 + 2 + 2);
    const fixedBet = updatedAccount.data.readBigUInt64LE(8 + 32 + 4 + 4 + 4 + 2 + 2 + 2 + 2);
    
    console.log('Updated config:');
    console.log(`  Max Dives: ${maxDives}`);
    console.log(`  Fixed Bet: ${Number(fixedBet) / LAMPORTS_PER_SOL} SOL`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error:', error);
    if (error.logs) {
      console.error('\nProgram logs:');
      error.logs.forEach((log: string) => console.error('  ', log));
    }
    process.exit(1);
  });
