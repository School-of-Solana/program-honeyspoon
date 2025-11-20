import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey, Keypair } from "@solana/web3.js";
import { readFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";

const PROGRAM_ID = new PublicKey("2hMffkY1dCRo548Kj152LNyPomQAiFhw7dVAsgNbZ7F2");

async function main() {
  console.log("🚀 Initializing game on devnet...\n");

  // Load keypair
  const keypairPath = join(homedir(), ".config", "solana", "id.json");
  const keypairData = JSON.parse(readFileSync(keypairPath, "utf-8"));
  const admin = Keypair.fromSecretKey(new Uint8Array(keypairData));

  console.log(`Admin: ${admin.publicKey.toBase58()}`);

  // Setup provider
  const connection = new anchor.web3.Connection("https://api.devnet.solana.com", "confirmed");
  const wallet = new anchor.Wallet(admin);
  const provider = new anchor.AnchorProvider(connection, wallet, {
    commitment: "confirmed",
  });
  anchor.setProvider(provider);

  // Load IDL
  const idlPath = "./frontend/the_fool/lib/solana/idl/dive_game.json";
  const idl = JSON.parse(readFileSync(idlPath, "utf-8"));
  const program = new Program(idl, PROGRAM_ID, provider) as any;

  // Derive PDAs
  const [configPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("game_config")],
    PROGRAM_ID
  );

  const [houseVaultPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("house_vault"), admin.publicKey.toBuffer()],
    PROGRAM_ID
  );

  console.log(`Config PDA: ${configPda.toBase58()}`);
  console.log(`House Vault PDA: ${houseVaultPda.toBase58()}\n`);

  // Check balance
  const balance = await connection.getBalance(admin.publicKey);
  console.log(`Balance: ${balance / 1e9} SOL\n`);

  // Initialize config
  try {
    const config = await program.account.gameConfig.fetch(configPda);
    console.log("✅ Config already initialized");
    console.log(`  Fixed Bet: ${Number(config.fixedBet) / 1e9} SOL`);
  } catch (error) {
    console.log("⏳ Initializing config...");
    const tx = await program.methods
      .initConfig({
        baseSurvivalPpm: null,
        decayPerDivePpm: null,
        minSurvivalPpm: null,
        treasureMultiplierNum: null,
        treasureMultiplierDen: null,
        maxPayoutMultiplier: null,
        maxDives: null,
        fixedBet: null,
      })
      .accounts({
        admin: admin.publicKey,
        config: configPda,
      })
      .rpc();
    console.log(`✅ Config initialized: ${tx}`);
  }

  // Initialize house vault
  try {
    const vault = await program.account.houseVault.fetch(houseVaultPda);
    console.log(`✅ House vault already initialized`);
    console.log(`  Balance: ${vault.lamports / 1e9} SOL`);
    console.log(`  Reserved: ${vault.totalReserved.toString()} lamports`);
  } catch (error) {
    console.log("⏳ Initializing house vault...");
    const tx = await program.methods
      .initHouseVault(false)
      .accounts({
        houseAuthority: admin.publicKey,
        houseVault: houseVaultPda,
      })
      .rpc();
    console.log(`✅ House vault initialized: ${tx}`);
  }

  // Fund house vault if needed
  const vaultBalance = await connection.getBalance(houseVaultPda);
  console.log(`\n💰 House Vault Balance: ${vaultBalance / 1e9} SOL`);

  if (vaultBalance < 10 * 1e9) {
    console.log("⏳ Funding house vault with 50 SOL...");
    const tx = await connection.requestAirdrop(houseVaultPda, 50 * 1e9);
    await connection.confirmTransaction(tx);
    console.log(`✅ House vault funded: ${tx}`);
  }

  console.log("\n🎉 Devnet initialization complete!");
  console.log(`\nProgram ID: ${PROGRAM_ID.toBase58()}`);
  console.log(`Config PDA: ${configPda.toBase58()}`);
  console.log(`House Vault: ${houseVaultPda.toBase58()}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Error:", error);
    process.exit(1);
  });
