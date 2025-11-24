import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import { Keypair, LAMPORTS_PER_SOL, SystemProgram } from "@solana/web3.js";
import { DiveGame } from "../target/types/dive_game";

const GAME_CONFIG_SEED = "game_config";
const HOUSE_VAULT_SEED = "house_vault";
const SESSION_SEED = "session";

function getSessionPDA(user: anchor.web3.PublicKey, sessionIndex: BN) {
  return anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from(SESSION_SEED), user.toBuffer(), sessionIndex.toArrayLike(Buffer, "le", 8)],
    anchor.workspace.DiveGame.programId
  );
}

async function main() {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.DiveGame as Program<DiveGame>;

  const [gameConfigPDA] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from(GAME_CONFIG_SEED)],
    program.programId
  );

  const [houseVaultPDA] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from(HOUSE_VAULT_SEED)],
    program.programId
  );

  console.log("\n🎲 Quick RNG Test - 10 Games\n");

  const houseVault = await program.account.houseVault.fetch(houseVaultPDA);
  let survivors = 0;
  let deaths = 0;

  for (let i = 0; i < 10; i++) {
    const player = Keypair.generate();
    
    // Airdrop
    const airdropSig = await provider.connection.requestAirdrop(
      player.publicKey,
      1 * LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(airdropSig);

    const sessionIndex = new BN(Date.now() + i * 1000);
    const [sessionPDA] = getSessionPDA(player.publicKey, sessionIndex);

    try {
      // Start session
      await program.methods
        .startSession(sessionIndex)
        .accounts({
          user: player.publicKey,
          houseVault: houseVaultPDA,
          houseAuthority: houseVault.houseAuthority,
        } as any)
        .signers([player])
        .rpc();

      // Play first round
      await program.methods
        .playRound()
        .accounts({
          user: player.publicKey,
          session: sessionPDA,
          houseVault: houseVaultPDA,
        } as any)
        .signers([player])
        .rpc();

      // Check if survived by fetching session
      try {
        const session = await program.account.gameSession.fetch(sessionPDA);
        survivors++;
        console.log(`Game ${i + 1}: ✅ SURVIVED (dive ${session.diveNumber})`);
        
        // Clean up
        await program.methods
          .loseSession()
          .accounts({
            user: player.publicKey,
            session: sessionPDA,
            houseVault: houseVaultPDA,
          } as any)
          .signers([player])
          .rpc();
      } catch (e) {
        deaths++;
        console.log(`Game ${i + 1}: 💀 DIED`);
      }
    } catch (e) {
      console.log(`Game ${i + 1}: ❌ ERROR - ${e.message}`);
    }
  }

  console.log(`\n📊 Results: ${survivors} survivors, ${deaths} deaths`);
  console.log(`   Survival rate: ${((survivors/10)*100).toFixed(1)}%`);
  console.log(`   Expected: ~70% survival\n`);
}

main().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
