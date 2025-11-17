/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/dive_game.json`.
 */
export type DiveGame = {
  address: "5f9Gn6yLcMPqZfFPM9pBYQV1f1h6EBDCSs8jynjfoEQ3";
  metadata: {
    name: "diveGame";
    version: "0.1.0";
    spec: "0.1.0";
    description: "Dive game smart contract for Solana";
  };
  instructions: [
    {
      name: "cashOut";
      discriminator: [1, 110, 57, 58, 159, 157, 243, 192];
      accounts: [
        { name: "user"; writable: true; signer: true },
        { name: "session"; writable: true },
        { name: "houseVault"; writable: true }
      ];
      args: [];
    },
    {
      name: "initConfig";
      discriminator: [23, 235, 115, 232, 168, 96, 1, 231];
      accounts: [
        { name: "admin"; writable: true; signer: true },
        { name: "config"; writable: true; pda: { seeds: [{ kind: "const"; value: [103, 97, 109, 101, 95, 99, 111, 110, 102, 105, 103] }] } },
        { name: "systemProgram"; address: "11111111111111111111111111111111" }
      ];
      args: [{ name: "params"; type: { defined: { name: "gameConfigParams" } } }];
    },
    {
      name: "initHouseVault";
      discriminator: [141, 91, 255, 122, 237, 227, 235, 235];
      accounts: [
        { name: "houseAuthority"; writable: true; signer: true },
        { name: "houseVault"; writable: true },
        { name: "systemProgram"; address: "11111111111111111111111111111111" }
      ];
      args: [{ name: "locked"; type: "bool" }];
    },
    {
      name: "loseSession";
      discriminator: [178, 224, 155, 69, 119, 125, 95, 222];
      accounts: [
        { name: "user"; writable: true; signer: true },
        { name: "session"; writable: true },
        { name: "houseVault"; writable: true }
      ];
      args: [];
    },
    {
      name: "playRound";
      discriminator: [93, 141, 99, 124, 155, 193, 178, 251];
      accounts: [
        { name: "user"; writable: true; signer: true },
        { name: "config" },
        { name: "session"; writable: true },
        { name: "houseVault"; writable: true }
      ];
      args: [];
    },
    {
      name: "startSession";
      discriminator: [70, 252, 178, 51, 144, 187, 207, 172];
      accounts: [
        { name: "user"; writable: true; signer: true },
        { name: "config" },
        { name: "houseVault"; writable: true },
        { name: "houseAuthority" },
        { name: "session"; writable: true },
        { name: "systemProgram"; address: "11111111111111111111111111111111" }
      ];
      args: [
        { name: "betAmount"; type: "u64" },
        { name: "sessionIndex"; type: "u64" }
      ];
    },
    {
      name: "toggleHouseLock";
      discriminator: [238, 41, 164, 80, 142, 156, 205, 141];
      accounts: [
        { name: "houseAuthority"; writable: true; signer: true },
        { name: "houseVault"; writable: true }
      ];
      args: [];
    }
  ];
  accounts: [
    {
      name: "gameConfig";
      discriminator: [130, 111, 100, 189, 72, 251, 183, 182];
    },
    {
      name: "gameSession";
      discriminator: [177, 168, 162, 166, 143, 78, 233, 205];
    },
    {
      name: "houseVault";
      discriminator: [107, 202, 187, 132, 102, 210, 56, 233];
    }
  ];
  events: [];
  errors: [
    { code: 6000; name: "houseLocked"; msg: "House vault is locked" },
    { code: 6001; name: "invalidSessionStatus"; msg: "Session is not active" },
    { code: 6002; name: "invalidBetAmount"; msg: "Bet amount must be greater than zero" },
    { code: 6003; name: "roundMismatch"; msg: "Round number mismatch" },
    { code: 6004; name: "treasureInvalid"; msg: "Treasure amount invalid or exceeds max payout" },
    { code: 6005; name: "insufficientVaultBalance"; msg: "Insufficient vault balance for payout" },
    { code: 6006; name: "overflow"; msg: "Arithmetic overflow" },
    { code: 6007; name: "insufficientTreasure"; msg: "Cannot cash out with treasure less than or equal to bet" },
    { code: 6008; name: "invalidConfig"; msg: "Invalid game configuration" },
    { code: 6009; name: "maxDivesReached"; msg: "Maximum number of dives reached" }
  ];
  types: [
    {
      name: "gameConfig";
      type: {
        kind: "struct";
        fields: [
          { name: "admin"; type: "pubkey" },
          { name: "baseSurvivalPpm"; type: "u32" },
          { name: "decayPerDivePpm"; type: "u32" },
          { name: "minSurvivalPpm"; type: "u32" },
          { name: "treasureMultiplierNum"; type: "u16" },
          { name: "treasureMultiplierDen"; type: "u16" },
          { name: "maxPayoutMultiplier"; type: "u16" },
          { name: "maxDives"; type: "u16" },
          { name: "minBet"; type: "u64" },
          { name: "maxBet"; type: "u64" },
          { name: "bump"; type: "u8" }
        ];
      };
    },
    {
      name: "gameConfigParams";
      type: {
        kind: "struct";
        fields: [
          { name: "baseSurvivalPpm"; type: { option: "u32" } },
          { name: "decayPerDivePpm"; type: { option: "u32" } },
          { name: "minSurvivalPpm"; type: { option: "u32" } },
          { name: "treasureMultiplierNum"; type: { option: "u16" } },
          { name: "treasureMultiplierDen"; type: { option: "u16" } },
          { name: "maxPayoutMultiplier"; type: { option: "u16" } },
          { name: "maxDives"; type: { option: "u16" } },
          { name: "minBet"; type: { option: "u64" } },
          { name: "maxBet"; type: { option: "u64" } }
        ];
      };
    },
    {
      name: "gameSession";
      type: {
        kind: "struct";
        fields: [
          { name: "user"; type: "pubkey" },
          { name: "houseVault"; type: "pubkey" },
          { name: "status"; type: { defined: { name: "sessionStatus" } } },
          { name: "betAmount"; type: "u64" },
          { name: "currentTreasure"; type: "u64" },
          { name: "maxPayout"; type: "u64" },
          { name: "diveNumber"; type: "u16" },
          { name: "bump"; type: "u8" },
          { name: "rngSeed"; type: { array: ["u8", 32] } }
        ];
      };
    },
    {
      name: "houseVault";
      type: {
        kind: "struct";
        fields: [
          { name: "houseAuthority"; type: "pubkey" },
          { name: "locked"; type: "bool" },
          { name: "totalReserved"; type: "u64" },
          { name: "bump"; type: "u8" }
        ];
      };
    },
    {
      name: "sessionStatus";
      type: {
        kind: "enum";
        variants: [
          { name: "active" },
          { name: "lost" },
          { name: "cashedOut" }
        ];
      };
    }
  ];
};
