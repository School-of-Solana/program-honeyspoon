import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import { Keypair, LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { DiveGame } from "../../target/types/dive_game";
import { expect } from "chai";

describe("🔍 Debug RNG Single Game", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.DiveGame as Program<DiveGame>;

  const HOUSE_VAULT_SEED = "house_vault";
  const SESSION_SEED = "session";
  const CONFIG_SEED = "game_config";

  let authority: Keypair;
  let configPDA: PublicKey;
  let houseVaultPDA: PublicKey;

  function getSessionPDA(user: PublicKey, sessionIndex: BN): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [
        Buffer.from(SESSION_SEED),
        user.toBuffer(),
        sessionIndex.toArrayLike(Buffer, "le", 8),
      ],
      program.programId
    );
  }

  async function airdrop(pubkey: PublicKey, amount: number) {
    const sig = await provider.connection.requestAirdrop(pubkey, amount);
    await provider.connection.confirmTransaction(sig);
  }

  before(async () => {
    authority = Keypair.fromSecretKey(
      Buffer.from(
        JSON.parse(
          require("fs").readFileSync(
            require("os").homedir() + "/.config/solana/id.json",
            "utf-8"
          )
        )
      )
    );

    [configPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from(CONFIG_SEED)],
      program.programId
    );

    [houseVaultPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from(HOUSE_VAULT_SEED), authority.publicKey.toBuffer()],
      program.programId
    );

    // Ensure authority has funds
    const balance = await provider.connection.getBalance(authority.publicKey);
    if (balance < LAMPORTS_PER_SOL) {
      await airdrop(authority.publicKey, 10 * LAMPORTS_PER_SOL);
    }

    // Ensure config exists
    try {
      await program.account.gameConfig.fetch(configPDA);
    } catch (e) {
      const base = 700000;
      const decay = 8000;
      const min = 50000;
      const num = 19;
      const den = 10;
      const maxPayout = 100;
      const maxDives = 5;
      const fixedBet = 10_000_000;
      
      await program.methods
        .initConfig({
          baseSurvivalPpm: base,
          decayPerDivePpm: decay,
          minSurvivalPpm: min,
          treasureMultiplierNum: num,
          treasureMultiplierDen: den,
          maxPayoutMultiplier: maxPayout,
          maxDives: maxDives,
          fixedBet: new BN(fixedBet)
        })
        .accounts({ admin: authority.publicKey } as any)
        .signers([authority])
        .rpc();
    }

    // Ensure vault exists and is funded
    try {
      await program.account.houseVault.fetch(houseVaultPDA);
    } catch (e) {
      await program.methods
        .initHouseVault(false)
        .accounts({ houseAuthority: authority.publicKey } as any)
        .signers([authority])
        .rpc();
      
      await provider.connection.confirmTransaction(
        await provider.connection.requestAirdrop(houseVaultPDA, 30 * LAMPORTS_PER_SOL)
      );
    }
  });

  it("should show detailed RNG logs for a single game", async () => {
    console.log("\n🔍 Playing single game with detailed RNG logging...\n");

    const player = Keypair.generate();
    await airdrop(player.publicKey, 1 * LAMPORTS_PER_SOL);
    console.log(`Player: ${player.publicKey.toBase58()}`);

    const sessionIndex = new BN(Date.now());
    const [sessionPDA] = getSessionPDA(player.publicKey, sessionIndex);
    console.log(`Session PDA: ${sessionPDA.toBase58()}`);
    console.log(`Session Index: ${sessionIndex.toString()}\n`);

    const houseVault = await program.account.houseVault.fetch(houseVaultPDA);
    
    // Start session
    console.log("📍 Starting session...");
    const startTx = await program.methods
      .startSession(sessionIndex)
      .accounts({
        user: player.publicKey,
        houseVault: houseVaultPDA,
        houseAuthority: houseVault.houseAuthority,
      } as any)
      .signers([player])
      .rpc();

    console.log(`✅ Session started: ${startTx}\n`);

    // Play round and capture logs
    console.log("🎲 Playing round 1...");
    const playTx = await program.methods
      .playRound()
      .accounts({
        user: player.publicKey,
        session: sessionPDA,
        houseVault: houseVaultPDA,
      } as any)
      .signers([player])
      .rpc();

    console.log(`✅ Round completed: ${playTx}\n`);

    // Fetch transaction logs
    const txDetails = await provider.connection.getTransaction(playTx, {
      commitment: "confirmed",
      maxSupportedTransactionVersion: 0
    });

    console.log("📋 TRANSACTION LOGS:");
    console.log("=".repeat(80));
    if (txDetails && txDetails.meta && txDetails.meta.logMessages) {
      txDetails.meta.logMessages.forEach(log => {
        if (log.includes("RNG_") || log.includes("Program log:")) {
          console.log(log);
        }
      });
    }
    console.log("=".repeat(80));

    // Check result
    try {
      const session = await program.account.gameSession.fetch(sessionPDA);
      console.log(`\n✅ SURVIVED! Dive number: ${session.diveNumber}, Treasure: ${session.currentTreasure.toNumber() / LAMPORTS_PER_SOL} SOL`);
      
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
      console.log("\n💀 DIED on first dive");
    }

    console.log("\n");
  });

  it("should run 20 games and show RNG statistics", async () => {
    console.log("\n🎲 Running 20 games with detailed logging...\n");

    let survivors = 0;
    let deaths = 0;
    const rolls: number[] = [];

    for (let i = 0; i < 20; i++) {
      const player = Keypair.generate();
      await airdrop(player.publicKey, 1 * LAMPORTS_PER_SOL);

      const sessionIndex = new BN(Date.now() + 1000 + i);
      const [sessionPDA] = getSessionPDA(player.publicKey, sessionIndex);

      const houseVault = await program.account.houseVault.fetch(houseVaultPDA);

      try {
        await program.methods
          .startSession(sessionIndex)
          .accounts({
            user: player.publicKey,
            houseVault: houseVaultPDA,
            houseAuthority: houseVault.houseAuthority,
          } as any)
          .signers([player])
          .rpc();

        const playTx = await program.methods
          .playRound()
          .accounts({
            user: player.publicKey,
            session: sessionPDA,
            houseVault: houseVaultPDA,
          } as any)
          .signers([player])
          .rpc();

        // Extract roll from logs
        const txDetails = await provider.connection.getTransaction(playTx, {
          commitment: "confirmed",
          maxSupportedTransactionVersion: 0
        });

        let loggedSurvival: boolean | null = null;
        if (txDetails && txDetails.meta && txDetails.meta.logMessages) {
          const rollLog = txDetails.meta.logMessages.find(log => log.includes("RNG_ROLL"));
          if (rollLog) {
            const rollMatch = rollLog.match(/roll=(\d+)/);
            const thresholdMatch = rollLog.match(/threshold=(\d+)/);
            const survivedMatch = rollLog.match(/survived=(\w+)/);
            
            if (rollMatch && thresholdMatch && survivedMatch) {
              const roll = parseInt(rollMatch[1]);
              const threshold = parseInt(thresholdMatch[1]);
              const survived = survivedMatch[1] === 'true';
              loggedSurvival = survived;
              
              rolls.push(roll);
              console.log(`Game ${i + 1}: roll=${roll}, threshold=${threshold}, survived=${survived}`);
            }
          }
        }

        // Check actual result by trying to fetch session
        try {
          const session = await program.account.gameSession.fetch(sessionPDA);
          // Session exists = player survived
          if (loggedSurvival === null) {
            // Only count if we didn't already count from logs
            survivors++;
          }
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
          // Session doesn't exist = player died
          if (loggedSurvival === null) {
            // Only count if we didn't already count from logs
            deaths++;
          }
        }
      } catch (e) {
        console.error(`Game ${i + 1} failed:`, e.message);
      }
    }

    console.log("\n📊 STATISTICS:");
    console.log(`   Survivors: ${survivors}/20 (${(survivors/20*100).toFixed(1)}%)`);
    console.log(`   Deaths: ${deaths}/20 (${(deaths/20*100).toFixed(1)}%)`);
    console.log(`   Expected: ~14 survivors (70%)`);
    
    if (rolls.length > 0) {
      console.log(`\n📈 Roll Analysis (${rolls.length} rolls captured):`);
      console.log(`   Min: ${Math.min(...rolls)}`);
      console.log(`   Max: ${Math.max(...rolls)}`);
      console.log(`   Avg: ${(rolls.reduce((a,b) => a+b, 0) / rolls.length).toFixed(0)}`);
      console.log(`   Rolls < 700k: ${rolls.filter(r => r < 700000).length}`);
      console.log(`   Rolls >= 700k: ${rolls.filter(r => r >= 700000).length}`);
    }

    console.log("\n");
    
    // Should have at least some survivors
    expect(survivors).to.be.greaterThan(0, "All games died - RNG is broken!");
  });
});
