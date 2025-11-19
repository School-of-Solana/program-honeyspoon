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

const PROGRAM_ID = new PublicKey(
  "CBdZ8FbqsgSSiKunsJgr8vogMD4pKqkoXzzi9ZB4URz1"
);

const GAME_CONFIG_SEED = "game_config";
const HOUSE_VAULT_SEED = "house_vault";

function serializeOption(
  value: number | null | undefined,
  size: number
): Buffer {
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

function getHouseVaultPDA(houseAuthority: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from(HOUSE_VAULT_SEED), houseAuthority.toBuffer()],
    PROGRAM_ID
  );
  return pda;
}

async function main() {
  const rpcUrl = process.env.RPC_URL || "http://localhost:8899";
  const networkName = rpcUrl.includes("devnet") ? "devnet" : "localnet";

  console.log(`🚀 Initializing dive_game on ${networkName}...\n`);

  const connection = new Connection(rpcUrl, "confirmed");

  const keypairPath = path.join(os.homedir(), ".config", "solana", "id.json");
  const keypairData = JSON.parse(fs.readFileSync(keypairPath, "utf-8"));
  const payer = Keypair.fromSecretKey(Uint8Array.from(keypairData));

  console.log(`📍 Payer: ${payer.publicKey.toBase58()}`);
  const balance = await connection.getBalance(payer.publicKey);
  console.log(`💰 Balance: ${balance / LAMPORTS_PER_SOL} SOL\n`);

  console.log("Step 1: Initializing GameConfig...");
  const configPda = getConfigPDA();
  console.log(`   Config PDA: ${configPda.toBase58()}`);

  try {
    const configAccount = await connection.getAccountInfo(configPda);
    if (configAccount) {
      console.log("   ✅ Config already initialized\n");
    } else {
      const discriminator = Buffer.from([23, 235, 115, 232, 168, 96, 1, 231]);
      const data = Buffer.concat([
        discriminator,
        serializeOption(null, 4),
        serializeOption(null, 4),
        serializeOption(null, 4),
        serializeOption(null, 2),
        serializeOption(null, 2),
        serializeOption(null, 2),
        serializeOption(null, 2),
        serializeOption(100_000_000, 8),
        serializeOption(10_000_000_000, 8),
      ]);

      const instruction = new TransactionInstruction({
        keys: [
          { pubkey: payer.publicKey, isSigner: true, isWritable: true },
          { pubkey: configPda, isSigner: false, isWritable: true },
          {
            pubkey: SystemProgram.programId,
            isSigner: false,
            isWritable: false,
          },
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

  console.log("Step 2: Initializing HouseVault...");
  const houseAuthority = payer.publicKey;
  const vaultPda = getHouseVaultPDA(houseAuthority);
  console.log(`   House Authority: ${houseAuthority.toBase58()}`);
  console.log(`   Vault PDA: ${vaultPda.toBase58()}`);

  try {
    const vaultAccount = await connection.getAccountInfo(vaultPda);
    if (vaultAccount) {
      console.log("   ✅ Vault already initialized");
      const vaultBalance = await connection.getBalance(vaultPda);
      console.log(
        `   💰 Vault balance: ${vaultBalance / LAMPORTS_PER_SOL} SOL\n`
      );
    } else {
      const discriminator = Buffer.from([82, 247, 65, 25, 166, 239, 30, 112]);
      const lockedByte = Buffer.from([0]);
      const data = Buffer.concat([discriminator, lockedByte]);

      const instruction = new TransactionInstruction({
        keys: [
          { pubkey: houseAuthority, isSigner: true, isWritable: true },
          { pubkey: vaultPda, isSigner: false, isWritable: true },
          {
            pubkey: SystemProgram.programId,
            isSigner: false,
            isWritable: false,
          },
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

  console.log("Step 3: Funding house vault...");
  try {
    const vaultBalance = await connection.getBalance(vaultPda);
    const targetBalance = 1000 * LAMPORTS_PER_SOL;

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
      console.log(
        `   ✅ Vault already has ${vaultBalance / LAMPORTS_PER_SOL} SOL\n`
      );
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
  console.log(`   NEXT_PUBLIC_RPC_URL="${rpcUrl}"`);
}

main().catch(console.error);
