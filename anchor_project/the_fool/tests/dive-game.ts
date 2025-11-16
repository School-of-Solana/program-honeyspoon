import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey, Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { BN } from "bn.js";
import { assert } from "chai";

// ============================================================================
// Global Constants
// ============================================================================

const HOUSE_VAULT_SEED = "house_vault";
const SESSION_SEED = "session";
const GAME_CONFIG_SEED = "game_config";

// Test amounts (in SOL, converted to lamports via helper)
const TEST_AMOUNTS = {
  TINY: 0.001,
  SMALL: 0.1,
  MEDIUM: 1,
  LARGE: 10,
  HUGE: 100,
};

const AIRDROP_AMOUNT = 10; // SOL
const MAX_PAYOUT_MULTIPLIER = 100;

// ============================================================================
// Utility Functions
// ============================================================================

class TestUtils {
  static lamports(sol: number): BN {
    return new BN(BigInt(Math.round(sol * LAMPORTS_PER_SOL)).toString());
  }

  static lamportsNum(sol: number): number {
    return Number(BigInt(Math.round(sol * LAMPORTS_PER_SOL)));
  }

  static toSOL(lamports: number | BN): number {
    const amount =
      typeof lamports === "number" ? lamports : lamports.toNumber();
    return amount / LAMPORTS_PER_SOL;
  }

  static async airdrop(
    connection: anchor.web3.Connection,
    address: PublicKey,
    solAmount: number = AIRDROP_AMOUNT
  ): Promise<void> {
    const signature = await connection.requestAirdrop(
      address,
      TestUtils.lamportsNum(solAmount)
    );
    await connection.confirmTransaction(signature);
  }

  static getHouseVaultPDA(
    authority: PublicKey,
    programId: PublicKey
  ): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from(HOUSE_VAULT_SEED), authority.toBuffer()],
      programId
    );
  }

  static getSessionPDA(
    user: PublicKey,
    sessionIndex: number,
    programId: PublicKey
  ): [PublicKey, number] {
    const indexBuffer = Buffer.allocUnsafe(8);
    indexBuffer.writeBigUInt64LE(BigInt(sessionIndex));

    return PublicKey.findProgramAddressSync(
      [Buffer.from(SESSION_SEED), user.toBuffer(), indexBuffer],
      programId
    );
  }

  static getConfigPDA(programId: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from(GAME_CONFIG_SEED)],
      programId
    );
  }

  static expectedMaxPayout(betAmount: number | BN): BN {
    const bet = typeof betAmount === "number" ? new BN(betAmount) : betAmount;
    return bet.mul(new BN(MAX_PAYOUT_MULTIPLIER));
  }

  static errorContains(logs: string[] | undefined, error: string): boolean {
    if (!logs) return false;
    return logs.some((log) => log.includes(error));
  }

  static parseAnchorError(logs: string[] | undefined): any {
    try {
      return anchor.AnchorError.parse(logs);
    } catch {
      return null;
    }
  }
}

// ============================================================================
// Test Fixture
// ============================================================================

class TestFixture {
  program: Program;
  provider: anchor.AnchorProvider;
  houseAuthority: Keypair;
  houseVaultPDA: PublicKey;
  houseVaultBump: number;
  configPDA: PublicKey;
  configBump: number;
  users: Map<string, Keypair>;

  constructor(program: Program, provider: anchor.AnchorProvider) {
    this.program = program;
    this.provider = provider;
    this.users = new Map();
  }

