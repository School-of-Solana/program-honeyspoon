/**
 * Automatic Session Cleanup Bot
 * Periodically scans for expired sessions and cleans them up
 * Run this as a cron job or serverless function
 */

import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
} from '@solana/web3.js';
import { readFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

const PROGRAM_ID = new PublicKey('CBdZ8FbqsgSSiKunsJgr8vogMD4pKqkoXzzi9ZB4URz1');
const HOUSE_VAULT_SEED = 'house_vault';
const SESSION_SEED = 'session';
const TIMEOUT_SLOTS = 750; // Must match program constant

interface SessionAccount {
  pubkey: PublicKey;
  user: PublicKey;
  houseVault: PublicKey;
  status: number;
  lastActiveSlot: bigint;
}

function parseSessionAccount(pubkey: PublicKey, data: Buffer): SessionAccount | null {
  try {
    if (data.length < 82) return null;

    let offset = 8; // Skip discriminator

    const user = new PublicKey(data.slice(offset, offset + 32));
    offset += 32;

    const houseVault = new PublicKey(data.slice(offset, offset + 32));
    offset += 32;

    const status = data.readUInt8(offset);
    offset += 1;

    // Skip bet_amount, current_treasure, max_payout, dive_number, bump
    offset += 8 + 8 + 8 + 2 + 1;

    const lastActiveSlot = data.readBigUInt64LE(offset);

    return {
      pubkey,
      user,
      houseVault,
      status,
      lastActiveSlot,
    };
  } catch (error) {
    console.error('Failed to parse session account:', error);
    return null;
  }
}

async function scanForExpiredSessions(
  connection: Connection,
  programId: PublicKey
): Promise<SessionAccount[]> {
  console.log('🔍 Scanning for expired sessions...');

  // Get all session accounts
  const accounts = await connection.getProgramAccounts(programId, {
    filters: [
      {
        dataSize: 122, // GameSession size
      },
    ],
  });

  console.log(`Found ${accounts.length} total session accounts`);

  const currentSlot = await connection.getSlot();
  console.log(`Current slot: ${currentSlot}`);

  const expiredSessions: SessionAccount[] = [];

  for (const { pubkey, account } of accounts) {
    const session = parseSessionAccount(pubkey, account.data);
    
    if (!session) continue;

    // Only process Active sessions (status = 0)
    if (session.status !== 0) continue;

    const inactiveSlots = BigInt(currentSlot) - session.lastActiveSlot;
    const isExpired = inactiveSlots > BigInt(TIMEOUT_SLOTS);

    if (isExpired) {
      console.log(`  ⏰ Expired: ${pubkey.toBase58()} (inactive ${inactiveSlots} slots)`);
      expiredSessions.push(session);
    }
  }

  console.log(`Found ${expiredSessions.length} expired sessions`);
  return expiredSessions;
}

async function cleanupSession(
  connection: Connection,
  programId: PublicKey,
  crank: Keypair,
  session: SessionAccount
): Promise<string | null> {
  try {
    // Build clean_expired_session instruction
    const discriminator = Buffer.from([198, 119, 17, 15, 128, 185, 80, 231]);

    const instruction = new TransactionInstruction({
      keys: [
        { pubkey: crank.publicKey, isSigner: true, isWritable: true },
        { pubkey: session.houseVault, isSigner: false, isWritable: true },
        { pubkey: session.pubkey, isSigner: false, isWritable: true },
      ],
      programId,
      data: discriminator,
    });

    const transaction = new Transaction().add(instruction);
    
    const signature = await sendAndConfirmTransaction(
      connection,
      transaction,
      [crank],
      { commitment: 'confirmed' }
    );

    return signature;
  } catch (error: any) {
    console.error(`Failed to cleanup ${session.pubkey.toBase58()}:`, error.message);
    return null;
  }
}

async function main() {
  console.log('🤖 Cleanup Bot Starting...\n');

  const rpcUrl = process.env.RPC_URL || 'https://api.devnet.solana.com';
  const connection = new Connection(rpcUrl, 'confirmed');

  // Load crank keypair (can be any funded account)
  const keypairPath = process.env.CRANK_KEYPAIR || join(homedir(), '.config/solana/id.json');
  const keypairData = JSON.parse(readFileSync(keypairPath, 'utf-8'));
  const crank = Keypair.fromSecretKey(new Uint8Array(keypairData));

  console.log(`Crank: ${crank.publicKey.toBase58()}`);
  console.log(`Timeout: ${TIMEOUT_SLOTS} slots (~${(TIMEOUT_SLOTS * 0.4 / 60).toFixed(1)} minutes)\n`);

  // Scan for expired sessions
  const expiredSessions = await scanForExpiredSessions(connection, PROGRAM_ID);

  if (expiredSessions.length === 0) {
    console.log('✅ No expired sessions found');
    return;
  }

  console.log(`\n🧹 Cleaning up ${expiredSessions.length} sessions...\n`);

  let successCount = 0;
  let failCount = 0;

  for (const session of expiredSessions) {
    console.log(`Cleaning: ${session.pubkey.toBase58()}`);
    
    const signature = await cleanupSession(connection, PROGRAM_ID, crank, session);
    
    if (signature) {
      console.log(`  ✅ Success: ${signature}`);
      successCount++;
    } else {
      console.log(`  ❌ Failed`);
      failCount++;
    }

    // Rate limit to avoid overwhelming RPC
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log(`\n📊 Cleanup Summary:`);
  console.log(`  Success: ${successCount}`);
  console.log(`  Failed: ${failCount}`);
  console.log(`  Total: ${expiredSessions.length}`);
}

// Run with error handling
if (require.main === module) {
  main()
    .then(() => {
      console.log('\n✅ Cleanup bot finished');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Cleanup bot error:', error);
      process.exit(1);
    });
}

export { main as runCleanupBot };
