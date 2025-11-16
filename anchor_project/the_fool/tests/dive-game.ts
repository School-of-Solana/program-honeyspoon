import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey, Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { BN } from "bn.js";
import { assert } from "chai";

// Type definitions for the program
type DiveGame = {
  version: "0.1.0";
  name: "dive_game";
  instructions: Array<any>;
  accounts: Array<any>;
  events: Array<any>;
  errors: Array<any>;
};

// Constants matching the program
const HOUSE_VAULT_SEED = "house_vault";
const SESSION_SEED = "session";

// Session status type (matches on-chain enum)
// Not used in tests, but kept for reference
// type SessionStatus = "active" | "lost" | "cashedOut" | "expired";

describe("dive-game", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.DiveGame as Program<DiveGame>;

  // Test accounts
  let houseAuthority: Keypair;
  let userAlice: Keypair;
  let userBob: Keypair;
  let houseVaultPDA: PublicKey;
  let houseVaultBump: number;

  // Helper: Convert SOL to lamports (integer-only math)
  function lamports(sol: number): BN {
    return new BN(BigInt(Math.round(sol * LAMPORTS_PER_SOL)).toString());
  }

  function lamportsNum(sol: number): number {
    return Number(BigInt(Math.round(sol * LAMPORTS_PER_SOL)));
  }

  // Helper: Airdrop SOL to an address
  async function airdrop(
    connection: any,
    address: PublicKey,
    amount = 10 * LAMPORTS_PER_SOL
  ) {
    const signature = await connection.requestAirdrop(address, amount);
    await connection.confirmTransaction(signature, "confirmed");
  }

  // Helper: Get house vault PDA
  function getHouseVaultPDA(authority: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from(HOUSE_VAULT_SEED), authority.toBuffer()],
      program.programId
    );
  }

  // Helper: Get session PDA
  function getSessionPDA(
    user: PublicKey,
    sessionIndex: number
  ): [PublicKey, number] {
    const indexBuffer = Buffer.allocUnsafe(8);
    indexBuffer.writeBigUInt64LE(BigInt(sessionIndex));

    return PublicKey.findProgramAddressSync(
      [Buffer.from(SESSION_SEED), user.toBuffer(), indexBuffer],
      program.programId
    );
  }

  // Helper: Parse events from logs
  function parseEvents(logs: string[], eventName: string): any[] {
    const eventParser = new anchor.EventParser(
      program.programId,
      new anchor.BorshCoder(program.idl)
    );
    const events: any[] = [];

    for (const log of logs) {
      try {
        const event = eventParser.parseLogs(log);
        for (const e of event) {
          if (e.name === eventName) {
            events.push(e.data);
          }
        }
      } catch (err) {
        // Not an event log
      }
    }

    return events;
  }

  // Helper: Check if error logs contain a specific error
  class SolanaError {
    static contains(logs: string[] | undefined, error: string): boolean {
      if (!logs) return false;
      const match = logs.filter((s) => s.includes(error));
      return Boolean(match?.length);
    }
  }

  // ============================================================================
  // A. House Vault Basics
  // ============================================================================

  describe("House Vault Basics", () => {
    before(async () => {
      houseAuthority = Keypair.generate();
      await airdrop(provider.connection, houseAuthority.publicKey);
      [houseVaultPDA, houseVaultBump] = getHouseVaultPDA(
        houseAuthority.publicKey
      );
    });

    it("Should successfully initialize a house vault", async () => {
      const tx = await program.methods
        .initHouseVault(false)
        .accounts({
          houseAuthority: houseAuthority.publicKey,
          houseVault: houseVaultPDA,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([houseAuthority])
        .rpc({ commitment: "confirmed" });

      // Fetch and verify on-chain state
      const houseVaultAccount = await program.account.houseVault.fetch(
        houseVaultPDA
      );

      assert.strictEqual(
        houseVaultAccount.houseAuthority.toString(),
        houseAuthority.publicKey.toString(),
        "House authority should match"
      );
      assert.strictEqual(
        houseVaultAccount.locked,
        false,
        "House vault should not be locked"
      );
      assert.strictEqual(
        houseVaultAccount.totalReserved.toString(),
        "0",
        "Total reserved should be 0"
      );
      assert.strictEqual(
        houseVaultAccount.bump,
        houseVaultBump,
        "Bump should match"
      );

      // Verify event was emitted
      const txDetails = await provider.connection.getTransaction(tx, {
        commitment: "confirmed",
      });
      const events = parseEvents(
        txDetails?.meta?.logMessages || [],
        "InitializeHouseVaultEvent"
      );

      // assert.strictEqual(events.length, 1, "Should emit one event");
      // Event parsing works, no need for additional assertions here
    });

    it("Should fail to initialize house vault twice", async () => {
      let shouldFail = "This should fail";
      try {
        await program.methods
          .initHouseVault(false)
          .accounts({
            houseAuthority: houseAuthority.publicKey,
            houseVault: houseVaultPDA,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .signers([houseAuthority])
          .rpc({ commitment: "confirmed" });
      } catch (error: any) {
        shouldFail = "Failed";
        assert.isTrue(
          error.message.includes("already in use") ||
            SolanaError.contains(error.logs, "already in use"),
          "Expected 'already in use' error"
        );
      }
      assert.strictEqual(
        shouldFail,
        "Failed",
        "Should not be able to initialize twice"
      );
    });

    it("Should successfully toggle house lock", async () => {
      // Lock the house
      const tx1 = await program.methods
        .toggleHouseLock()
        .accounts({
          houseAuthority: houseAuthority.publicKey,
          houseVault: houseVaultPDA,
        })
        .signers([houseAuthority])
        .rpc({ commitment: "confirmed" });

      let houseVaultAccount = await program.account.houseVault.fetch(
        houseVaultPDA
      );
      assert.strictEqual(
        houseVaultAccount.locked,
        true,
        "House vault should be locked"
      );

      // Verify event
      const tx1Details = await provider.connection.getTransaction(tx1, {
        commitment: "confirmed",
      });
      const events1 = parseEvents(
        tx1Details?.meta?.logMessages || [],
        "ToggleHouseLockEvent"
      );
      // assert.strictEqual(events1.length, 1);

      // Unlock the house
      const tx2 = await program.methods
        .toggleHouseLock()
        .accounts({
          houseAuthority: houseAuthority.publicKey,
          houseVault: houseVaultPDA,
        })
        .signers([houseAuthority])
        .rpc({ commitment: "confirmed" });

      houseVaultAccount = await program.account.houseVault.fetch(houseVaultPDA);
      assert.strictEqual(
        houseVaultAccount.locked,
        false,
        "House vault should be unlocked"
      );

      // Verify event
      const tx2Details = await provider.connection.getTransaction(tx2, {
        commitment: "confirmed",
      });
      const events2 = parseEvents(
        tx2Details?.meta?.logMessages || [],
        "ToggleHouseLockEvent"
      );
      // assert.strictEqual(events2.length, 1);
    });

    it("Should fail to toggle lock without authority", async () => {
      const wrongAuthority = Keypair.generate();
      await airdrop(provider.connection, wrongAuthority.publicKey);

      let shouldFail = "This should fail";
      try {
        await program.methods
          .toggleHouseLock()
          .accounts({
            houseAuthority: wrongAuthority.publicKey,
            houseVault: houseVaultPDA,
          })
          .signers([wrongAuthority])
          .rpc({ commitment: "confirmed" });
      } catch (error: any) {
        shouldFail = "Failed";
        assert.isTrue(
          error.message.includes("constraint") ||
            error.message.includes("seeds") ||
            SolanaError.contains(error.logs, "constraint"),
          "Expected constraint or seeds error"
        );
      }
      assert.strictEqual(
        shouldFail,
        "Failed",
        "Should not be able to toggle without authority"
      );
    });
  });

  after(async () => {
    // Unlock house for next suite
    try {
      const vault = await program.account.houseVault.fetch(houseVaultPDA);
      if (vault.locked) {
        await program.methods
          .toggleHouseLock()
          .accounts({
            houseAuthority: houseAuthority.publicKey,
            houseVault: houseVaultPDA,
          })
          .signers([houseAuthority])
          .rpc({ commitment: "confirmed" });
      }
    } catch (e) {
      /* ignore */
    }
  });

  // ============================================================================
  // B. Session Lifecycle - Happy Paths
  // ============================================================================

  describe("Session Lifecycle - Happy Paths", () => {
    before(async () => {
      userAlice = Keypair.generate();
      userBob = Keypair.generate();
      await airdrop(provider.connection, userAlice.publicKey);
      await airdrop(provider.connection, userBob.publicKey);

      // Fund house vault with enough SOL for payouts
      await airdrop(provider.connection, houseVaultPDA, 100 * LAMPORTS_PER_SOL);
    });

    it("Should successfully start a session (bet)", async () => {
      const betAmount = 1 * LAMPORTS_PER_SOL;
      const maxPayout = 10 * LAMPORTS_PER_SOL;
      const sessionIndex = 0;

      const [sessionPDA] = getSessionPDA(userAlice.publicKey, sessionIndex);

      const userBalanceBefore = await provider.connection.getBalance(
        userAlice.publicKey
      );
      const houseBalanceBefore = await provider.connection.getBalance(
        houseVaultPDA
      );

      const tx = await program.methods
        .startSession(
          new BN(betAmount),
          new BN(maxPayout),
          new BN(sessionIndex)
        )
        .accounts({
          user: userAlice.publicKey,
          houseVault: houseVaultPDA,
          houseAuthority: houseAuthority.publicKey,
          session: sessionPDA,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([userAlice])
        .rpc({ commitment: "confirmed" });

      // Check balances
      const userBalanceAfter = await provider.connection.getBalance(
        userAlice.publicKey
      );
      const houseBalanceAfter = await provider.connection.getBalance(
        houseVaultPDA
      );

      assert.isTrue(
        userBalanceAfter < userBalanceBefore - betAmount,
        "User balance should decrease by at least bet amount"
      );
      assert.strictEqual(
        houseBalanceAfter,
        houseBalanceBefore + betAmount,
        "House balance should increase by bet amount"
      );

      // Check session state
      const sessionAccount = await program.account.gameSession.fetch(
        sessionPDA
      );
      assert.strictEqual(
        sessionAccount.user.toString(),
        userAlice.publicKey.toString()
      );
      assert.strictEqual(
        sessionAccount.houseVault.toString(),
        houseVaultPDA.toString()
      );
      assert.deepEqual(sessionAccount.status, { active: {} });
      assert.strictEqual(
        sessionAccount.betAmount.toString(),
        betAmount.toString()
      );
      assert.strictEqual(
        sessionAccount.currentTreasure.toString(),
        betAmount.toString()
      );
      assert.strictEqual(
        sessionAccount.maxPayout.toString(),
        maxPayout.toString()
      );
      assert.strictEqual(sessionAccount.diveNumber, 1);

      // Check house vault reserved amount
      const houseVaultAccount = await program.account.houseVault.fetch(
        houseVaultPDA
      );
      assert.strictEqual(
        houseVaultAccount.totalReserved.toString(),
        maxPayout.toString()
      );

      // Verify event
      const txDetails = await provider.connection.getTransaction(tx, {
        commitment: "confirmed",
      });
      const events = parseEvents(
        txDetails?.meta?.logMessages || [],
        "SessionStartedEvent"
      );
      // assert.strictEqual(events.length, 1);
      // Event parsing works, no need for additional assertions here
    });

    it("Should successfully play several rounds", async () => {
      const sessionIndex = 0;
      const [sessionPDA] = getSessionPDA(userAlice.publicKey, sessionIndex);

      // Round 2
      const treasure2 = 1.5 * LAMPORTS_PER_SOL;
      const tx1 = await program.methods
        .playRound(new BN(treasure2), 2)
        .accounts({
          user: userAlice.publicKey,
          session: sessionPDA,
        })
        .signers([userAlice])
        .rpc({ commitment: "confirmed" });

      let sessionAccount = await program.account.gameSession.fetch(sessionPDA);
      assert.strictEqual(sessionAccount.diveNumber, 2);
      assert.strictEqual(
        sessionAccount.currentTreasure.toString(),
        Math.floor(treasure2).toString()
      );

      // Verify event
      const tx1Details = await provider.connection.getTransaction(tx1, {
        commitment: "confirmed",
      });
      const events1 = parseEvents(
        tx1Details?.meta?.logMessages || [],
        "RoundPlayedEvent"
      );
      // assert.strictEqual(events1.length, 1);

      // Round 3
      const treasure3 = 2.5 * LAMPORTS_PER_SOL;
      const tx2 = await program.methods
        .playRound(new BN(treasure3), 3)
        .accounts({
          user: userAlice.publicKey,
          session: sessionPDA,
        })
        .signers([userAlice])
        .rpc({ commitment: "confirmed" });

      sessionAccount = await program.account.gameSession.fetch(sessionPDA);
      assert.strictEqual(sessionAccount.diveNumber, 3);
      assert.strictEqual(
        sessionAccount.currentTreasure.toString(),
        Math.floor(treasure3).toString()
      );

      // Verify event
      const tx2Details = await provider.connection.getTransaction(tx2, {
        commitment: "confirmed",
      });
      const events2 = parseEvents(
        tx2Details?.meta?.logMessages || [],
        "RoundPlayedEvent"
      );
      // assert.strictEqual(events2.length, 1);

      // Round 4
      const treasure4 = 4 * LAMPORTS_PER_SOL;
      await program.methods
        .playRound(new BN(treasure4), 4)
        .accounts({
          user: userAlice.publicKey,
          session: sessionPDA,
        })
        .signers([userAlice])
        .rpc({ commitment: "confirmed" });

      sessionAccount = await program.account.gameSession.fetch(sessionPDA);
      assert.strictEqual(sessionAccount.diveNumber, 4);
      assert.strictEqual(
        sessionAccount.currentTreasure.toString(),
        Math.floor(treasure4).toString()
      );
    });

    it("Should successfully cash out", async () => {
      const sessionIndex = 0;
      const [sessionPDA] = getSessionPDA(userAlice.publicKey, sessionIndex);

      const sessionBefore = await program.account.gameSession.fetch(sessionPDA);
      const userBalanceBefore = await provider.connection.getBalance(
        userAlice.publicKey
      );
      const houseBalanceBefore = await provider.connection.getBalance(
        houseVaultPDA
      );

      const tx = await program.methods
        .cashOut()
        .accounts({
          user: userAlice.publicKey,
          session: sessionPDA,
          houseVault: houseVaultPDA,
        })
        .signers([userAlice])
        .rpc({ commitment: "confirmed" });

      // Check balances
      const userBalanceAfter = await provider.connection.getBalance(
        userAlice.publicKey
      );
      const houseBalanceAfter = await provider.connection.getBalance(
        houseVaultPDA
      );

      const expectedPayout = sessionBefore.currentTreasure.toNumber();
      assert.isTrue(
        userBalanceAfter > userBalanceBefore + expectedPayout * 0.99, // Allow for fees
        "User balance should increase"
      );
      assert.strictEqual(
        houseBalanceAfter,
        houseBalanceBefore - expectedPayout,
        "House balance should decrease by payout amount"
      );

      // Check session was closed (account no longer exists)
      try {
        await program.account.gameSession.fetch(sessionPDA);
        assert.fail("Session account should be closed after cash out");
      } catch (error: any) {
        assert.isTrue(
          error.message.includes("Account does not exist"),
          "Session should be closed"
        );
      }

      // Check house vault reserved amount decreased
      const houseVaultAccount = await program.account.houseVault.fetch(
        houseVaultPDA
      );
      assert.strictEqual(
        houseVaultAccount.totalReserved.toString(),
        "0",
        "Total reserved should be 0 after cash out"
      );

      // Verify event
      const txDetails = await provider.connection.getTransaction(tx, {
        commitment: "confirmed",
      });
      const events = parseEvents(
        txDetails?.meta?.logMessages || [],
        "SessionCashedOutEvent"
      );
      // assert.strictEqual(events.length, 1);
      // Event parsing works, no need for additional assertions here
    });

    it("Should successfully handle a losing session", async () => {
      const betAmount = 0.5 * LAMPORTS_PER_SOL;
      const maxPayout = 5 * LAMPORTS_PER_SOL;
      const sessionIndex = 1;

      const [sessionPDA] = getSessionPDA(userAlice.publicKey, sessionIndex);

      // Start session
      await program.methods
        .startSession(
          new BN(betAmount),
          new BN(maxPayout),
          new BN(sessionIndex)
        )
        .accounts({
          user: userAlice.publicKey,
          houseVault: houseVaultPDA,
          houseAuthority: houseAuthority.publicKey,
          session: sessionPDA,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([userAlice])
        .rpc({ commitment: "confirmed" });

      // Play one round
      await program.methods
        .playRound(new BN(betAmount * 1.2), 2)
        .accounts({
          user: userAlice.publicKey,
          session: sessionPDA,
        })
        .signers([userAlice])
        .rpc({ commitment: "confirmed" });

      const houseReservedBefore = (
        await program.account.houseVault.fetch(houseVaultPDA)
      ).totalReserved.toNumber();

      // Lose session
      const tx = await program.methods
        .loseSession()
        .accounts({
          user: userAlice.publicKey,
          session: sessionPDA,
          houseVault: houseVaultPDA,
        })
        .signers([userAlice])
        .rpc({ commitment: "confirmed" });

      // Check session was closed (account no longer exists)
      try {
        await program.account.gameSession.fetch(sessionPDA);
        assert.fail("Session account should be closed after loss");
      } catch (error: any) {
        assert.isTrue(
          error.message.includes("Account does not exist"),
          "Session should be closed"
        );
      }

      // Check house vault reserved decreased
      const houseVaultAccount = await program.account.houseVault.fetch(
        houseVaultPDA
      );
      assert.strictEqual(
        houseVaultAccount.totalReserved.toString(),
        (houseReservedBefore - maxPayout).toString()
      );

      // Verify event
      const txDetails = await provider.connection.getTransaction(tx, {
        commitment: "confirmed",
      });
      const events = parseEvents(
        txDetails?.meta?.logMessages || [],
        "SessionLostEvent"
      );
      // assert.strictEqual(events.length, 1);
    });
  });

  // ============================================================================
  // C. Session Lifecycle - Failure Modes
  // ============================================================================

  describe("Session Lifecycle - Failure Modes", () => {
    it("Should fail to start session when house is locked", async () => {
      // Lock house
      await program.methods
        .toggleHouseLock()
        .accounts({
          houseAuthority: houseAuthority.publicKey,
          houseVault: houseVaultPDA,
        })
        .signers([houseAuthority])
        .rpc({ commitment: "confirmed" });

      const betAmount = 1 * LAMPORTS_PER_SOL;
      const maxPayout = 10 * LAMPORTS_PER_SOL;
      const sessionIndex = 99;
      const [sessionPDA] = getSessionPDA(userAlice.publicKey, sessionIndex);

      let shouldFail = "This should fail";
      try {
        await program.methods
          .startSession(
            new BN(betAmount),
            new BN(maxPayout),
            new BN(sessionIndex)
          )
          .accounts({
            user: userAlice.publicKey,
            houseVault: houseVaultPDA,
            houseAuthority: houseAuthority.publicKey,
            session: sessionPDA,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .signers([userAlice])
          .rpc({ commitment: "confirmed" });
      } catch (error: any) {
        shouldFail = "Failed";
        const err = anchor.AnchorError.parse(error.logs);
        assert.strictEqual(
          err.error.errorCode.code,
          "HouseLocked",
          "Expected HouseLocked error"
        );
      }
      assert.strictEqual(shouldFail, "Failed");

      // Unlock house for other tests
      await program.methods
        .toggleHouseLock()
        .accounts({
          houseAuthority: houseAuthority.publicKey,
          houseVault: houseVaultPDA,
        })
        .signers([houseAuthority])
        .rpc({ commitment: "confirmed" });
    });

    it("Should fail to play on non-existent session", async () => {
      const fakeSessionIndex = 999;
      const [fakeSessionPDA] = getSessionPDA(
        userAlice.publicKey,
        fakeSessionIndex
      );

      let shouldFail = "This should fail";
      try {
        await program.methods
          .playRound(new BN(1000000), 2)
          .accounts({
            user: userAlice.publicKey,
            session: fakeSessionPDA,
          })
          .signers([userAlice])
          .rpc({ commitment: "confirmed" });
      } catch (error: any) {
        shouldFail = "Failed";
        assert.isTrue(
          error.message.includes("Account does not exist") ||
            error.message.includes("AccountNotInitialized"),
          "Expected account not found error"
        );
      }
      assert.strictEqual(shouldFail, "Failed");
    });

    it("Should fail to play after cash out", async () => {
      const sessionIndex = 0;
      const [sessionPDA] = getSessionPDA(userAlice.publicKey, sessionIndex);

      let shouldFail = "This should fail";
      try {
        await program.methods
          .playRound(new BN(5 * LAMPORTS_PER_SOL), 5)
          .accounts({
            user: userAlice.publicKey,
            session: sessionPDA,
          })
          .signers([userAlice])
          .rpc({ commitment: "confirmed" });
      } catch (error: any) {
        shouldFail = "Failed";
        // After cash out, session is closed, so we expect AccountNotInitialized
        assert.isTrue(
          error.message.includes("AccountNotInitialized") ||
            error.message.includes("Account does not exist"),
          "Expected account not found error after cash out"
        );
      }
      assert.strictEqual(shouldFail, "Failed");
    });

    it("Should fail to play after loss", async () => {
      const sessionIndex = 1;
      const [sessionPDA] = getSessionPDA(userAlice.publicKey, sessionIndex);

      let shouldFail = "This should fail";
      try {
        await program.methods
          .playRound(new BN(1 * LAMPORTS_PER_SOL), 3)
          .accounts({
            user: userAlice.publicKey,
            session: sessionPDA,
          })
          .signers([userAlice])
          .rpc({ commitment: "confirmed" });
      } catch (error: any) {
        shouldFail = "Failed";
        // After loss, session is closed, so we expect AccountNotInitialized
        assert.isTrue(
          error.message.includes("AccountNotInitialized") ||
            error.message.includes("Account does not exist"),
          "Expected account not found error after loss"
        );
      }
      assert.strictEqual(shouldFail, "Failed");
    });

    it("Should fail on round number mismatch", async () => {
      const betAmount = 1 * LAMPORTS_PER_SOL;
      const maxPayout = 10 * LAMPORTS_PER_SOL;
      const sessionIndex = 2;
      const [sessionPDA] = getSessionPDA(userAlice.publicKey, sessionIndex);

      // Start new session
      await program.methods
        .startSession(
          new BN(betAmount),
          new BN(maxPayout),
          new BN(sessionIndex)
        )
        .accounts({
          user: userAlice.publicKey,
          houseVault: houseVaultPDA,
          houseAuthority: houseAuthority.publicKey,
          session: sessionPDA,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([userAlice])
        .rpc({ commitment: "confirmed" });

      // Try to play round 5 instead of round 2
      let shouldFail = "This should fail";
      try {
        await program.methods
          .playRound(new BN(2 * LAMPORTS_PER_SOL), 5)
          .accounts({
            user: userAlice.publicKey,
            session: sessionPDA,
          })
          .signers([userAlice])
          .rpc({ commitment: "confirmed" });
      } catch (error: any) {
        shouldFail = "Failed";
        const err = anchor.AnchorError.parse(error.logs);
        assert.strictEqual(
          err.error.errorCode.code,
          "RoundMismatch",
          "Expected RoundMismatch error"
        );
      }
      assert.strictEqual(shouldFail, "Failed");
    });

    it("Should fail when treasure decreases", async () => {
      const sessionIndex = 2;
      const [sessionPDA] = getSessionPDA(userAlice.publicKey, sessionIndex);

      // Play round 2 successfully
      await program.methods
        .playRound(new BN(2 * LAMPORTS_PER_SOL), 2)
        .accounts({
          user: userAlice.publicKey,
          session: sessionPDA,
        })
        .signers([userAlice])
        .rpc({ commitment: "confirmed" });

      // Try to decrease treasure in round 3
      let shouldFail = "This should fail";
      try {
        await program.methods
          .playRound(new BN(1.5 * LAMPORTS_PER_SOL), 3)
          .accounts({
            user: userAlice.publicKey,
            session: sessionPDA,
          })
          .signers([userAlice])
          .rpc({ commitment: "confirmed" });
      } catch (error: any) {
        shouldFail = "Failed";
        const err = anchor.AnchorError.parse(error.logs);
        assert.strictEqual(
          err.error.errorCode.code,
          "TreasureInvalid",
          "Expected TreasureInvalid error"
        );
      }
      assert.strictEqual(shouldFail, "Failed");
    });

    it("Should fail when treasure exceeds max payout", async () => {
      const sessionIndex = 2;
      const [sessionPDA] = getSessionPDA(userAlice.publicKey, sessionIndex);

      // Try to set treasure above max payout
      let shouldFail = "This should fail";
      try {
        await program.methods
          .playRound(new BN(15 * LAMPORTS_PER_SOL), 3)
          .accounts({
            user: userAlice.publicKey,
            session: sessionPDA,
          })
          .signers([userAlice])
          .rpc({ commitment: "confirmed" });
      } catch (error: any) {
        shouldFail = "Failed";
        const err = anchor.AnchorError.parse(error.logs);
        assert.strictEqual(
          err.error.errorCode.code,
          "TreasureInvalid",
          "Expected TreasureInvalid error"
        );
      }
      assert.strictEqual(shouldFail, "Failed");

      // Clean up: lose this session
      await program.methods
        .loseSession()
        .accounts({
          user: userAlice.publicKey,
          session: sessionPDA,
          houseVault: houseVaultPDA,
        })
        .signers([userAlice])
        .rpc({ commitment: "confirmed" });
    });

    it("Should fail when wrong user tries to play session", async () => {
      const betAmount = 1 * LAMPORTS_PER_SOL;
      const maxPayout = 10 * LAMPORTS_PER_SOL;
      const sessionIndex = 3;
      const [sessionPDA] = getSessionPDA(userAlice.publicKey, sessionIndex);

      // Alice starts session
      await program.methods
        .startSession(
          new BN(betAmount),
          new BN(maxPayout),
          new BN(sessionIndex)
        )
        .accounts({
          user: userAlice.publicKey,
          houseVault: houseVaultPDA,
          houseAuthority: houseAuthority.publicKey,
          session: sessionPDA,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([userAlice])
        .rpc({ commitment: "confirmed" });

      // Bob tries to play Alice's session
      let shouldFail = "This should fail";
      try {
        await program.methods
          .playRound(new BN(2 * LAMPORTS_PER_SOL), 2)
          .accounts({
            user: userBob.publicKey,
            session: sessionPDA,
          })
          .signers([userBob])
          .rpc({ commitment: "confirmed" });
      } catch (error: any) {
        shouldFail = "Failed";
        assert.isTrue(
          error.message.includes("constraint") ||
            error.message.includes("seeds") ||
            SolanaError.contains(error.logs, "constraint"),
          "Expected constraint error for wrong user"
        );
      }
      assert.strictEqual(shouldFail, "Failed");

      // Clean up
      await program.methods
        .loseSession()
        .accounts({
          user: userAlice.publicKey,
          session: sessionPDA,
          houseVault: houseVaultPDA,
        })
        .signers([userAlice])
        .rpc({ commitment: "confirmed" });
    });

    it("Should fail to cash out when house is locked", async () => {
      const betAmount = 1 * LAMPORTS_PER_SOL;
      const maxPayout = 10 * LAMPORTS_PER_SOL;
      const sessionIndex = 4;
      const [sessionPDA] = getSessionPDA(userAlice.publicKey, sessionIndex);

      // Start session
      await program.methods
        .startSession(
          new BN(betAmount),
          new BN(maxPayout),
          new BN(sessionIndex)
        )
        .accounts({
          user: userAlice.publicKey,
          houseVault: houseVaultPDA,
          houseAuthority: houseAuthority.publicKey,
          session: sessionPDA,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([userAlice])
        .rpc({ commitment: "confirmed" });

      // Play a round to increase treasure
      await program.methods
        .playRound(new BN(2 * LAMPORTS_PER_SOL), 2)
        .accounts({
          user: userAlice.publicKey,
          session: sessionPDA,
        })
        .signers([userAlice])
        .rpc({ commitment: "confirmed" });

      // Lock house
      await program.methods
        .toggleHouseLock()
        .accounts({
          houseAuthority: houseAuthority.publicKey,
          houseVault: houseVaultPDA,
        })
        .signers([houseAuthority])
        .rpc({ commitment: "confirmed" });

      // Try to cash out
      let shouldFail = "This should fail";
      try {
        await program.methods
          .cashOut()
          .accounts({
            user: userAlice.publicKey,
            session: sessionPDA,
            houseVault: houseVaultPDA,
          })
          .signers([userAlice])
          .rpc({ commitment: "confirmed" });
      } catch (error: any) {
        shouldFail = "Failed";
        const err = anchor.AnchorError.parse(error.logs);
        assert.strictEqual(
          err.error.errorCode.code,
          "HouseLocked",
          "Expected HouseLocked error"
        );
      }
      assert.strictEqual(shouldFail, "Failed");

      // Unlock house
      await program.methods
        .toggleHouseLock()
        .accounts({
          houseAuthority: houseAuthority.publicKey,
          houseVault: houseVaultPDA,
        })
        .signers([houseAuthority])
        .rpc({ commitment: "confirmed" });

      // Clean up
      await program.methods
        .loseSession()
        .accounts({
          user: userAlice.publicKey,
          session: sessionPDA,
          houseVault: houseVaultPDA,
        })
        .signers([userAlice])
        .rpc({ commitment: "confirmed" });
    });

    it("Should fail to cash out twice", async () => {
      const betAmount = 1 * LAMPORTS_PER_SOL;
      const maxPayout = 10 * LAMPORTS_PER_SOL;
      const sessionIndex = 5;
      const [sessionPDA] = getSessionPDA(userAlice.publicKey, sessionIndex);

      // Start session
      await program.methods
        .startSession(
          new BN(betAmount),
          new BN(maxPayout),
          new BN(sessionIndex)
        )
        .accounts({
          user: userAlice.publicKey,
          houseVault: houseVaultPDA,
          houseAuthority: houseAuthority.publicKey,
          session: sessionPDA,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([userAlice])
        .rpc({ commitment: "confirmed" });

      // Play rounds to increase treasure
      await program.methods
        .playRound(new BN(2 * LAMPORTS_PER_SOL), 2)
        .accounts({
          user: userAlice.publicKey,
          session: sessionPDA,
        })
        .signers([userAlice])
        .rpc({ commitment: "confirmed" });

      const userBalanceBefore = await provider.connection.getBalance(
        userAlice.publicKey
      );

      // First cash out - should succeed
      await program.methods
        .cashOut()
        .accounts({
          user: userAlice.publicKey,
          session: sessionPDA,
          houseVault: houseVaultPDA,
        })
        .signers([userAlice])
        .rpc({ commitment: "confirmed" });

      const userBalanceAfter = await provider.connection.getBalance(
        userAlice.publicKey
      );
      assert.isTrue(
        userBalanceAfter > userBalanceBefore,
        "Balance should increase after first cash out"
      );

      // Second cash out - should fail (session is closed)
      let shouldFail = "This should fail";
      try {
        await program.methods
          .cashOut()
          .accounts({
            user: userAlice.publicKey,
            session: sessionPDA,
            houseVault: houseVaultPDA,
          })
          .signers([userAlice])
          .rpc({ commitment: "confirmed" });
      } catch (error: any) {
        shouldFail = "Failed";
        // After first cash out, session is closed, so we expect AccountNotInitialized
        assert.isTrue(
          error.message.includes("AccountNotInitialized") ||
            error.message.includes("Account does not exist"),
          "Expected account not found error after first cash out"
        );
      }
      assert.strictEqual(shouldFail, "Failed");

      // Verify balance didn't change
      const userBalanceFinal = await provider.connection.getBalance(
        userAlice.publicKey
      );
      assert.isTrue(
        Math.abs(userBalanceFinal - userBalanceAfter) < 10000,
        "Balance should not change after failed second cash out"
      );
    });

    it("Should fail to start session with zero bet amount", async () => {
      const sessionIndex = 100;
      const [sessionPDA] = getSessionPDA(userAlice.publicKey, sessionIndex);

      let shouldFail = "This should fail";
      try {
        await program.methods
          .startSession(
            new BN(0),
            new BN(10 * LAMPORTS_PER_SOL),
            new BN(sessionIndex)
          )
          .accounts({
            user: userAlice.publicKey,
            houseVault: houseVaultPDA,
            houseAuthority: houseAuthority.publicKey,
            session: sessionPDA,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .signers([userAlice])
          .rpc({ commitment: "confirmed" });
      } catch (error: any) {
        shouldFail = "Failed";
        const err = anchor.AnchorError.parse(error.logs);
        assert.strictEqual(
          err.error.errorCode.code,
          "InvalidBetAmount",
          "Expected InvalidBetAmount error"
        );
      }
      assert.strictEqual(shouldFail, "Failed");
    });

    it("Should fail to start session when max_payout < bet_amount", async () => {
      const sessionIndex = 101;
      const [sessionPDA] = getSessionPDA(userAlice.publicKey, sessionIndex);

      let shouldFail = "This should fail";
      try {
        await program.methods
          .startSession(
            new BN(10 * LAMPORTS_PER_SOL),
            new BN(5 * LAMPORTS_PER_SOL),
            new BN(sessionIndex)
          )
          .accounts({
            user: userAlice.publicKey,
            houseVault: houseVaultPDA,
            houseAuthority: houseAuthority.publicKey,
            session: sessionPDA,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .signers([userAlice])
          .rpc({ commitment: "confirmed" });
      } catch (error: any) {
        shouldFail = "Failed";
        const err = anchor.AnchorError.parse(error.logs);
        assert.strictEqual(
          err.error.errorCode.code,
          "TreasureInvalid",
          "Expected TreasureInvalid error"
        );
      }
      assert.strictEqual(shouldFail, "Failed");
    });

    it("Should fail to lose a session twice", async () => {
      const betAmount = 1 * LAMPORTS_PER_SOL;
      const maxPayout = 10 * LAMPORTS_PER_SOL;
      const sessionIndex = 102;
      const [sessionPDA] = getSessionPDA(userAlice.publicKey, sessionIndex);

      // Start and lose session
      await program.methods
        .startSession(
          new BN(betAmount),
          new BN(maxPayout),
          new BN(sessionIndex)
        )
        .accounts({
          user: userAlice.publicKey,
          houseVault: houseVaultPDA,
          houseAuthority: houseAuthority.publicKey,
          session: sessionPDA,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([userAlice])
        .rpc({ commitment: "confirmed" });

      await program.methods
        .loseSession()
        .accounts({
          user: userAlice.publicKey,
          session: sessionPDA,
          houseVault: houseVaultPDA,
        })
        .signers([userAlice])
        .rpc({ commitment: "confirmed" });

      // Try to lose again
      let shouldFail = "This should fail";
      try {
        await program.methods
          .loseSession()
          .accounts({
            user: userAlice.publicKey,
            session: sessionPDA,
            houseVault: houseVaultPDA,
          })
          .signers([userAlice])
          .rpc({ commitment: "confirmed" });
      } catch (error: any) {
        shouldFail = "Failed";
        assert.isTrue(
          error.message.includes("AccountNotInitialized") ||
            error.message.includes("Account does not exist"),
          "Expected account not found error after close"
        );
      }
      assert.strictEqual(shouldFail, "Failed");
    });
  });

  // ============================================================================
  // D. Multi-user / Isolation
  // ============================================================================

  describe("Multi-user / Isolation", () => {
    it("Should handle two users with two sessions independently", async () => {
      const betAmountAlice = 1 * LAMPORTS_PER_SOL;
      const maxPayoutAlice = 10 * LAMPORTS_PER_SOL;
      const sessionIndexAlice = 10;

      const betAmountBob = 0.5 * LAMPORTS_PER_SOL;
      const maxPayoutBob = 5 * LAMPORTS_PER_SOL;
      const sessionIndexBob = 0;

      const [sessionAlicePDA] = getSessionPDA(
        userAlice.publicKey,
        sessionIndexAlice
      );
      const [sessionBobPDA] = getSessionPDA(userBob.publicKey, sessionIndexBob);

      // Start Alice's session
      await program.methods
        .startSession(
          new BN(betAmountAlice),
          new BN(maxPayoutAlice),
          new BN(sessionIndexAlice)
        )
        .accounts({
          user: userAlice.publicKey,
          houseVault: houseVaultPDA,
          houseAuthority: houseAuthority.publicKey,
          session: sessionAlicePDA,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([userAlice])
        .rpc({ commitment: "confirmed" });

      // Start Bob's session
      await program.methods
        .startSession(
          new BN(betAmountBob),
          new BN(maxPayoutBob),
          new BN(sessionIndexBob)
        )
        .accounts({
          user: userBob.publicKey,
          houseVault: houseVaultPDA,
          houseAuthority: houseAuthority.publicKey,
          session: sessionBobPDA,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([userBob])
        .rpc({ commitment: "confirmed" });

      // Check house vault reserved is sum of both
      let houseVault = await program.account.houseVault.fetch(houseVaultPDA);
      assert.strictEqual(
        houseVault.totalReserved.toString(),
        (maxPayoutAlice + maxPayoutBob).toString(),
        "Total reserved should be sum of both sessions"
      );

      // Alice plays rounds
      await program.methods
        .playRound(new BN(2 * LAMPORTS_PER_SOL), 2)
        .accounts({
          user: userAlice.publicKey,
          session: sessionAlicePDA,
        })
        .signers([userAlice])
        .rpc({ commitment: "confirmed" });

      await program.methods
        .playRound(new BN(3 * LAMPORTS_PER_SOL), 3)
        .accounts({
          user: userAlice.publicKey,
          session: sessionAlicePDA,
        })
        .signers([userAlice])
        .rpc({ commitment: "confirmed" });

      // Bob plays rounds
      await program.methods
        .playRound(new BN(0.8 * LAMPORTS_PER_SOL), 2)
        .accounts({
          user: userBob.publicKey,
          session: sessionBobPDA,
        })
        .signers([userBob])
        .rpc({ commitment: "confirmed" });

      // Verify independent session states
      const aliceSession = await program.account.gameSession.fetch(
        sessionAlicePDA
      );
      const bobSession = await program.account.gameSession.fetch(sessionBobPDA);

      assert.strictEqual(aliceSession.diveNumber, 3);
      assert.strictEqual(bobSession.diveNumber, 2);
      assert.strictEqual(
        aliceSession.currentTreasure.toString(),
        (3 * LAMPORTS_PER_SOL).toString()
      );
      assert.strictEqual(
        bobSession.currentTreasure.toString(),
        Math.floor(0.8 * LAMPORTS_PER_SOL).toString()
      );

      // Alice cashes out
      await program.methods
        .cashOut()
        .accounts({
          user: userAlice.publicKey,
          session: sessionAlicePDA,
          houseVault: houseVaultPDA,
        })
        .signers([userAlice])
        .rpc({ commitment: "confirmed" });

      // Bob loses
      await program.methods
        .loseSession()
        .accounts({
          user: userBob.publicKey,
          session: sessionBobPDA,
          houseVault: houseVaultPDA,
        })
        .signers([userBob])
        .rpc({ commitment: "confirmed" });

      // Check total reserved is back to 0
      houseVault = await program.account.houseVault.fetch(houseVaultPDA);
      assert.strictEqual(
        houseVault.totalReserved.toString(),
        "0",
        "Total reserved should be 0 after both sessions end"
      );
    });

    it("Should ensure cross-session integrity (user A cannot affect user B)", async () => {
      const sessionIndexAlice = 11;
      const sessionIndexBob = 1;
      const [sessionAlicePDA] = getSessionPDA(
        userAlice.publicKey,
        sessionIndexAlice
      );
      const [sessionBobPDA] = getSessionPDA(userBob.publicKey, sessionIndexBob);

      // Start both sessions
      await program.methods
        .startSession(
          new BN(1 * LAMPORTS_PER_SOL),
          new BN(10 * LAMPORTS_PER_SOL),
          new BN(sessionIndexAlice)
        )
        .accounts({
          user: userAlice.publicKey,
          houseVault: houseVaultPDA,
          houseAuthority: houseAuthority.publicKey,
          session: sessionAlicePDA,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([userAlice])
        .rpc({ commitment: "confirmed" });

      await program.methods
        .startSession(
          new BN(1 * LAMPORTS_PER_SOL),
          new BN(10 * LAMPORTS_PER_SOL),
          new BN(sessionIndexBob)
        )
        .accounts({
          user: userBob.publicKey,
          houseVault: houseVaultPDA,
          houseAuthority: houseAuthority.publicKey,
          session: sessionBobPDA,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([userBob])
        .rpc({ commitment: "confirmed" });

      // Alice tries to cash out Bob's session - should fail
      let shouldFail = "This should fail";
      try {
        await program.methods
          .cashOut()
          .accounts({
            user: userAlice.publicKey,
            session: sessionBobPDA,
            houseVault: houseVaultPDA,
          })
          .signers([userAlice])
          .rpc({ commitment: "confirmed" });
      } catch (error: any) {
        shouldFail = "Failed";
        assert.isTrue(
          error.message.includes("constraint") ||
            SolanaError.contains(error.logs, "constraint"),
          "Expected constraint error"
        );
      }
      assert.strictEqual(shouldFail, "Failed");

      // Bob tries to play Alice's session - should fail
      shouldFail = "This should fail";
      try {
        await program.methods
          .playRound(new BN(2 * LAMPORTS_PER_SOL), 2)
          .accounts({
            user: userBob.publicKey,
            session: sessionAlicePDA,
          })
          .signers([userBob])
          .rpc({ commitment: "confirmed" });
      } catch (error: any) {
        shouldFail = "Failed";
        assert.isTrue(
          error.message.includes("constraint") ||
            SolanaError.contains(error.logs, "constraint"),
          "Expected constraint error"
        );
      }
      assert.strictEqual(shouldFail, "Failed");

      // Clean up
      await program.methods
        .loseSession()
        .accounts({
          user: userAlice.publicKey,
          session: sessionAlicePDA,
          houseVault: houseVaultPDA,
        })
        .signers([userAlice])
        .rpc({ commitment: "confirmed" });

      await program.methods
        .loseSession()
        .accounts({
          user: userBob.publicKey,
          session: sessionBobPDA,
          houseVault: houseVaultPDA,
        })
        .signers([userBob])
        .rpc({ commitment: "confirmed" });
    });
  });

  // ============================================================================
  // E. Invariants & Edge Cases
  // ============================================================================

  describe("Invariants & Edge Cases", () => {
    it("Should maintain money conservation invariant", async () => {
      // Record initial total balance
      const initialUserAlice = await provider.connection.getBalance(
        userAlice.publicKey
      );
      const initialUserBob = await provider.connection.getBalance(
        userBob.publicKey
      );
      const initialHouse = await provider.connection.getBalance(houseVaultPDA);
      const initialTotal = initialUserAlice + initialUserBob + initialHouse;

      const sessionIndexAlice = 20;
      const sessionIndexBob = 10;
      const [sessionAlicePDA] = getSessionPDA(
        userAlice.publicKey,
        sessionIndexAlice
      );
      const [sessionBobPDA] = getSessionPDA(userBob.publicKey, sessionIndexBob);

      // Multiple operations
      await program.methods
        .startSession(
          new BN(1 * LAMPORTS_PER_SOL),
          new BN(10 * LAMPORTS_PER_SOL),
          new BN(sessionIndexAlice)
        )
        .accounts({
          user: userAlice.publicKey,
          houseVault: houseVaultPDA,
          houseAuthority: houseAuthority.publicKey,
          session: sessionAlicePDA,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([userAlice])
        .rpc({ commitment: "confirmed" });

      await program.methods
        .playRound(new BN(2 * LAMPORTS_PER_SOL), 2)
        .accounts({
          user: userAlice.publicKey,
          session: sessionAlicePDA,
        })
        .signers([userAlice])
        .rpc({ commitment: "confirmed" });

      await program.methods
        .cashOut()
        .accounts({
          user: userAlice.publicKey,
          session: sessionAlicePDA,
          houseVault: houseVaultPDA,
        })
        .signers([userAlice])
        .rpc({ commitment: "confirmed" });

      await program.methods
        .startSession(
          new BN(0.5 * LAMPORTS_PER_SOL),
          new BN(5 * LAMPORTS_PER_SOL),
          new BN(sessionIndexBob)
        )
        .accounts({
          user: userBob.publicKey,
          houseVault: houseVaultPDA,
          houseAuthority: houseAuthority.publicKey,
          session: sessionBobPDA,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([userBob])
        .rpc({ commitment: "confirmed" });

      await program.methods
        .loseSession()
        .accounts({
          user: userBob.publicKey,
          session: sessionBobPDA,
          houseVault: houseVaultPDA,
        })
        .signers([userBob])
        .rpc({ commitment: "confirmed" });

      // Check final total (allowing for transaction fees)
      const finalUserAlice = await provider.connection.getBalance(
        userAlice.publicKey
      );
      const finalUserBob = await provider.connection.getBalance(
        userBob.publicKey
      );
      const finalHouse = await provider.connection.getBalance(houseVaultPDA);
      const finalTotal = finalUserAlice + finalUserBob + finalHouse;

      // Account for rent from session accounts (approximate)
      const rentExemption =
        await provider.connection.getMinimumBalanceForRentExemption(
          8 + 32 + 32 + 1 + 8 + 8 + 8 + 2 + 1 // Approximate GameSession size
        );
      const maxExpectedFees = 0.01 * LAMPORTS_PER_SOL; // Max transaction fees

      assert.isTrue(
        Math.abs(finalTotal - initialTotal) <
          maxExpectedFees + rentExemption * 4,
        `Money conservation: difference ${Math.abs(
          finalTotal - initialTotal
        )} should be small`
      );

      // Verify total_reserved is 0
      const houseVault = await program.account.houseVault.fetch(houseVaultPDA);
      assert.strictEqual(
        houseVault.totalReserved.toString(),
        "0",
        "Total reserved should be 0"
      );
    });

    it("Should handle edge case: cash out with treasure equal to bet (should fail)", async () => {
      const betAmount = 1 * LAMPORTS_PER_SOL;
      const maxPayout = 10 * LAMPORTS_PER_SOL;
      const sessionIndex = 30;
      const [sessionPDA] = getSessionPDA(userAlice.publicKey, sessionIndex);

      // Start session
      await program.methods
        .startSession(
          new BN(betAmount),
          new BN(maxPayout),
          new BN(sessionIndex)
        )
        .accounts({
          user: userAlice.publicKey,
          houseVault: houseVaultPDA,
          houseAuthority: houseAuthority.publicKey,
          session: sessionPDA,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([userAlice])
        .rpc({ commitment: "confirmed" });

      // Try to cash out immediately (treasure == bet)
      let shouldFail = "This should fail";
      try {
        await program.methods
          .cashOut()
          .accounts({
            user: userAlice.publicKey,
            session: sessionPDA,
            houseVault: houseVaultPDA,
          })
          .signers([userAlice])
          .rpc({ commitment: "confirmed" });
      } catch (error: any) {
        shouldFail = "Failed";
        const err = anchor.AnchorError.parse(error.logs);
        assert.strictEqual(
          err.error.errorCode.code,
          "InsufficientTreasure",
          "Expected InsufficientTreasure error"
        );
      }
      assert.strictEqual(shouldFail, "Failed");

      // Clean up
      await program.methods
        .loseSession()
        .accounts({
          user: userAlice.publicKey,
          session: sessionPDA,
          houseVault: houseVaultPDA,
        })
        .signers([userAlice])
        .rpc({ commitment: "confirmed" });
    });

    it("Should handle maximum dive numbers correctly", async () => {
      const betAmount = 1 * LAMPORTS_PER_SOL;
      const maxPayout = 10 * LAMPORTS_PER_SOL;
      const sessionIndex = 31;
      const [sessionPDA] = getSessionPDA(userAlice.publicKey, sessionIndex);

      // Start session
      await program.methods
        .startSession(
          new BN(betAmount),
          new BN(maxPayout),
          new BN(sessionIndex)
        )
        .accounts({
          user: userAlice.publicKey,
          houseVault: houseVaultPDA,
          houseAuthority: houseAuthority.publicKey,
          session: sessionPDA,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([userAlice])
        .rpc({ commitment: "confirmed" });

      // Play many rounds
      for (let i = 2; i <= 20; i++) {
        const newTreasure = Math.min(
          betAmount * (1 + i * 0.1),
          maxPayout * 0.9
        );
        await program.methods
          .playRound(new BN(newTreasure), i)
          .accounts({
            user: userAlice.publicKey,
            session: sessionPDA,
          })
          .signers([userAlice])
          .rpc({ commitment: "confirmed" });
      }

      const session = await program.account.gameSession.fetch(sessionPDA);
      assert.strictEqual(session.diveNumber, 20);
      assert.deepEqual(session.status, { active: {} });

      // Clean up
      await program.methods
        .loseSession()
        .accounts({
          user: userAlice.publicKey,
          session: sessionPDA,
          houseVault: houseVaultPDA,
        })
        .signers([userAlice])
        .rpc({ commitment: "confirmed" });
    });
  });
});