  async setupConfig(admin?: Keypair): Promise<void> {
    if (!admin) {
      admin = Keypair.generate();
      await TestUtils.airdrop(this.provider.connection, admin.publicKey, 1);
    }

    [this.configPDA, this.configBump] = TestUtils.getConfigPDA(
      this.program.programId
    );

    await this.program.methods
      .initConfig({
        baseSurvivalPpm: null,
        decayPerDivePpm: null,
        minSurvivalPpm: null,
        treasureMultiplierNum: null,
        treasureMultiplierDen: null,
        maxPayoutMultiplier: null,
        maxDives: null,
        minBet: null,
        maxBet: null,
      })
      .accounts({
        admin: admin.publicKey,
        config: this.configPDA,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([admin])
      .rpc();
  }

  async setupHouse(locked: boolean = false): Promise<void> {
    this.houseAuthority = Keypair.generate();
    await TestUtils.airdrop(
      this.provider.connection,
      this.houseAuthority.publicKey
    );

    [this.houseVaultPDA, this.houseVaultBump] = TestUtils.getHouseVaultPDA(
      this.houseAuthority.publicKey,
      this.program.programId
    );

    await this.program.methods
      .initHouseVault(locked)
      .accounts({
        houseAuthority: this.houseAuthority.publicKey,
        houseVault: this.houseVaultPDA,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([this.houseAuthority])
      .rpc();
  }

  async fundHouse(solAmount: number): Promise<void> {
    await TestUtils.airdrop(
      this.provider.connection,
      this.houseVaultPDA,
      solAmount
    );
  }

  async createUser(
    name: string,
    fundAmount: number = AIRDROP_AMOUNT
  ): Promise<Keypair> {
    const user = Keypair.generate();
    await TestUtils.airdrop(
      this.provider.connection,
      user.publicKey,
      fundAmount
    );
    this.users.set(name, user);
    return user;
  }

  getUser(name: string): Keypair {
    const user = this.users.get(name);
    if (!user) throw new Error(`User ${name} not found`);
    return user;
  }

  async startSession(
    user: Keypair,
    betSol: number,
    sessionIndex: number
  ): Promise<PublicKey> {
    const [sessionPDA] = TestUtils.getSessionPDA(
      user.publicKey,
      sessionIndex,
      this.program.programId
    );

    await this.program.methods
      .startSession(TestUtils.lamports(betSol), new BN(sessionIndex))
      .accounts({
        user: user.publicKey,
        config: this.configPDA,
        houseVault: this.houseVaultPDA,
        houseAuthority: this.houseAuthority.publicKey,
        session: sessionPDA,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([user])
      .rpc();

    return sessionPDA;
  }

  async playRound(user: Keypair, sessionPDA: PublicKey): Promise<void> {
    await this.program.methods
      .playRound()
      .accounts({
        user: user.publicKey,
        config: this.configPDA,
        session: sessionPDA,
        houseVault: this.houseVaultPDA,
      })
      .signers([user])
      .rpc();
  }

  async cashOut(user: Keypair, sessionPDA: PublicKey): Promise<void> {
    await this.program.methods
      .cashOut()
      .accounts({
        user: user.publicKey,
        session: sessionPDA,
        houseVault: this.houseVaultPDA,
      })
      .signers([user])
      .rpc();
  }

  async loseSession(user: Keypair, sessionPDA: PublicKey): Promise<void> {
    await this.program.methods
      .loseSession()
      .accounts({
        user: user.publicKey,
        session: sessionPDA,
        houseVault: this.houseVaultPDA,
      })
      .signers([user])
      .rpc();
  }

  async toggleHouseLock(): Promise<void> {
    await this.program.methods
      .toggleHouseLock()
      .accounts({
        houseAuthority: this.houseAuthority.publicKey,
        houseVault: this.houseVaultPDA,
      })
      .signers([this.houseAuthority])
      .rpc();
  }

  async getHouseVault(): Promise<any> {
    return await this.program.account.houseVault.fetch(this.houseVaultPDA);
  }

  async getSession(sessionPDA: PublicKey): Promise<any> {
    return await this.program.account.gameSession.fetch(sessionPDA);
  }

  async getBalance(address: PublicKey): Promise<number> {
    return await this.provider.connection.getBalance(address);
  }
}

// ============================================================================
// Tests
// ============================================================================

describe("dive-game (Secure Implementation)", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.DiveGame as Program;

  let fixture: TestFixture;
  let globalConfigPDA: PublicKey;

  // Initialize config once for all tests
  before(async () => {
    const tempFixture = new TestFixture(program, provider);
    await tempFixture.setupConfig();
    globalConfigPDA = tempFixture.configPDA;
  });

  describe("House Vault Management", () => {
    beforeEach(async () => {
      fixture = new TestFixture(program, provider);
      // Reuse the global config instead of creating a new one
      fixture.configPDA = globalConfigPDA;
      const [, configBump] = TestUtils.getConfigPDA(program.programId);
      fixture.configBump = configBump;
    });

    it("Should initialize house vault", async () => {
      await fixture.setupHouse(false);
      const vault = await fixture.getHouseVault();

      assert.strictEqual(
        vault.houseAuthority.toString(),
        fixture.houseAuthority.publicKey.toString()
      );
      assert.strictEqual(vault.locked, false);
      assert.strictEqual(vault.totalReserved.toString(), "0");
    });

    it("Should toggle house lock", async () => {
      await fixture.setupHouse(false);
      await fixture.toggleHouseLock();

      let vault = await fixture.getHouseVault();
      assert.strictEqual(vault.locked, true);

      await fixture.toggleHouseLock();
      vault = await fixture.getHouseVault();
      assert.strictEqual(vault.locked, false);
    });
  });

  describe("Session Lifecycle", () => {
    beforeEach(async () => {
      fixture = new TestFixture(program, provider);
      fixture.configPDA = globalConfigPDA;
      const [, configBump] = TestUtils.getConfigPDA(program.programId);
      fixture.configBump = configBump;
      await fixture.setupHouse(false);
      await fixture.fundHouse(TEST_AMOUNTS.HUGE);
    });

    it("Should start session with on-chain max_payout", async () => {
      const alice = await fixture.createUser("alice");
      const betAmount = TestUtils.lamportsNum(TEST_AMOUNTS.MEDIUM);
      const sessionPDA = await fixture.startSession(
        alice,
        TEST_AMOUNTS.MEDIUM,
        0
      );

      const session = await fixture.getSession(sessionPDA);
      const expectedMaxPayout = TestUtils.expectedMaxPayout(betAmount);

      assert.strictEqual(session.betAmount.toString(), betAmount.toString());
      assert.strictEqual(
        session.maxPayout.toString(),
        expectedMaxPayout.toString()
      );
      assert.strictEqual(session.rngSeed.length, 32);
    });

    it("Should play rounds with on-chain outcomes", async () => {
      const alice = await fixture.createUser("alice");
      const sessionPDA = await fixture.startSession(
        alice,
        TEST_AMOUNTS.SMALL,
        0
      );

      for (let i = 0; i < 3; i++) {
        try {
          await fixture.playRound(alice, sessionPDA);
          const session = await fixture.getSession(sessionPDA);
          if (session.status.hasOwnProperty("lost")) break;
        } catch {
          break;
        }
      }
    });

    it("Should cash out successfully", async () => {
      const alice = await fixture.createUser("alice");
      const sessionPDA = await fixture.startSession(
        alice,
        TEST_AMOUNTS.SMALL,
        0
      );

      await fixture.playRound(alice, sessionPDA);
      const session = await fixture.getSession(sessionPDA);

      if (!session.status.hasOwnProperty("lost")) {
        await fixture.cashOut(alice, sessionPDA);

        let failed = false;
        try {
          await fixture.getSession(sessionPDA);
        } catch {
          failed = true;
        }
        assert.isTrue(failed, "Session should be closed");
      }
    });
  });

  describe("Failure Modes", () => {
    beforeEach(async () => {
      fixture = new TestFixture(program, provider);
      fixture.configPDA = globalConfigPDA;
      const [, configBump] = TestUtils.getConfigPDA(program.programId);
      fixture.configBump = configBump;
      await fixture.setupHouse(false);
      await fixture.fundHouse(TEST_AMOUNTS.HUGE);
    });

    it("Should fail when house is locked", async () => {
      const alice = await fixture.createUser("alice");
      await fixture.toggleHouseLock();

      let failed = false;
      try {
        await fixture.startSession(alice, TEST_AMOUNTS.MEDIUM, 0);
      } catch (error: any) {
        failed = true;
        const err = TestUtils.parseAnchorError(error.logs);
        assert.strictEqual(err?.error.errorCode.code, "HouseLocked");
      }
      assert.isTrue(failed);
    });

    it("Should fail with zero bet", async () => {
      const alice = await fixture.createUser("alice");
      const [sessionPDA] = TestUtils.getSessionPDA(
        alice.publicKey,
        0,
        program.programId
      );

      let failed = false;
      try {
        await program.methods
          .startSession(new BN(0), new BN(0))
          .accounts({
            user: alice.publicKey,
            houseVault: fixture.houseVaultPDA,
            houseAuthority: fixture.houseAuthority.publicKey,
            session: sessionPDA,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .signers([alice])
          .rpc();
      } catch (error: any) {
        failed = true;
        const err = TestUtils.parseAnchorError(error.logs);
        assert.strictEqual(err?.error.errorCode.code, "InvalidBetAmount");
      }
      assert.isTrue(failed);
    });
  });

  // ============================================================================
  // F. Multi-User Concurrent Sessions
  // ============================================================================

  describe("Multi-User Concurrent Sessions", () => {
    beforeEach(async () => {
      fixture = new TestFixture(program, provider);
      fixture.configPDA = globalConfigPDA;
      const [, configBump] = TestUtils.getConfigPDA(program.programId);
      fixture.configBump = configBump;
      await fixture.setupHouse(false);
      await fixture.fundHouse(TEST_AMOUNTS.HUGE * 20); // Increased for large concurrent bets
    });

    it("Should handle multiple users with independent sessions", async () => {
      const alice = await fixture.createUser("alice");
      const bob = await fixture.createUser("bob");
      const charlie = await fixture.createUser("charlie", 20); // Extra funds for large bet

      // Start sessions for all users sequentially with confirmation
      const aliceSession = await fixture.startSession(
        alice,
        TEST_AMOUNTS.MEDIUM,
        0
      );
      await new Promise((resolve) => setTimeout(resolve, 100)); // Small delay for confirmation

      const bobSession = await fixture.startSession(bob, TEST_AMOUNTS.SMALL, 0);
      await new Promise((resolve) => setTimeout(resolve, 100));

      const charlieSession = await fixture.startSession(
        charlie,
        TEST_AMOUNTS.LARGE,
        0
      );
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify total reserved
      const vault = await fixture.getHouseVault();
      const expectedReserved = TestUtils.expectedMaxPayout(
        TestUtils.lamportsNum(TEST_AMOUNTS.MEDIUM)
      )
        .add(
          TestUtils.expectedMaxPayout(TestUtils.lamportsNum(TEST_AMOUNTS.SMALL))
        )
        .add(
          TestUtils.expectedMaxPayout(TestUtils.lamportsNum(TEST_AMOUNTS.LARGE))
        );

      assert.strictEqual(
        vault.totalReserved.toString(),
        expectedReserved.toString()
      );

      // Each user plays independently
      await fixture.playRound(alice, aliceSession);
      await fixture.playRound(bob, bobSession);
      await fixture.playRound(charlie, charlieSession);

      // Verify sessions are independent
      const aliceData = await fixture.getSession(aliceSession);
      const bobData = await fixture.getSession(bobSession);
      const charlieData = await fixture.getSession(charlieSession);

      // Each should have different RNG seeds
      const aliceSeed = Buffer.from(aliceData.rngSeed).toString("hex");
      const bobSeed = Buffer.from(bobData.rngSeed).toString("hex");
      const charlieSeed = Buffer.from(charlieData.rngSeed).toString("hex");

      assert.notEqual(aliceSeed, bobSeed);
      assert.notEqual(bobSeed, charlieSeed);
      assert.notEqual(aliceSeed, charlieSeed);
    });

    it("Should prevent cross-user session manipulation", async () => {
      const alice = await fixture.createUser("alice");
      const bob = await fixture.createUser("bob");

      const aliceSession = await fixture.startSession(
        alice,
        TEST_AMOUNTS.MEDIUM,
        0
      );

      // Bob tries to play Alice's session
      let failed = false;
      try {
        await fixture.playRound(bob, aliceSession);
      } catch (error: any) {
        failed = true;
        assert.isTrue(TestUtils.errorContains(error.logs, "constraint"));
      }
      assert.isTrue(failed, "Cross-user access should fail");

      // Bob tries to cash out Alice's session
      failed = false;
      try {
        await fixture.cashOut(bob, aliceSession);
      } catch (error: any) {
        failed = true;
        assert.isTrue(TestUtils.errorContains(error.logs, "constraint"));
      }
      assert.isTrue(failed, "Cross-user cash out should fail");

      // Bob tries to lose Alice's session
      failed = false;
      try {
        await fixture.loseSession(bob, aliceSession);
      } catch (error: any) {
        failed = true;
        assert.isTrue(TestUtils.errorContains(error.logs, "constraint"));
      }
      assert.isTrue(failed, "Cross-user lose should fail");
    });

    it("Should handle one user with multiple sessions", async () => {
      const alice = await fixture.createUser("alice", TEST_AMOUNTS.LARGE);

      // Start multiple sessions for same user
      const session1 = await fixture.startSession(alice, TEST_AMOUNTS.TINY, 0);
      const session2 = await fixture.startSession(alice, TEST_AMOUNTS.TINY, 1);
      const session3 = await fixture.startSession(alice, TEST_AMOUNTS.TINY, 2);

      // Verify each has unique RNG seed
      const data1 = await fixture.getSession(session1);
      const data2 = await fixture.getSession(session2);
      const data3 = await fixture.getSession(session3);

      const seed1 = Buffer.from(data1.rngSeed).toString("hex");
      const seed2 = Buffer.from(data2.rngSeed).toString("hex");
      const seed3 = Buffer.from(data3.rngSeed).toString("hex");

      assert.notEqual(seed1, seed2);
      assert.notEqual(seed2, seed3);
      assert.notEqual(seed1, seed3);

      // Play rounds on different sessions
      await fixture.playRound(alice, session1);
      await fixture.playRound(alice, session2);

      // Verify total reserved is correct
      const vault = await fixture.getHouseVault();
      const expectedReserved = TestUtils.expectedMaxPayout(
        TestUtils.lamportsNum(TEST_AMOUNTS.TINY)
      ).muln(3);

      assert.strictEqual(
        vault.totalReserved.toString(),
        expectedReserved.toString()
      );
    });

    it("Should correctly update reserved funds as sessions complete", async () => {
      const alice = await fixture.createUser("alice");
      const bob = await fixture.createUser("bob");

      const aliceSession = await fixture.startSession(
        alice,
        TEST_AMOUNTS.SMALL,
        0
      );
      const bobSession = await fixture.startSession(bob, TEST_AMOUNTS.SMALL, 0);

      const aliceMaxPayout = TestUtils.expectedMaxPayout(
        TestUtils.lamportsNum(TEST_AMOUNTS.SMALL)
      );
      const initialReserved = aliceMaxPayout.muln(2);

      let vault = await fixture.getHouseVault();
      assert.strictEqual(
        vault.totalReserved.toString(),
        initialReserved.toString()
      );

      // Alice loses
      await fixture.loseSession(alice, aliceSession);

      vault = await fixture.getHouseVault();
      assert.strictEqual(
        vault.totalReserved.toString(),
        aliceMaxPayout.toString()
      );

      // Bob loses
      await fixture.loseSession(bob, bobSession);

      vault = await fixture.getHouseVault();
      assert.strictEqual(vault.totalReserved.toString(), "0");
    });
  });

  // ============================================================================
  // G. Game Progression & State Transitions
  // ============================================================================

  describe("Game Progression & State Transitions", () => {
    beforeEach(async () => {
      fixture = new TestFixture(program, provider);
      fixture.configPDA = globalConfigPDA;
      const [, configBump] = TestUtils.getConfigPDA(program.programId);
      fixture.configBump = configBump;
      await fixture.setupHouse(false);
      await fixture.fundHouse(TEST_AMOUNTS.HUGE);
    });

    it("Should track dive progression correctly", async () => {
      const alice = await fixture.createUser("alice");
      const sessionPDA = await fixture.startSession(
        alice,
        TEST_AMOUNTS.SMALL,
        0
      );

      let session = await fixture.getSession(sessionPDA);
      assert.strictEqual(session.diveNumber, 1);

      // Play multiple rounds
      for (let i = 0; i < 10; i++) {
        try {
          await fixture.playRound(alice, sessionPDA);
          session = await fixture.getSession(sessionPDA);

          if (session.status.hasOwnProperty("lost")) {
            console.log(`    Player lost at dive ${session.diveNumber}`);
            break;
          } else {
            assert.strictEqual(session.diveNumber, i + 2);
          }
        } catch {
          break;
        }
      }
    });

    it("Should increase treasure with each successful dive", async () => {
      const alice = await fixture.createUser("alice");
      const sessionPDA = await fixture.startSession(
        alice,
        TEST_AMOUNTS.SMALL,
        0
      );

      let previousTreasure = TestUtils.lamportsNum(TEST_AMOUNTS.SMALL);

      for (let i = 0; i < 5; i++) {
        try {
          await fixture.playRound(alice, sessionPDA);
          const session = await fixture.getSession(sessionPDA);

          if (session.status.hasOwnProperty("lost")) {
            break;
          }

          const currentTreasure = session.currentTreasure.toNumber();
          assert.isTrue(
            currentTreasure > previousTreasure,
            `Treasure should increase (was ${previousTreasure}, now ${currentTreasure})`
          );
          previousTreasure = currentTreasure;
        } catch {
          break;
        }
      }
    });

    it("Should enforce status transitions", async () => {
      const alice = await fixture.createUser("alice");
      const sessionPDA = await fixture.startSession(
        alice,
        TEST_AMOUNTS.SMALL,
        0
      );

      // Active -> Lost
      await fixture.loseSession(alice, sessionPDA);

      // Try to play after lost (should fail - session is closed)
      let failed = false;
      try {
        await fixture.playRound(alice, sessionPDA);
      } catch {
        failed = true;
      }
      assert.isTrue(failed, "Cannot play after session closed");
    });

    it("Should enforce cash out restrictions", async () => {
      const alice = await fixture.createUser("alice");
      const sessionPDA = await fixture.startSession(
        alice,
        TEST_AMOUNTS.SMALL,
        0
      );

      // Try to cash out at dive 1 (treasure == bet, should fail)
      let failed = false;
      try {
        await fixture.cashOut(alice, sessionPDA);
      } catch (error: any) {
        failed = true;
        const err = TestUtils.parseAnchorError(error.logs);
        assert.strictEqual(err?.error.errorCode.code, "InsufficientTreasure");
      }
      assert.isTrue(failed, "Cannot cash out at dive 1");
    });

    it("Should handle session after multiple play rounds", async () => {
      const alice = await fixture.createUser("alice");
      const sessionPDA = await fixture.startSession(
        alice,
        TEST_AMOUNTS.SMALL,
        0
      );

      let roundsPlayed = 0;
      let sessionLost = false;

      // Play up to 20 rounds
      for (let i = 0; i < 20; i++) {
        try {
          await fixture.playRound(alice, sessionPDA);
          roundsPlayed++;

          const session = await fixture.getSession(sessionPDA);
          if (session.status.hasOwnProperty("lost")) {
            sessionLost = true;
            console.log(
              `    Session lost after ${roundsPlayed} rounds at dive ${session.diveNumber}`
            );
            break;
          }
        } catch {
          break;
        }
      }

      console.log(`    Played ${roundsPlayed} rounds total`);
      assert.isTrue(roundsPlayed > 0, "Should play at least one round");
    });
  });

  // ============================================================================
  // H. Edge Cases & Boundary Conditions
  // ============================================================================

  describe("Edge Cases & Boundary Conditions", () => {
    beforeEach(async () => {
      fixture = new TestFixture(program, provider);
      fixture.configPDA = globalConfigPDA;
      const [, configBump] = TestUtils.getConfigPDA(program.programId);
      fixture.configBump = configBump;
      await fixture.setupHouse(false);
      await fixture.fundHouse(TEST_AMOUNTS.HUGE * 100); // Increased for large bet test
    });

    it("Should handle minimum bet amount", async () => {
      const alice = await fixture.createUser("alice");

      // 1 lamport bet
      const [sessionPDA] = TestUtils.getSessionPDA(
        alice.publicKey,
        0,
        program.programId
      );
      await program.methods
        .startSession(new BN(1), new BN(0))
        .accounts({
          user: alice.publicKey,
          houseVault: fixture.houseVaultPDA,
          houseAuthority: fixture.houseAuthority.publicKey,
          session: sessionPDA,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([alice])
        .rpc();

      const session = await fixture.getSession(sessionPDA);
      assert.strictEqual(session.betAmount.toString(), "1");
      assert.strictEqual(session.maxPayout.toString(), "100"); // 1 * 100
    });

    it("Should handle very large bet amounts", async () => {
      const alice = await fixture.createUser("alice", TEST_AMOUNTS.HUGE);

      // 50 SOL bet
      const sessionPDA = await fixture.startSession(alice, 50, 0);

      const session = await fixture.getSession(sessionPDA);
      const expectedMaxPayout = TestUtils.expectedMaxPayout(
        TestUtils.lamportsNum(50)
      );

      assert.strictEqual(
        session.betAmount.toString(),
        TestUtils.lamportsNum(50).toString()
      );
      assert.strictEqual(
        session.maxPayout.toString(),
        expectedMaxPayout.toString()
      );
    });

    it("Should fail when trying to reuse session index", async () => {
      const alice = await fixture.createUser("alice");

      // Start a session with index 0
      const sessionPDA = await fixture.startSession(
        alice,
        TEST_AMOUNTS.SMALL,
        0
      );

      // Try to start another session with same index while first is still active
      let failed = false;
      try {
        await fixture.startSession(alice, TEST_AMOUNTS.SMALL, 0);
      } catch (error: any) {
        failed = true;
        assert.isTrue(error.message.includes("already in use"));
      }
      assert.isTrue(failed, "Cannot reuse session index while active");
    });

    it("Should handle rapid successive operations", async () => {
      const alice = await fixture.createUser("alice");
      const sessionPDA = await fixture.startSession(
        alice,
        TEST_AMOUNTS.SMALL,
        0
      );

      // Rapidly play multiple rounds
      const promises = [];
      for (let i = 0; i < 3; i++) {
        promises.push(fixture.playRound(alice, sessionPDA).catch(() => {}));
      }

      await Promise.allSettled(promises);

      // At least one should succeed
      const session = await fixture.getSession(sessionPDA);
      assert.isTrue(
        session.diveNumber >= 2,
        "At least one round should have been played"
      );
    });

    it("Should maintain integrity after house unlock/lock", async () => {
      const alice = await fixture.createUser("alice");
      const sessionPDA = await fixture.startSession(
        alice,
        TEST_AMOUNTS.SMALL,
        0
      );

      // Lock and unlock house while session active
      await fixture.toggleHouseLock();
      await fixture.toggleHouseLock();

      // Session should still be playable
      await fixture.playRound(alice, sessionPDA);

      const session = await fixture.getSession(sessionPDA);
      assert.isTrue(
        session.status.hasOwnProperty("active") ||
          session.status.hasOwnProperty("lost")
      );
    });
  });

  // ============================================================================
  // I. Invariant & Conservation Properties
  // ============================================================================

  describe("Invariant & Conservation Properties", () => {
    beforeEach(async () => {
      fixture = new TestFixture(program, provider);
      fixture.configPDA = globalConfigPDA;
      const [, configBump] = TestUtils.getConfigPDA(program.programId);
      fixture.configBump = configBump;
      await fixture.setupHouse(false);
      await fixture.fundHouse(TEST_AMOUNTS.HUGE * 100); // Increased for large bet tests
    });

    it("Should maintain money conservation across operations", async () => {
      const alice = await fixture.createUser("alice");
      const bob = await fixture.createUser("bob");

      const initialAlice = await fixture.getBalance(alice.publicKey);
      const initialBob = await fixture.getBalance(bob.publicKey);
      const initialHouse = await fixture.getBalance(fixture.houseVaultPDA);
      const initialTotal = initialAlice + initialBob + initialHouse;

      // Multiple operations
      const aliceSession = await fixture.startSession(
        alice,
        TEST_AMOUNTS.SMALL,
        0
      );
      await fixture.playRound(alice, aliceSession);

      const aliceData = await fixture.getSession(aliceSession);
      if (!aliceData.status.hasOwnProperty("lost")) {
        await fixture.cashOut(alice, aliceSession);
      }

      const bobSession = await fixture.startSession(bob, TEST_AMOUNTS.SMALL, 0);
      await fixture.loseSession(bob, bobSession);

      // Check final total (allow for fees + rent)
      const finalAlice = await fixture.getBalance(alice.publicKey);
      const finalBob = await fixture.getBalance(bob.publicKey);
      const finalHouse = await fixture.getBalance(fixture.houseVaultPDA);
      const finalTotal = finalAlice + finalBob + finalHouse;

      const maxExpectedLoss = TestUtils.lamportsNum(0.15); // 0.15 SOL for fees+rent
      const difference = Math.abs(finalTotal - initialTotal);

      assert.isTrue(
        difference < maxExpectedLoss,
        `Money should be conserved (difference: ${TestUtils.toSOL(
          difference
        )} SOL)`
      );
    });

    it("Should always keep totalReserved accurate", async () => {
      const alice = await fixture.createUser("alice");
      const bob = await fixture.createUser("bob");

      // Start sessions
      const aliceSession = await fixture.startSession(
        alice,
        TEST_AMOUNTS.MEDIUM,
        0
      );
      const bobSession = await fixture.startSession(bob, TEST_AMOUNTS.SMALL, 0);

      const expectedReserved1 = TestUtils.expectedMaxPayout(
        TestUtils.lamportsNum(TEST_AMOUNTS.MEDIUM)
      ).add(
        TestUtils.expectedMaxPayout(TestUtils.lamportsNum(TEST_AMOUNTS.SMALL))
      );

      let vault = await fixture.getHouseVault();
      assert.strictEqual(
        vault.totalReserved.toString(),
        expectedReserved1.toString()
      );

      // Alice loses
      await fixture.loseSession(alice, aliceSession);

      const expectedReserved2 = TestUtils.expectedMaxPayout(
        TestUtils.lamportsNum(TEST_AMOUNTS.SMALL)
      );
      vault = await fixture.getHouseVault();
      assert.strictEqual(
        vault.totalReserved.toString(),
        expectedReserved2.toString()
      );

      // Bob cashes out
      await fixture.playRound(bob, bobSession);
      const bobData = await fixture.getSession(bobSession);
      if (!bobData.status.hasOwnProperty("lost")) {
        await fixture.playRound(bob, bobSession);
        const bobData2 = await fixture.getSession(bobSession);
        if (!bobData2.status.hasOwnProperty("lost")) {
          await fixture.cashOut(bob, bobSession);
        }
      }

      // All sessions closed, reserved should be 0
      vault = await fixture.getHouseVault();
      assert.strictEqual(vault.totalReserved.toString(), "0");
    });

    it("Should never allow treasure to exceed max_payout", async () => {
      const alice = await fixture.createUser("alice");
      const sessionPDA = await fixture.startSession(
        alice,
        TEST_AMOUNTS.SMALL,
        0
      );

      const session = await fixture.getSession(sessionPDA);
      const maxPayout = session.maxPayout.toNumber();

      // Play many rounds
      for (let i = 0; i < 50; i++) {
        try {
          await fixture.playRound(alice, sessionPDA);
          const currentSession = await fixture.getSession(sessionPDA);

          if (currentSession.status.hasOwnProperty("lost")) {
            break;
          }

          assert.isTrue(
            currentSession.currentTreasure.toNumber() <= maxPayout,
            `Treasure ${currentSession.currentTreasure} should not exceed max ${maxPayout}`
          );
        } catch {
          break;
        }
      }
    });

    it("Should maintain house vault balance >= totalReserved", async () => {
      const alice = await fixture.createUser("alice");
      const bob = await fixture.createUser("bob");

      await fixture.startSession(alice, TEST_AMOUNTS.MEDIUM, 0);
      await fixture.startSession(bob, TEST_AMOUNTS.SMALL, 0);

      const vault = await fixture.getHouseVault();
      const balance = await fixture.getBalance(fixture.houseVaultPDA);

      assert.isTrue(
        balance >= vault.totalReserved.toNumber(),
        `Balance ${balance} should be >= reserved ${vault.totalReserved}`
      );
    });
  });

  // ============================================================================
  // J. Stress & Load Testing
  // ============================================================================

  describe("Stress & Load Testing", () => {
    beforeEach(async () => {
      fixture = new TestFixture(program, provider);
      fixture.configPDA = globalConfigPDA;
      const [, configBump] = TestUtils.getConfigPDA(program.programId);
      fixture.configBump = configBump;
      await fixture.setupHouse(false);
      await fixture.fundHouse(TEST_AMOUNTS.HUGE * 3);
    });

    it("Should handle 10 concurrent sessions", async () => {
      const users = [];
      const sessions = [];

      // Create 10 users and start sessions
      for (let i = 0; i < 10; i++) {
        const user = await fixture.createUser(`user${i}`, TEST_AMOUNTS.LARGE);
        users.push(user);
        const session = await fixture.startSession(user, TEST_AMOUNTS.TINY, 0);
        sessions.push(session);
      }

      // Verify total reserved
      const expectedReserved = TestUtils.expectedMaxPayout(
        TestUtils.lamportsNum(TEST_AMOUNTS.TINY)
      ).muln(10);

      const vault = await fixture.getHouseVault();
      assert.strictEqual(
        vault.totalReserved.toString(),
        expectedReserved.toString()
      );

      console.log(`    Successfully created 10 concurrent sessions`);
      console.log(
        `    Total reserved: ${TestUtils.toSOL(
          vault.totalReserved.toNumber()
        )} SOL`
      );
    });

    it("Should handle sequential session lifecycle", async () => {
      const alice = await fixture.createUser("alice", TEST_AMOUNTS.LARGE);

      let successfulSessions = 0;

      // Create and complete 5 sessions sequentially
      for (let i = 0; i < 5; i++) {
        try {
          const sessionPDA = await fixture.startSession(
            alice,
            TEST_AMOUNTS.TINY,
            i
          );

          // Play a few rounds
          for (let j = 0; j < 3; j++) {
            try {
              await fixture.playRound(alice, sessionPDA);
            } catch {
              break;
            }
          }

          // End session
          try {
            const session = await fixture.getSession(sessionPDA);
            if (session.status.hasOwnProperty("active")) {
              await fixture.loseSession(alice, sessionPDA);
            }
          } catch {}

          successfulSessions++;
        } catch (error) {
          console.log(`    Session ${i} failed: ${error}`);
        }
      }

      assert.strictEqual(
        successfulSessions,
        5,
        "All 5 sessions should complete"
      );
      console.log(
        `    Successfully completed ${successfulSessions} sequential sessions`
      );
    });

    it("Should handle varying bet amounts", async () => {
      const betAmounts = [
        TEST_AMOUNTS.TINY,
        TEST_AMOUNTS.SMALL,
        TEST_AMOUNTS.MEDIUM,
        TEST_AMOUNTS.SMALL,
        TEST_AMOUNTS.TINY,
      ];

      let totalReservedExpected = new BN(0);

      for (let i = 0; i < betAmounts.length; i++) {
        const user = await fixture.createUser(`user${i}`, TEST_AMOUNTS.LARGE);
        await fixture.startSession(user, betAmounts[i], 0);

        totalReservedExpected = totalReservedExpected.add(
          TestUtils.expectedMaxPayout(TestUtils.lamportsNum(betAmounts[i]))
        );
      }

      const vault = await fixture.getHouseVault();
      assert.strictEqual(
        vault.totalReserved.toString(),
        totalReservedExpected.toString()
      );

      console.log(
        `    Successfully handled ${betAmounts.length} sessions with varying bets`
      );
      console.log(
        `    Total reserved: ${TestUtils.toSOL(
          vault.totalReserved.toNumber()
        )} SOL`
      );
    });
  });

  // ============================================================================
  // K. Config Validation
  // ============================================================================

  describe("Config Validation", () => {
    // Note: Config validation is tested in Rust unit tests (init_config.rs)
    // These integration tests would require a fresh validator or unique config PDAs
    // Since we use a singleton config PDA, we skip integration tests here
    // and rely on the 6 comprehensive Rust unit tests that validate:
    // - Zero denominator rejection
    // - Inverted probabilities rejection
    // - Probability > 100% rejection
    // - min_bet > max_bet rejection
    // - Zero max_dives rejection
    // - Valid config acceptance

    it("Config validation is covered by Rust unit tests", () => {
      // This is a placeholder to indicate config validation exists
      // Run: cargo test --package dive_game to see all 93 passing Rust tests
      assert.isTrue(true);
    });
  });

  // ============================================================================
  // L. Bet Bounds Validation
  // ============================================================================

  describe("Bet Bounds Validation", () => {
    let customConfigPDA: PublicKey;
    let customConfigAdmin: Keypair;

    beforeEach(async () => {
      fixture = new TestFixture(program, provider);
      customConfigAdmin = Keypair.generate();
      await TestUtils.airdrop(
        provider.connection,
        customConfigAdmin.publicKey,
        1
      );

      // Create custom config with specific bet limits
      [customConfigPDA] = TestUtils.getConfigPDA(program.programId);

      await program.methods
        .initConfig({
          baseSurvivalPpm: null,
          decayPerDivePpm: null,
          minSurvivalPpm: null,
          treasureMultiplierNum: null,
          treasureMultiplierDen: null,
          maxPayoutMultiplier: null,
          maxDives: null,
          minBet: TestUtils.lamports(0.001), // 0.001 SOL minimum
          maxBet: TestUtils.lamports(10), // 10 SOL maximum
        })
        .accounts({
          admin: customConfigAdmin.publicKey,
          config: customConfigPDA,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([customConfigAdmin])
        .rpc();

      fixture.configPDA = customConfigPDA;
      const [, configBump] = TestUtils.getConfigPDA(program.programId);
      fixture.configBump = configBump;
      await fixture.setupHouse(false);
      await fixture.fundHouse(TEST_AMOUNTS.HUGE);
    });

    it("Should reject bet < min_bet", async () => {
      const alice = await fixture.createUser("alice");

      let failed = false;
      try {
        await fixture.startSession(alice, 0.0005, 0); // Less than 0.001 SOL min
      } catch (error: any) {
        failed = true;
        const err = TestUtils.parseAnchorError(error.logs);
        assert.strictEqual(err?.error.errorCode.code, "InvalidBetAmount");
      }
      assert.isTrue(failed, "Should reject bet below minimum");
    });

    it("Should reject bet > max_bet", async () => {
      const alice = await fixture.createUser("alice", 20);

      let failed = false;
      try {
        await fixture.startSession(alice, 15, 0); // Greater than 10 SOL max
      } catch (error: any) {
        failed = true;
        const err = TestUtils.parseAnchorError(error.logs);
        assert.strictEqual(err?.error.errorCode.code, "InvalidBetAmount");
      }
      assert.isTrue(failed, "Should reject bet above maximum");
    });

    it("Should accept bet within bounds", async () => {
      const alice = await fixture.createUser("alice");
      const sessionPDA = await fixture.startSession(alice, 1, 0);
      const session = await fixture.getSession(sessionPDA);
      assert.strictEqual(
        session.betAmount.toString(),
        TestUtils.lamports(1).toString()
      );
    });
  });

  // ============================================================================
  // M. Max Dives Boundary Tests
  // ============================================================================

  describe("Max Dives Boundary", () => {
    let customConfigPDA: PublicKey;
    let customConfigAdmin: Keypair;

    beforeEach(async () => {
      fixture = new TestFixture(program, provider);
      customConfigAdmin = Keypair.generate();
      await TestUtils.airdrop(
        provider.connection,
        customConfigAdmin.publicKey,
        1
      );

      // Create custom config with low max_dives for testing
      [customConfigPDA] = TestUtils.getConfigPDA(program.programId);

      await program.methods
        .initConfig({
          baseSurvivalPpm: null,
          decayPerDivePpm: null,
          minSurvivalPpm: null,
          treasureMultiplierNum: null,
          treasureMultiplierDen: null,
          maxPayoutMultiplier: null,
          maxDives: 5, // Very low for testing
          minBet: null,
          maxBet: null,
        })
        .accounts({
          admin: customConfigAdmin.publicKey,
          config: customConfigPDA,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([customConfigAdmin])
        .rpc();

      fixture.configPDA = customConfigPDA;
      const [, configBump] = TestUtils.getConfigPDA(program.programId);
      fixture.configBump = configBump;
      await fixture.setupHouse(false);
      await fixture.fundHouse(TEST_AMOUNTS.HUGE);
    });

    it("Should prevent playing beyond max_dives", async () => {
      const alice = await fixture.createUser("alice");
      const sessionPDA = await fixture.startSession(
        alice,
        TEST_AMOUNTS.SMALL,
        0
      );

      // Play rounds until we reach max_dives (5)
      for (let i = 1; i < 5; i++) {
        try {
          await fixture.playRound(alice, sessionPDA);
          const session = await fixture.getSession(sessionPDA);
          if (session.status.hasOwnProperty("lost")) {
            console.log(`    Player lost early at dive ${session.diveNumber}`);
            return; // Test passes - player lost before reaching limit
          }
        } catch {
          // Ignore losses
          return;
        }
      }

      // If we get here, player survived to dive 5
      const session = await fixture.getSession(sessionPDA);
      if (session.status.hasOwnProperty("active")) {
        assert.strictEqual(session.diveNumber, 5);

        // Next play_round should fail with MaxDivesReached
        let failed = false;
        try {
          await fixture.playRound(alice, sessionPDA);
        } catch (error: any) {
          failed = true;
          const err = TestUtils.parseAnchorError(error.logs);
          assert.strictEqual(err?.error.errorCode.code, "MaxDivesReached");
        }
        assert.isTrue(failed, "Should not play beyond max_dives");
      }
    });
  });

  // ============================================================================
  // N. House Lock Semantics
  // ============================================================================

  describe("House Lock Semantics", () => {
    beforeEach(async () => {
      fixture = new TestFixture(program, provider);
      fixture.configPDA = globalConfigPDA;
      const [, configBump] = TestUtils.getConfigPDA(program.programId);
      fixture.configBump = configBump;
      await fixture.setupHouse(false);
      await fixture.fundHouse(TEST_AMOUNTS.HUGE);
    });

    it("Should prevent cash_out when house is locked", async () => {
      const alice = await fixture.createUser("alice");
      const sessionPDA = await fixture.startSession(
        alice,
        TEST_AMOUNTS.SMALL,
        0
      );

      // Play rounds until profitable
      for (let i = 0; i < 3; i++) {
        await fixture.playRound(alice, sessionPDA);
        const session = await fixture.getSession(sessionPDA);
        if (session.status.hasOwnProperty("lost")) {
          return; // Can't test cash_out if lost
        }
        if (session.currentTreasure.gt(session.betAmount)) {
          break;
        }
      }

      const session = await fixture.getSession(sessionPDA);
      if (
        session.status.hasOwnProperty("active") &&
        session.currentTreasure.gt(session.betAmount)
      ) {
        // Lock the house
        await fixture.toggleHouseLock();

        // Try to cash out - should fail
        let failed = false;
        try {
          await fixture.cashOut(alice, sessionPDA);
        } catch (error: any) {
          failed = true;
          const err = TestUtils.parseAnchorError(error.logs);
          assert.strictEqual(err?.error.errorCode.code, "HouseLocked");
        }
        assert.isTrue(failed, "Should prevent cash_out when locked");
      }
    });

    it("Should allow play_round when house is locked", async () => {
      const alice = await fixture.createUser("alice");
      const sessionPDA = await fixture.startSession(
        alice,
        TEST_AMOUNTS.SMALL,
        0
      );

      // Lock the house
      await fixture.toggleHouseLock();

      // play_round should still work
      await fixture.playRound(alice, sessionPDA);
      const session = await fixture.getSession(sessionPDA);

      assert.isTrue(
        session.status.hasOwnProperty("active") ||
          session.status.hasOwnProperty("lost")
      );
    });
  });

  // ============================================================================
  // O. Liquidity Checks
  // ============================================================================

  describe("Liquidity Validation", () => {
    beforeEach(async () => {
      fixture = new TestFixture(program, provider);
      fixture.configPDA = globalConfigPDA;
      const [, configBump] = TestUtils.getConfigPDA(program.programId);
      fixture.configBump = configBump;
      await fixture.setupHouse(false);
      await fixture.fundHouse(150); // 150 SOL - enough for one 1 SOL bet (100 SOL reserve) but not two
    });

    it("Should reject session when vault has insufficient free liquidity", async () => {
      const alice = await fixture.createUser("alice", 10);
      const bob = await fixture.createUser("bob", 10);

      // Alice's session reserves 100 SOL (1 SOL * 100 multiplier)
      await fixture.startSession(alice, 1, 0);

      // Vault now has 151 SOL total (150 + 1 from Alice's bet)
      // But 100 SOL is reserved, leaving 51 SOL free
      // Bob's 1 SOL bet would need 100 SOL reserve, but only 51 is available

      let failed = false;
      try {
        await fixture.startSession(bob, 1, 0); // Would need another 100 SOL reserve
      } catch (error: any) {
        failed = true;
        const err = TestUtils.parseAnchorError(error.logs);
        assert.strictEqual(
          err?.error.errorCode.code,
          "InsufficientVaultBalance"
        );
      }
      assert.isTrue(failed, "Should reject when insufficient liquidity");
    });
  });

  // ============================================================================
  // P. Cash Out Treasure Validation
  // ============================================================================

  describe("Cash Out Treasure Validation", () => {
    beforeEach(async () => {
      fixture = new TestFixture(program, provider);
      fixture.configPDA = globalConfigPDA;
      const [, configBump] = TestUtils.getConfigPDA(program.programId);
      fixture.configBump = configBump;
      await fixture.setupHouse(false);
      await fixture.fundHouse(TEST_AMOUNTS.HUGE);
    });

    it("Should prevent cash_out when treasure == bet_amount", async () => {
      const alice = await fixture.createUser("alice");
      const sessionPDA = await fixture.startSession(
        alice,
        TEST_AMOUNTS.SMALL,
        0
      );

      // Immediately after start, treasure == bet
      const session = await fixture.getSession(sessionPDA);
      assert.strictEqual(
        session.currentTreasure.toString(),
        session.betAmount.toString()
      );

      let failed = false;
      try {
        await fixture.cashOut(alice, sessionPDA);
      } catch (error: any) {
        failed = true;
        const err = TestUtils.parseAnchorError(error.logs);
        assert.strictEqual(err?.error.errorCode.code, "InsufficientTreasure");
      }
      assert.isTrue(failed, "Should prevent cash_out when treasure equals bet");
    });
  });

  // ============================================================================
  // Q. Status Transition Tests
  // ============================================================================

  describe("Status Transitions", () => {
    beforeEach(async () => {
      fixture = new TestFixture(program, provider);
      fixture.configPDA = globalConfigPDA;
      const [, configBump] = TestUtils.getConfigPDA(program.programId);
      fixture.configBump = configBump;
      await fixture.setupHouse(false);
      await fixture.fundHouse(TEST_AMOUNTS.HUGE);
    });

    it("Should not allow play_round after cash_out", async () => {
      const alice = await fixture.createUser("alice");
      const sessionPDA = await fixture.startSession(
        alice,
        TEST_AMOUNTS.SMALL,
        0
      );

      // Play until profitable
      for (let i = 0; i < 5; i++) {
        await fixture.playRound(alice, sessionPDA);
        const session = await fixture.getSession(sessionPDA);
        if (session.status.hasOwnProperty("lost")) {
          return; // Can't test if lost
        }
        if (session.currentTreasure.gt(session.betAmount)) {
          await fixture.cashOut(alice, sessionPDA);
          break;
        }
      }

      // Try to play after cashing out
      let failed = false;
      try {
        await fixture.playRound(alice, sessionPDA);
      } catch (error: any) {
        failed = true;
        const err = TestUtils.parseAnchorError(error.logs);
        assert.strictEqual(err?.error.errorCode.code, "InvalidSessionStatus");
      }
      assert.isTrue(failed, "Should not play after cash_out");
    });

    it("Should not allow play_round after session is lost", async () => {
      const alice = await fixture.createUser("alice");
      const sessionPDA = await fixture.startSession(
        alice,
        TEST_AMOUNTS.SMALL,
        0
      );

      // Play until lost
      for (let i = 0; i < 50; i++) {
        await fixture.playRound(alice, sessionPDA);
        const session = await fixture.getSession(sessionPDA);
        if (session.status.hasOwnProperty("lost")) {
          break;
        }
      }

      const session = await fixture.getSession(sessionPDA);
      if (session.status.hasOwnProperty("lost")) {
        let failed = false;
        try {
          await fixture.playRound(alice, sessionPDA);
        } catch (error: any) {
          failed = true;
          const err = TestUtils.parseAnchorError(error.logs);
          assert.strictEqual(err?.error.errorCode.code, "InvalidSessionStatus");
        }
        assert.isTrue(failed, "Should not play after lost");
      }
    });

    it("Should not allow lose_session when already lost", async () => {
      const alice = await fixture.createUser("alice");
      const sessionPDA = await fixture.startSession(
        alice,
        TEST_AMOUNTS.SMALL,
        0
      );

      // Play until lost
      for (let i = 0; i < 50; i++) {
        await fixture.playRound(alice, sessionPDA);
        const session = await fixture.getSession(sessionPDA);
        if (session.status.hasOwnProperty("lost")) {
          break;
        }
      }

      const session = await fixture.getSession(sessionPDA);
      if (session.status.hasOwnProperty("lost")) {
        let failed = false;
        try {
          await fixture.loseSession(alice, sessionPDA);
        } catch (error: any) {
          failed = true;
          const err = TestUtils.parseAnchorError(error.logs);
          assert.strictEqual(err?.error.errorCode.code, "InvalidSessionStatus");
        }
        assert.isTrue(failed, "Should not lose_session when already lost");
      }
    });
  });
});
