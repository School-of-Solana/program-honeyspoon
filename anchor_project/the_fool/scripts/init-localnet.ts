/**
 * Initialize localnet for dive_game program
 * 
 * This script:
 * 1. Initializes GameConfig with default parameters (70% survival, 5% house edge)
 * 2. Initializes HouseVault for the house authority
 * 3. Funds the house vault with initial SOL
 */

import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

// Program ID (must match deployed program)
const PROGRAM_ID = new PublicKey("GmX4wpAD8z3TpuGc6AQtdq9KD3b6a2JfNjdQgPLEEdnP");

// Seeds
const GAME_CONFIG_SEED = "game_config";
const HOUSE_VAULT_SEED = "house_vault";

// Helper: Serialize Option<T>
function serializeOption(value: number | null | undefined, size: number): Buffer {
  if (value === null || value === undefined) {
    return Buffer.from([0]); // None
  }
  const buffer = Buffer.alloc(1 + size);
  buffer.writeUInt8(1, 0); // Some
  if (size === 2) buffer.writeUInt16LE(value, 1);
  else if (size === 4) buffer.writeUInt32LE(value, 1);
  else if (size === 8) {
    // For u64, write as two u32s
    const low = value & 0xffffffff;
    const high = Math.floor(value / 0x100000000);
    buffer.writeUInt32LE(low, 1);
    buffer.writeUInt32LE(high, 5);
  }
  return buffer;
}

// Get config PDA
function getConfigPDA(): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from(GAME_CONFIG_SEED)],
    PROGRAM_ID
  );
  return pda;
}

// Get house vault PDA
function getHouseVaultPDA(houseAuthority: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from(HOUSE_VAULT_SEED), houseAuthority.toBuffer()],
    PROGRAM_ID
  );
  return pda;
}

