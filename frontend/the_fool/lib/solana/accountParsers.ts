/**
 * Anchor Account Parsers using Borsh Coder
 *
 * This implementation uses Anchor's BorshCoder directly to decode accounts
 * without needing a full Program instance.
 */

import { BorshCoder, Idl } from "@coral-xyz/anchor";
import IDL_JSON from "./idl/dive_game.json";
import type {
  HouseVaultAccount,
  GameConfigAccount,
  GameSessionAccount,
} from "./types";
import { logger } from "../logger";

// Singleton coder instance for decoding
let cachedCoder: BorshCoder | null = null;

function getCoder(): BorshCoder {
  if (!cachedCoder) {
    logger.accountParser.debug("Creating BorshCoder from IDL");
    cachedCoder = new BorshCoder(IDL_JSON as Idl);
  }
  return cachedCoder;
}

/**
 * Parse HouseVault account using Borsh coder
 */
export function parseHouseVaultData(
  dataInput: Uint8Array | Buffer
): HouseVaultAccount {
  try {
    const coder = getCoder();
    const data = Buffer.from(dataInput);

    logger.accountParser.debug(
      `Decoding HouseVault, data length: ${data.length}`
    );
    logger.accountParser.debug(
      `First 16 bytes (hex): ${data.slice(0, 16).toString("hex")}`
    );

    // Use Borsh coder to decode - it handles the discriminator automatically
    const decoded = coder.accounts.decode("houseVault", data);
    logger.accountParser.debug("HouseVault decoded successfully!");

    return decoded as HouseVaultAccount;
  } catch (error: any) {
    logger.accountParser.error("Error decoding HouseVault:", error);
    logger.accountParser.error(`Error message: ${error.message}`);
    throw error;
  }
}

/**
 * Parse GameConfig account using Borsh coder
 */
export function parseGameConfigData(
  dataInput: Uint8Array | Buffer
): GameConfigAccount {
  try {
    const coder = getCoder();
    const data = Buffer.from(dataInput);

    logger.accountParser.debug(
      `Decoding GameConfig, data length: ${data.length}`
    );

    // Use Borsh coder to decode
    const decoded = coder.accounts.decode("gameConfig", data);
    logger.accountParser.debug("GameConfig decoded successfully:", decoded);
    return decoded as GameConfigAccount;
  } catch (error) {
    logger.accountParser.error("Error decoding GameConfig:", error);
    throw error;
  }
}

/**
 * Parse GameSession account using Borsh coder
 */
export function parseGameSessionData(
  dataInput: Uint8Array | Buffer
): GameSessionAccount {
  try {
    const coder = getCoder();
    const data = Buffer.from(dataInput);

    logger.accountParser.debug(
      `Decoding GameSession, data length: ${data.length}`
    );

    // Use Borsh coder to decode
    const decoded = coder.accounts.decode("gameSession", data);
    logger.accountParser.debug("GameSession decoded successfully!");

    return decoded as GameSessionAccount;
  } catch (error: any) {
    logger.accountParser.error("Error decoding GameSession:", error);
    throw error;
  }
}

// Legacy alias
export const parseSessionData = parseGameSessionData;
