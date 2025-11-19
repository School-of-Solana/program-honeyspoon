/**
 * Error Parser Demo Test
 * 
 * This test demonstrates the error parser with mock data
 * to show how it extracts structured information from transaction logs.
 */

import { expect } from "chai";
import {
  GameErrorCode,
  parseTransactionError,
  formatErrorForConsole,
  hasError,
} from "./errorParser";

describe("Error Parser Demo (with mock data)", () => {
  it("should parse InsufficientVaultBalance error from mock logs", () => {
    // Mock a transaction result with our improved error format
    const mockResult = {
      constructor: { name: "FailedTransactionMetadata" },
      err: {
        InstructionError: [
          0,
          { Custom: 6005 } // InsufficientVaultBalance
        ]
      },
      logs: [
        "Program CBdZ8FbqsgSSiKunsJgr8vogMD4pKqkoXzzi9ZB4URz1 invoke [1]",
        "Program log: Instruction: StartSession",
        "Program log: INSUFFICIENT_VAULT need=100 have=2 vault=EF6u3Zw2tv8w5ao6KeqpDbnFxzh2mt4DN6PLEzEnwVoV",
        "Program CBdZ8FbqsgSSiKunsJgr8vogMD4pKqkoXzzi9ZB4URz1 consumed 12345 of 200000 compute units",
        "Program CBdZ8FbqsgSSiKunsJgr8vogMD4pKqkoXzzi9ZB4URz1 failed: custom program error: 0x1775"
      ]
    };

    // Parse the error
    const parsed = parseTransactionError(mockResult);

    console.log("\nParsed Error:");
    console.log(formatErrorForConsole(parsed!));

    // Verify parsing worked
    expect(parsed).to.exist;
    expect(parsed!.errorCode).to.equal("InsufficientVaultBalance");
    expect(parsed!.errorCodeNumber).to.equal(6005);
    
    // Check amounts were extracted
    expect(parsed!.amounts).to.exist;
    expect(parsed!.amounts!.need).to.equal("100 SOL");
    expect(parsed!.amounts!.have).to.equal("2 SOL");
    expect(parsed!.amounts!.shortage).to.equal("98.00 SOL");

    // Check address was extracted
    expect(parsed!.addresses).to.exist;
    expect(parsed!.addresses!.vault).to.equal("EF6u3Zw2tv8w5ao6KeqpDbnFxzh2mt4DN6PLEzEnwVoV");

    // Check error code helper
    expect(hasError(mockResult, GameErrorCode.InsufficientVaultBalance)).to.be.true;
    expect(hasError(mockResult, GameErrorCode.InsufficientTreasure)).to.be.false;
  });

  it("should parse InsufficientTreasure error from mock logs", () => {
    const mockResult = {
      constructor: { name: "FailedTransactionMetadata" },
      err: {
        InstructionError: [
          0,
          { Custom: 6007 } // InsufficientTreasure
        ]
      },
      logs: [
        "Program CBdZ8FbqsgSSiKunsJgr8vogMD4pKqkoXzzi9ZB4URz1 invoke [1]",
        "Program log: Instruction: CashOut",
        "Program log: INSUFFICIENT_TREASURE treasure=1 bet=1 session=AbC123xyz456DEF789GHI012JKL345MNO678",
        "Program CBdZ8FbqsgSSiKunsJgr8vogMD4pKqkoXzzi9ZB4URz1 failed: custom program error: 0x1777"
      ]
    };

    const parsed = parseTransactionError(mockResult);

    console.log("\nInfo: Parsed Error:");
    console.log(formatErrorForConsole(parsed!));

    expect(parsed).to.exist;
    expect(parsed!.errorCode).to.equal("InsufficientTreasure");
    expect(parsed!.errorCodeNumber).to.equal(6007);
    
    // Check amounts
    expect(parsed!.amounts!.treasure).to.equal("1 SOL");
    expect(parsed!.amounts!.bet).to.equal("1 SOL");

    // Check address (if extracted)
    if (parsed!.addresses?.session) {
      expect(parsed!.addresses.session).to.equal("AbC123xyz456DEF789GHI012JKL345MNO678");
    }

    expect(hasError(mockResult, GameErrorCode.InsufficientTreasure)).to.be.true;
  });

  it("should parse VAULT_UNDERFUNDED error from mock logs", () => {
    const mockResult = {
      constructor: { name: "FailedTransactionMetadata" },
      err: {
        InstructionError: [
          0,
          { Custom: 6005 } // InsufficientVaultBalance (used for underfunded too)
        ]
      },
      logs: [
        "Program CBdZ8FbqsgSSiKunsJgr8vogMD4pKqkoXzzi9ZB4URz1 invoke [1]",
        "Program log: Instruction: CashOut",
        "Program log: VAULT_UNDERFUNDED need=50 have=30 vault=VaultPDA1234567890abcdefghijklmnopqrstuv",
        "Program CBdZ8FbqsgSSiKunsJgr8vogMD4pKqkoXzzi9ZB4URz1 failed: custom program error: 0x1775"
      ]
    };

    const parsed = parseTransactionError(mockResult);

    console.log("\nInfo: Parsed Error:");
    console.log(formatErrorForConsole(parsed!));

    expect(parsed).to.exist;
    expect(parsed!.amounts!.need).to.equal("50 SOL");
    expect(parsed!.amounts!.have).to.equal("30 SOL");
    expect(parsed!.amounts!.shortage).to.equal("20.00 SOL");
    
    // Check address (if extracted)
    if (parsed!.addresses?.vault) {
      expect(parsed!.addresses.vault).to.equal("VaultPDA1234567890abcdefghijklmnopqrstuv");
    }
  });

  it("should handle errors without detailed logs gracefully", () => {
    const mockResult = {
      constructor: { name: "FailedTransactionMetadata" },
      err: {
        InstructionError: [
          0,
          { Custom: 6000 } // HouseLocked
        ]
      },
      logs: [
        "Program CBdZ8FbqsgSSiKunsJgr8vogMD4pKqkoXzzi9ZB4URz1 invoke [1]",
        "Program CBdZ8FbqsgSSiKunsJgr8vogMD4pKqkoXzzi9ZB4URz1 failed: custom program error: 0x1770"
      ]
    };

    const parsed = parseTransactionError(mockResult);

    expect(parsed).to.exist;
    expect(parsed!.errorCode).to.equal("HouseLocked");
    expect(parsed!.errorCodeNumber).to.equal(6000);
    expect(parsed!.errorMessage).to.equal("House vault is locked");
    
    // No amounts or addresses expected for this error
    expect(parsed!.amounts).to.be.undefined;
    expect(parsed!.addresses).to.be.undefined;
  });

  it("should demonstrate the improvement over generic errors", () => {
    console.log("\n" + "=".repeat(60));
    console.log("BEFORE: Generic Error (what users saw before)");
    console.log("=".repeat(60));
    console.log("Error: custom program error: 0x1775");
    console.log("ERROR: No context, no amounts, no addresses");

    console.log("\n" + "=".repeat(60));
    console.log("AFTER: Parsed Error (what users see now)");
    console.log("=".repeat(60));

    const mockResult = {
      constructor: { name: "FailedTransactionMetadata" },
      err: { InstructionError: [0, { Custom: 6005 }] },
      logs: [
        "Program log: INSUFFICIENT_VAULT need=100 have=2 vault=EF6u3Zw2tv8w5ao6KeqpDbnFxzh2mt4DN6PLEzEnwVoV"
      ]
    };

    const parsed = parseTransactionError(mockResult);
    console.log(formatErrorForConsole(parsed!));

    console.log("\nBenefits:");
    console.log("   - Clear error name");
    console.log("   - Amounts in SOL");
    console.log("   - Shortage calculation");
    console.log("   - Vault address for debugging");
    console.log("   - Ready for Solana Explorer");
    console.log("=".repeat(60) + "\n");

    expect(parsed).to.exist;
  });
});