async function main() {
  console.log("🚀 Initializing dive_game on localnet...\n");

  // Connect to localnet
  const connection = new Connection("http://localhost:8899", "confirmed");
  
  // Load payer keypair from ~/.config/solana/id.json
  const keypairPath = path.join(os.homedir(), ".config", "solana", "id.json");
  const keypairData = JSON.parse(fs.readFileSync(keypairPath, "utf-8"));
  const payer = Keypair.fromSecretKey(Uint8Array.from(keypairData));
  
  console.log(`📍 Payer: ${payer.publicKey.toBase58()}`);
  const balance = await connection.getBalance(payer.publicKey);
  console.log(`💰 Balance: ${balance / LAMPORTS_PER_SOL} SOL\n`);

  // Step 1: Initialize GameConfig
  console.log("Step 1: Initializing GameConfig...");
  const configPda = getConfigPDA();
  console.log(`   Config PDA: ${configPda.toBase58()}`);

  try {
    const configAccount = await connection.getAccountInfo(configPda);
    if (configAccount) {
      console.log("   ✅ Config already initialized\n");
    } else {
      // Build init_config instruction data
      const discriminator = Buffer.from([23, 235, 115, 232, 168, 96, 1, 231]);
      const data = Buffer.concat([
        discriminator,
        serializeOption(null, 4), // baseSurvivalPpm: use default (700_000 = 70%)
        serializeOption(null, 4), // decayPerDivePpm: use default (8_000 = 0.8%)
        serializeOption(null, 4), // minSurvivalPpm: use default (50_000 = 5%)
        serializeOption(null, 2), // treasureMultiplierNum: use default (19)
        serializeOption(null, 2), // treasureMultiplierDen: use default (10)
        serializeOption(null, 2), // maxPayoutMultiplier: use default (100)
        serializeOption(null, 2), // maxDives: use default (50)
        serializeOption(null, 8), // minBet: use default (10_000_000 = 0.01 SOL)
        serializeOption(null, 8), // maxBet: use default (500_000_000 = 0.5 SOL)
      ]);

      const instruction = new TransactionInstruction({
        keys: [
          { pubkey: payer.publicKey, isSigner: true, isWritable: true },
          { pubkey: configPda, isSigner: false, isWritable: true },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        ],
        programId: PROGRAM_ID,
        data,
      });

      const tx = new Transaction().add(instruction);
      const sig = await sendAndConfirmTransaction(connection, tx, [payer]);
      console.log(`   ✅ Config initialized! Signature: ${sig}\n`);
    }
  } catch (error: any) {
    console.error(`   ❌ Error initializing config: ${error.message}\n`);
  }

  // Step 2: Initialize HouseVault
  console.log("Step 2: Initializing HouseVault...");
  const houseAuthority = payer.publicKey; // Using payer as house authority for localnet
  const vaultPda = getHouseVaultPDA(houseAuthority);
  console.log(`   House Authority: ${houseAuthority.toBase58()}`);
  console.log(`   Vault PDA: ${vaultPda.toBase58()}`);

  try {
    const vaultAccount = await connection.getAccountInfo(vaultPda);
    if (vaultAccount) {
      console.log("   ✅ Vault already initialized");
      const vaultBalance = await connection.getBalance(vaultPda);
      console.log(`   💰 Vault balance: ${vaultBalance / LAMPORTS_PER_SOL} SOL\n`);
    } else {
      // Build init_house_vault instruction data
      const discriminator = Buffer.from([82, 247, 65, 25, 166, 239, 30, 112]);
      const lockedByte = Buffer.from([0]); // locked = false
      const data = Buffer.concat([discriminator, lockedByte]);

      const instruction = new TransactionInstruction({
        keys: [
          { pubkey: houseAuthority, isSigner: true, isWritable: true },
          { pubkey: vaultPda, isSigner: false, isWritable: true },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        ],
        programId: PROGRAM_ID,
        data,
      });

      const tx = new Transaction().add(instruction);
      const sig = await sendAndConfirmTransaction(connection, tx, [payer]);
      console.log(`   ✅ Vault initialized! Signature: ${sig}\n`);
    }
  } catch (error: any) {
    console.error(`   ❌ Error initializing vault: ${error.message}\n`);
  }

  // Step 3: Fund the house vault
  console.log("Step 3: Funding house vault...");
  try {
    const vaultBalance = await connection.getBalance(vaultPda);
    const targetBalance = 1000 * LAMPORTS_PER_SOL; // 1000 SOL
    
    if (vaultBalance < targetBalance) {
      const amountToSend = targetBalance - vaultBalance;
      const transferIx = SystemProgram.transfer({
        fromPubkey: payer.publicKey,
        toPubkey: vaultPda,
        lamports: amountToSend,
      });

      const tx = new Transaction().add(transferIx);
      const sig = await sendAndConfirmTransaction(connection, tx, [payer]);
      console.log(`   ✅ Sent ${amountToSend / LAMPORTS_PER_SOL} SOL to vault`);
      console.log(`   Signature: ${sig}\n`);
    } else {
      console.log(`   ✅ Vault already has ${vaultBalance / LAMPORTS_PER_SOL} SOL\n`);
    }
  } catch (error: any) {
    console.error(`   ❌ Error funding vault: ${error.message}\n`);
  }

  console.log("✅ Initialization complete!");
  console.log("\nSummary:");
  console.log(`   Program ID: ${PROGRAM_ID.toBase58()}`);
  console.log(`   Config PDA: ${configPda.toBase58()}`);
  console.log(`   Vault PDA: ${vaultPda.toBase58()}`);
  console.log(`   House Authority: ${houseAuthority.toBase58()}`);
  console.log("\n💡 Add these to your .env.local:");
  console.log(`   NEXT_PUBLIC_PROGRAM_ID="${PROGRAM_ID.toBase58()}"`);
  console.log(`   NEXT_PUBLIC_HOUSE_AUTHORITY="${houseAuthority.toBase58()}"`);
  console.log(`   NEXT_PUBLIC_RPC_URL="http://localhost:8899"`);
}

main().catch(console.error);
