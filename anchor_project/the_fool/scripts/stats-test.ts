import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import { Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";
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

  const [houseVaultPDA] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from(HOUSE_VAULT_SEED)],
    program.programId
  );

  console.log("\n🎲 Running 100-game RNG statistical test...");
  console.log("Expected: ~70 survive dive 1, ~30 die (within ±10 for 99.9% confidence)\n");

  const NUM_GAMES = 100;
  const EXPECTED_SURVIVAL_RATE = 0.70;
  const CONFIDENCE_99_9 = 3.29;

  const stdDev = Math.sqrt(NUM_GAMES * EXPECTED_SURVIVAL_RATE * (1 - EXPECTED_SURVIVAL_RATE));
  const margin = CONFIDENCE_99_9 * stdDev;
  const expectedSurvivors = NUM_GAMES * EXPECTED_SURVIVAL_RATE;
  const minAcceptable = Math.floor(expectedSurvivors - margin);
  const maxAcceptable = Math.ceil(expectedSurvivors + margin);

  console.log(`📊 Statistical bounds (99.9% confidence):`);
  console.log(`   Expected survivors: ${expectedSurvivors.toFixed(1)}`);
  console.log(`   Standard deviation: ${stdDev.toFixed(2)}`);
  console.log(`   Acceptable range: ${minAcceptable}-${maxAcceptable} survivors`);
  console.log(`   (This test should fail only 0.1% of the time with fair RNG)\n`);

  const houseVault = await program.account.houseVault.fetch(houseVaultPDA);
  let survivors = 0;
  let deaths = 0;

  console.log("🎮 Creating and funding 100 test players...");
  const startTime = Date.now();

  for (let i = 0; i < NUM_GAMES; i++) {
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

      // Check if survived
      try {
        const session = await program.account.gameSession.fetch(sessionPDA);
        if (session.diveNumber > 1) {
          survivors++;
          // Clean up
          try {
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
            // Already closed
          }
        } else {
          deaths++;
        }
      } catch (e) {
        deaths++;
      }
    } catch (e) {
      console.error(`❌ Game ${i + 1} failed:`, e.message);
    }

    if ((i + 1) % 10 === 0) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`   Progress: ${i + 1}/${NUM_GAMES} games (${survivors} survived, ${deaths} died) [${elapsed}s]`);
    }
  }

  const totalGames = survivors + deaths;
  const survivalRate = (survivors / totalGames) * 100;
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log(`\n⏱️  Completed in ${elapsed}s\n`);
  console.log(`📊 FINAL RESULTS:`);
  console.log(`   Total games: ${totalGames}`);
  console.log(`   Survivors: ${survivors} (${survivalRate.toFixed(1)}%)`);
  console.log(`   Deaths: ${deaths} (${((deaths/totalGames)*100).toFixed(1)}%)`);
  console.log(`   Expected: ${expectedSurvivors.toFixed(1)} survivors (${(EXPECTED_SURVIVAL_RATE*100).toFixed(0)}%)`);
  console.log(`   Acceptable range: ${minAcceptable}-${maxAcceptable} survivors\n`);

  // Statistical analysis
  const zScore = Math.abs((survivors - expectedSurvivors) / stdDev);
  console.log(`📈 STATISTICAL ANALYSIS:`);
  console.log(`   Z-score: ${zScore.toFixed(2)}`);
  console.log(`   Threshold (99.9% confidence): ${CONFIDENCE_99_9}`);

  if (survivors >= minAcceptable && survivors <= maxAcceptable) {
    console.log(`\n✅ PASS: RNG is statistically valid! (z-score: ${zScore.toFixed(2)} < ${CONFIDENCE_99_9})`);
    console.log(`   The survival rate is within expected bounds for fair randomness.`);
  } else {
    console.log(`\n❌ FAIL: RNG is statistically biased! (z-score: ${zScore.toFixed(2)} > ${CONFIDENCE_99_9})`);
    console.log(`   This result would only occur 0.1% of the time with fair RNG.`);
    if (survivors < minAcceptable) {
      console.log(`   ⚠️  Too few survivors (possible death bias)`);
    } else {
      console.log(`   ⚠️  Too many survivors (possible survival bias)`);
    }
  }

  console.log();
}

main().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
