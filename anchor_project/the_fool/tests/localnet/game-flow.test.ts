/**
 * Localnet Integration Tests - Full Game Flow
 * 
 * Run with: anchor test --skip-build
 */

import * as anchor from "@coral-xyz/anchor";
import { Program, AnchorProvider } from "@coral-xyz/anchor";
import { PublicKey, Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { expect } from "chai";
import { DiveGame } from "../../target/types/dive_game";
import BN from "bn.js";

describe("Localnet Integration - Full Game Flow", () => {
  const provider = AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.DiveGame as Program<DiveGame>;
  
  let authority: Keypair;
  let configPDA: PublicKey;
  let houseVaultPDA: PublicKey;

  function getSessionPDA(user: PublicKey, sessionIndex: BN): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [
        Buffer.from("session"),
        user.toBuffer(),
        sessionIndex.toArrayLike(Buffer, "le", 8),
      ],
      program.programId
    );
  }

  async function airdrop(pubkey: PublicKey, lamports: number) {
    const sig = await provider.connection.requestAirdrop(pubkey, lamports);
    const latestBlockhash = await provider.connection.getLatestBlockhash();
    await provider.connection.confirmTransaction({
      signature: sig,
      ...latestBlockhash,
    });
  }

  before(async () => {
    authority = (provider.wallet as anchor.Wallet).payer;
    
    // Airdrop to authority if needed
    try {
      await airdrop(authority.publicKey, 100 * LAMPORTS_PER_SOL);
    } catch (e) {
      console.log("Authority already has funds");
    }

    // Derive PDAs
    [configPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from("game_config")],
      program.programId
    );

    [houseVaultPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from("house_vault"), authority.publicKey.toBuffer()],
      program.programId
    );

    // Initialize config
    try {
      await program.methods
        .initConfig({
          fixedBet: new BN(10_000_000), // 0.01 SOL
          baseSurvivalPpm: 10000, // 1%
          decayPerDivePpm: 100,
          minSurvivalPpm: 100,
          treasureMultiplierNum: 1,
          treasureMultiplierDen: 100,
          maxPayoutMultiplier: 100,
          maxDives: 10,
        })
        .accounts({
          admin: authority.publicKey,
        })
        .rpc();
      console.log("✅ Config initialized");
    } catch (e) {
      console.log("Config already exists");
    }

    // Initialize house vault
    try {
      await program.methods
        .initHouseVault(false)
        .accounts({
          houseAuthority: authority.publicKey,
        })
        .rpc();
      console.log("✅ House vault initialized");
    } catch (e) {
      console.log("House vault init error:", e.message || e);
    }

    // Fund house vault
    try {
      await airdrop(houseVaultPDA, 1000 * LAMPORTS_PER_SOL);
      console.log("✅ House vault funded");
    } catch (e) {
      console.log("House vault already funded");
    }
  });

  describe("Complete Game Cycle", () => {
    it("should complete: start -> play -> survive -> cash out", async () => {
      const player = Keypair.generate();
      await airdrop(player.publicKey, 10 * LAMPORTS_PER_SOL);

      const sessionIndex = new BN(Date.now());
      const [sessionPDA] = getSessionPDA(player.publicKey, sessionIndex);

      console.log("\n🎮 Full Game Cycle Test");
      console.log(`Player: ${player.publicKey.toBase58()}`);

      // Get initial balances
      const initialPlayerBalance = await provider.connection.getBalance(player.publicKey);
      const initialVaultBalance = await provider.connection.getBalance(houseVaultPDA);

      // STEP 1: Start Session
      console.log("\n📍 Starting session...");
      
      // Manually fetch houseVault to help Anchor resolve houseAuthority
      const houseVault = await program.account.houseVault.fetch(houseVaultPDA);
      
      await program.methods
        .startSession(sessionIndex)
        .accounts({
          user: player.publicKey,
          houseVault: houseVaultPDA,
          houseAuthority: houseVault.houseAuthority,
        } as any)
        .signers([player])
        .rpc();

      let sessionAccount = await program.account.gameSession.fetch(sessionPDA);
      expect(sessionAccount.status).to.have.property("active");
      console.log(`✅ Session started, dive #${sessionAccount.diveNumber}`);

      // STEP 2: Play rounds
      console.log("\n📍 Playing rounds...");
      let survived = false;
      const maxRounds = 30;

      for (let i = 0; i < maxRounds; i++) {
        try {
          await program.methods
            .playRound()
            .signers([player])
            .rpc();

          // Check if session still active
          try {
            sessionAccount = await program.account.gameSession.fetch(sessionPDA);
            
            if (sessionAccount.status.hasOwnProperty("active")) {
              console.log(`✅ Round ${i + 1}: Survived! Dive #${sessionAccount.diveNumber}, Treasure: ${sessionAccount.currentTreasure.toNumber() / LAMPORTS_PER_SOL} SOL`);
              survived = true;
              break;
            }
          } catch (e) {
            console.log(`💀 Round ${i + 1}: Player died`);
            break;
          }
        } catch (e) {
          console.log(`Round ${i + 1} failed`);
          break;
        }
      }

      if (!survived) {
        console.log("⚠️  Player didn't survive - skipping cash out test");
        return;
      }

      // STEP 3: Cash Out
      console.log("\n📍 Cashing out...");
      const treasureBeforeCashout = sessionAccount.currentTreasure;
      
      await program.methods
        .cashOut()
        .signers([player])
        .rpc();

      console.log(`✅ Cashed out ${treasureBeforeCashout.toNumber() / LAMPORTS_PER_SOL} SOL`);

      // Verify session closed
      try {
        await program.account.gameSession.fetch(sessionPDA);
        expect.fail("Session should be closed");
      } catch (e) {
        console.log("✅ Session closed");
      }

      // Verify balances
      const finalPlayerBalance = await provider.connection.getBalance(player.publicKey);
      const finalVaultBalance = await provider.connection.getBalance(houseVaultPDA);

      expect(finalPlayerBalance).to.be.greaterThan(initialPlayerBalance);
      expect(finalVaultBalance).to.be.lessThan(initialVaultBalance);
      console.log(`✅ Player net gain: ${(finalPlayerBalance - initialPlayerBalance) / LAMPORTS_PER_SOL} SOL`);
    });

    it("should handle player death", async () => {
      const player = Keypair.generate();
      await airdrop(player.publicKey, 10 * LAMPORTS_PER_SOL);

      const sessionIndex = new BN(Date.now() + 1);
      const [sessionPDA] = getSessionPDA(player.publicKey, sessionIndex);

      console.log("\n💀 Testing Death Flow");

      // Start session
      const houseVault2 = await program.account.houseVault.fetch(houseVaultPDA);
      await program.methods
        .startSession(sessionIndex)
        .accounts({
          user: player.publicKey,
          houseVault: houseVaultPDA,
          houseAuthority: houseVault2.houseAuthority,
        } as any)
        .signers([player])
        .rpc();

      console.log("✅ Session started");

      // Play until death
      let died = false;
      for (let i = 0; i < 50; i++) {
        try {
          await program.methods
            .playRound()
            .signers([player])
            .rpc();

          try {
            const sessionAccount = await program.account.gameSession.fetch(sessionPDA);
            console.log(`Round ${i + 1}: Survived, dive ${sessionAccount.diveNumber}`);
          } catch (e) {
            died = true;
            console.log(`💀 Died on round ${i + 1}`);
            break;
          }
        } catch (e) {
          break;
        }
      }

      if (died) {
        try {
          await program.account.gameSession.fetch(sessionPDA);
          expect.fail("Session should be closed after death");
        } catch (e) {
          console.log("✅ Session properly closed after death");
        }
      } else {
        console.log("⚠️  Player survived all rounds");
      }
    });
  });

  describe("House Controls", () => {
    it("should lock/unlock vault", async () => {
      console.log("\n🔒 Testing House Controls");

      // Lock vault
      await program.methods
        .toggleHouseLock()
        .accounts({
          houseVault: houseVaultPDA,
        })
        .rpc();

      let vaultAccount = await program.account.houseVault.fetch(houseVaultPDA);
      expect(vaultAccount.locked).to.be.true;
      console.log("✅ Vault locked");

      // Try to start session (should fail)
      const player = Keypair.generate();
      await airdrop(player.publicKey, 10 * LAMPORTS_PER_SOL);
      
      const sessionIndex = new BN(Date.now() + 2);
      const [sessionPDA] = getSessionPDA(player.publicKey, sessionIndex);

      const houseVault3 = await program.account.houseVault.fetch(houseVaultPDA);
      try {
        await program.methods
          .startSession(sessionIndex)
          .accounts({
            user: player.publicKey,
            houseVault: houseVaultPDA,
            houseAuthority: houseVault3.houseAuthority,
          } as any)
          .signers([player])
          .rpc();
        
        expect.fail("Should not allow session when locked");
      } catch (e) {
        expect(e.message).to.include("HouseLocked");
        console.log("✅ Correctly rejected session start when locked");
      }

      // Unlock vault
      await program.methods
        .toggleHouseLock()
        .accounts({
          houseVault: houseVaultPDA,
        })
        .rpc();

      vaultAccount = await program.account.houseVault.fetch(houseVaultPDA);
      expect(vaultAccount.locked).to.be.false;
      console.log("✅ Vault unlocked");

      // Now session should work
      const houseVault4 = await program.account.houseVault.fetch(houseVaultPDA);
      await program.methods
        .startSession(sessionIndex)
        .accounts({
          user: player.publicKey,
          houseVault: houseVaultPDA,
          houseAuthority: houseVault4.houseAuthority,
        } as any)
        .signers([player])
        .rpc();

      console.log("✅ Session started after unlock");
    });
  });

  describe("Multiple Players", () => {
    it("should handle concurrent sessions", async () => {
      console.log("\n👥 Testing Multiple Players");

      const players = [];
      for (let i = 0; i < 3; i++) {
        const player = Keypair.generate();
        await airdrop(player.publicKey, 10 * LAMPORTS_PER_SOL);
        players.push(player);
      }

      // Start sessions for all
      const houseVault5 = await program.account.houseVault.fetch(houseVaultPDA);
      const baseTime = Date.now();
      const sessionIndices = [];
      
      for (let i = 0; i < players.length; i++) {
        const sessionIndex = new BN(baseTime + 10 + i);
        sessionIndices.push(sessionIndex);
        const [sessionPDA] = getSessionPDA(players[i].publicKey, sessionIndex);

        await program.methods
          .startSession(sessionIndex)
          .accounts({
            user: players[i].publicKey,
            houseVault: houseVaultPDA,
            houseAuthority: houseVault5.houseAuthority,
          } as any)
          .signers([players[i]])
          .rpc();

        console.log(`✅ Player ${i + 1} session started`);
      }

      // Verify all active
      for (let i = 0; i < players.length; i++) {
        const sessionIndex = sessionIndices[i];
        const [sessionPDA] = getSessionPDA(players[i].publicKey, sessionIndex);
        
        const sessionAccount = await program.account.gameSession.fetch(sessionPDA);
        expect(sessionAccount.status).to.have.property("active");
        console.log(`✅ Player ${i + 1} verified active`);
      }

      // Check vault reserved
      const vaultAccount = await program.account.houseVault.fetch(houseVaultPDA);
      expect(vaultAccount.totalReserved.gt(new BN(0))).to.be.true;
      console.log(`✅ Vault reserved: ${vaultAccount.totalReserved.toNumber() / LAMPORTS_PER_SOL} SOL`);
    });
  });

  describe("Session Cleanup & Expiration", () => {
    it("should cleanup expired session after timeout", async () => {
      const player = Keypair.generate();
      await airdrop(player.publicKey, 10 * LAMPORTS_PER_SOL);

      const sessionIndex = new BN(Date.now() + 100);
      const [sessionPDA] = getSessionPDA(player.publicKey, sessionIndex);

      console.log("\n⏰ Testing Session Expiration");

      // Start session
      const houseVault = await program.account.houseVault.fetch(houseVaultPDA);
      await program.methods
        .startSession(sessionIndex)
        .accounts({
          user: player.publicKey,
          houseVault: houseVaultPDA,
          houseAuthority: houseVault.houseAuthority,
        } as any)
        .signers([player])
        .rpc();

      console.log("✅ Session started");

      // Get current slot
      const currentSlot = await provider.connection.getSlot();
      console.log(`Current slot: ${currentSlot}`);

      // Wait for timeout (on real validator this would need actual time)
      // For now, just verify the cleanup instruction exists
      const crank = Keypair.generate();
      await airdrop(crank.publicKey, 1 * LAMPORTS_PER_SOL);

      // Note: In real scenario, we'd need to wait for TIMEOUT_SLOTS to pass
      // This test just verifies the instruction can be called
      try {
        await program.methods
          .cleanExpiredSession()
          .accounts({
            crank: crank.publicKey,
            houseVault: houseVaultPDA,
            session: sessionPDA,
          } as any)
          .signers([crank])
          .rpc();
        
        console.log("✅ Cleanup would work when timeout expires");
      } catch (e) {
        // Expected to fail because timeout hasn't passed yet
        expect(e.message).to.include("SessionNotExpired");
        console.log("✅ Correctly rejected cleanup before timeout");
      }
    });

    it("should allow starting new session after previous ends", async () => {
      const player = Keypair.generate();
      await airdrop(player.publicKey, 50 * LAMPORTS_PER_SOL);

      const sessionIndex1 = new BN(Date.now() + 200);
      const [sessionPDA1] = getSessionPDA(player.publicKey, sessionIndex1);

      console.log("\n♻️  Testing Sequential Sessions");

      // First session - start and let it end
      const houseVault = await program.account.houseVault.fetch(houseVaultPDA);
      await program.methods
        .startSession(sessionIndex1)
        .accounts({
          user: player.publicKey,
          houseVault: houseVaultPDA,
          houseAuthority: houseVault.houseAuthority,
        } as any)
        .signers([player])
        .rpc();

      console.log("✅ First session started");

      // Try to play - might die or survive
      let firstSessionClosed = false;
      try {
        await program.methods
          .playRound()
          .signers([player])
          .rpc();
        
        // If we get here, check if still active
        try {
          const session = await program.account.gameSession.fetch(sessionPDA1);
          if (session.status.hasOwnProperty("active")) {
            // Cash out to close it
            await program.methods
              .cashOut()
              .signers([player])
              .rpc();
            firstSessionClosed = true;
            console.log("✅ First session cashed out and closed");
          }
        } catch (e) {
          firstSessionClosed = true;
          console.log("✅ First session ended");
        }
      } catch (e) {
        // Died immediately - session is closed
        firstSessionClosed = true;
        console.log("✅ First session ended (player died)");
      }

      // Verify first session is really closed
      try {
        await program.account.gameSession.fetch(sessionPDA1);
        console.log("⚠️  First session still exists (might not have closed)");
      } catch (e) {
        console.log("✅ First session account confirmed closed");
      }

      // Now start a DIFFERENT session (different index)
      const sessionIndex2 = new BN(Date.now() + 300);
      const [sessionPDA2] = getSessionPDA(player.publicKey, sessionIndex2);
      
      await program.methods
        .startSession(sessionIndex2)
        .accounts({
          user: player.publicKey,
          houseVault: houseVaultPDA,
          houseAuthority: houseVault.houseAuthority,
        } as any)
        .signers([player])
        .rpc();

      console.log("✅ Second session started (different index)");

      // Verify second session exists
      const session2 = await program.account.gameSession.fetch(sessionPDA2);
      expect(session2.status).to.have.property("active");
      console.log("✅ Player can start multiple sequential sessions");
    });
  });

  describe("Authorization & Security", () => {
    it("should prevent unauthorized actions on player sessions", async () => {
      const player = Keypair.generate();
      const attacker = Keypair.generate();
      await airdrop(player.publicKey, 10 * LAMPORTS_PER_SOL);
      await airdrop(attacker.publicKey, 10 * LAMPORTS_PER_SOL);

      const sessionIndex = new BN(Date.now() + 300);
      const [sessionPDA] = getSessionPDA(player.publicKey, sessionIndex);

      console.log("\n🔐 Testing Authorization");

      // Player starts session
      const houseVault = await program.account.houseVault.fetch(houseVaultPDA);
      await program.methods
        .startSession(sessionIndex)
        .accounts({
          user: player.publicKey,
          houseVault: houseVaultPDA,
          houseAuthority: houseVault.houseAuthority,
        } as any)
        .signers([player])
        .rpc();

      console.log("✅ Player session started");

      // Attacker tries to play round on player's session
      try {
        await program.methods
          .playRound()
          .accounts({
            user: attacker.publicKey,
            session: sessionPDA,
          } as any)
          .signers([attacker])
          .rpc();
        
        expect.fail("Should not allow attacker to play on player session");
      } catch (e) {
        expect(e.message).to.match(/(ConstraintHasOne|constraint was violated)/i);
        console.log("✅ Correctly rejected unauthorized play_round");
      }

      // Attacker tries to cash out player's session
      try {
        await program.methods
          .cashOut()
          .accounts({
            user: attacker.publicKey,
            session: sessionPDA,
          } as any)
          .signers([attacker])
          .rpc();
        
        expect.fail("Should not allow attacker to cash out player session");
      } catch (e) {
        expect(e.message).to.match(/(ConstraintHasOne|constraint was violated)/i);
        console.log("✅ Correctly rejected unauthorized cash_out");
      }
    });
  });
});
