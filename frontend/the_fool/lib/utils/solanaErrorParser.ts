/**
 * Solana Error Parser
 * 
 * Extracts detailed information from Solana transaction errors
 * including amounts, addresses, and provides explorer links
 */

interface ParsedSolanaError {
  errorCode: string;
  errorMessage: string;
  detailedMessage: string;
  amounts?: {
    bet?: string;
    maxPayout?: string;
    vaultBalance?: string;
    vaultReserved?: string;
    vaultAvailable?: string;
    required?: string;
    shortage?: string;
    treasure?: string;
    profit?: string;
  };
  addresses?: {
    user?: string;
    vault?: string;
    session?: string;
  };
  explorerLinks?: {
    user?: string;
    vault?: string;
    session?: string;
  };
  actionableSteps?: string[];
}

const DEVNET_EXPLORER = 'https://explorer.solana.com/address';
const CLUSTER = '?cluster=devnet';

/**
 * Extracts lamports amounts from program logs
 */
function extractAmounts(logs: string[]): ParsedSolanaError['amounts'] {
  const amounts: ParsedSolanaError['amounts'] = {};
  
  for (const log of logs) {
    // Match patterns like "Bet=100000000 lamports (0 SOL)"
    const betMatch = log.match(/Bet[=:]?\s*(\d+)\s*lamports\s*\((\d+(?:\.\d+)?)\s*SOL\)/);
    if (betMatch) {
      amounts.bet = `${betMatch[2]} SOL (${betMatch[1]} lamports)`;
    }
    
    // Match "Max payout: 10000000000 lamports (10 SOL)"
    const maxPayoutMatch = log.match(/Max payout[=:]?\s*(\d+)\s*lamports\s*\((\d+(?:\.\d+)?)\s*SOL\)/);
    if (maxPayoutMatch) {
      amounts.maxPayout = `${maxPayoutMatch[2]} SOL (${maxPayoutMatch[1]} lamports)`;
    }
    
    // Match "Balance: 2001461600 lamports (2 SOL)"
    const balanceMatch = log.match(/Balance[=:]?\s*(\d+)\s*lamports\s*\((\d+(?:\.\d+)?)\s*SOL\)/);
    if (balanceMatch) {
      amounts.vaultBalance = `${balanceMatch[2]} SOL (${balanceMatch[1]} lamports)`;
    }
    
    // Match "Reserved: 0 lamports (0 SOL)"
    const reservedMatch = log.match(/Reserved[=:]?\s*(\d+)\s*lamports\s*\((\d+(?:\.\d+)?)\s*SOL\)/);
    if (reservedMatch) {
      amounts.vaultReserved = `${reservedMatch[2]} SOL (${reservedMatch[1]} lamports)`;
    }
    
    // Match "Available: 2001461600 lamports (2 SOL)"
    const availableMatch = log.match(/Available[=:]?\s*(\d+)\s*lamports\s*\((\d+(?:\.\d+)?)\s*SOL\)/);
    if (availableMatch) {
      amounts.vaultAvailable = `${availableMatch[2]} SOL (${availableMatch[1]} lamports)`;
    }
    
    // Match "Required: 10000000000 lamports (10 SOL)"
    const requiredMatch = log.match(/Required[=:]?\s*(\d+)\s*lamports\s*\((\d+(?:\.\d+)?)\s*SOL\)/);
    if (requiredMatch) {
      amounts.required = `${requiredMatch[2]} SOL (${requiredMatch[1]} lamports)`;
    }
    
    // Match "Need 7998538400 more lamports (7 SOL)"
    const shortageMatch = log.match(/Need\s+(\d+)\s+more lamports\s*\((\d+(?:\.\d+)?)\s*SOL\)/);
    if (shortageMatch) {
      amounts.shortage = `${shortageMatch[2]} SOL (${shortageMatch[1]} lamports)`;
    }
    
    // Match "Current treasure: 19000000 lamports (0 SOL)"
    const treasureMatch = log.match(/treasure[=:]?\s*(\d+)\s*lamports\s*\((\d+(?:\.\d+)?)\s*SOL\)/i);
    if (treasureMatch) {
      amounts.treasure = `${treasureMatch[2]} SOL (${treasureMatch[1]} lamports)`;
    }
    
    // Match "Profit: 9000000 lamports (0 SOL)"
    const profitMatch = log.match(/Profit[=:]?\s*(\d+)\s*lamports\s*\((\d+(?:\.\d+)?)\s*SOL\)/);
    if (profitMatch) {
      amounts.profit = `${profitMatch[2]} SOL (${profitMatch[1]} lamports)`;
    }
  }
  
  return Object.keys(amounts).length > 0 ? amounts : undefined;
}

/**
 * Extracts wallet/PDA addresses from program logs
 */
function extractAddresses(logs: string[]): ParsedSolanaError['addresses'] {
  const addresses: ParsedSolanaError['addresses'] = {};
  
  for (const log of logs) {
    // Match "User=EEgvD3jbhzPfjdrVHCGezYAq88ndXLEnLJW496zDtdPg"
    const userMatch = log.match(/User[=:]\s*([1-9A-HJ-NP-Za-km-z]{32,44})/);
    if (userMatch) {
      addresses.user = userMatch[1];
    }
    
    // Match "Vault PDA: EF6u3Zw2tv8w5ao6KeqpDbnFxzh2mt4DN6PLEzEnwVoV"
    const vaultMatch = log.match(/Vault(?:\s+PDA)?[=:]\s*([1-9A-HJ-NP-Za-km-z]{32,44})/);
    if (vaultMatch) {
      addresses.vault = vaultMatch[1];
    }
    
    // Match "Session=AbC123..."
    const sessionMatch = log.match(/Session[=:]\s*([1-9A-HJ-NP-Za-km-z]{32,44})/);
    if (sessionMatch) {
      addresses.session = sessionMatch[1];
    }
  }
  
  return Object.keys(addresses).length > 0 ? addresses : undefined;
}

/**
 * Generates explorer links for extracted addresses
 */
function generateExplorerLinks(addresses?: ParsedSolanaError['addresses']): ParsedSolanaError['explorerLinks'] {
  if (!addresses) return undefined;
  
  const links: ParsedSolanaError['explorerLinks'] = {};
  
  if (addresses.user) {
    links.user = `${DEVNET_EXPLORER}/${addresses.user}${CLUSTER}`;
  }
  if (addresses.vault) {
    links.vault = `${DEVNET_EXPLORER}/${addresses.vault}${CLUSTER}`;
  }
  if (addresses.session) {
    links.session = `${DEVNET_EXPLORER}/${addresses.session}${CLUSTER}`;
  }
  
  return Object.keys(links).length > 0 ? links : undefined;
}

/**
 * Generates actionable steps based on error type
 */
function getActionableSteps(errorCode: string, amounts?: ParsedSolanaError['amounts']): string[] {
  const steps: string[] = [];
  
  if (errorCode === 'InsufficientVaultBalance') {
    steps.push('The house vault does not have enough SOL to cover the maximum payout.');
    
    if (amounts?.shortage) {
      steps.push(`The vault needs ${amounts.shortage} more to accept this bet.`);
    }
    
    if (amounts?.vaultAvailable && amounts?.required) {
      steps.push(`Current available: ${amounts.vaultAvailable}`);
      steps.push(`Required for bet: ${amounts.required}`);
    }
    
    steps.push('Solutions:');
    steps.push('1. Try a smaller bet (reduces max payout requirement)');
    steps.push('2. Contact admin to fund the vault');
    steps.push('3. Wait for other players to lose (increases vault balance)');
  } else if (errorCode === 'InsufficientTreasure') {
    steps.push('Cannot cash out without profit.');
    
    if (amounts?.treasure && amounts?.bet) {
      steps.push(`Your treasure: ${amounts.treasure}`);
      steps.push(`Original bet: ${amounts?.bet}`);
    }
    
    steps.push('You must dive at least once and survive to have profit.');
  } else if (errorCode === 'InvalidBetAmount') {
    steps.push('Bet amount is outside allowed limits.');
    steps.push('Check the minimum and maximum bet amounts on the game screen.');
  } else if (errorCode === 'HouseLocked') {
    steps.push('The game is temporarily paused for maintenance.');
    steps.push('Please try again later or contact support.');
  }
  
  return steps;
}

/**
 * Parses Solana transaction error and extracts detailed information
 */
export function parseSolanaError(error: Error): ParsedSolanaError {
  const errorString = error.message || error.toString();
  
  // Extract error code (e.g., "InsufficientVaultBalance" from "Error Code: InsufficientVaultBalance")
  const errorCodeMatch = errorString.match(/Error Code:\s*(\w+)/);
  const errorCode = errorCodeMatch ? errorCodeMatch[1] : 'Unknown';
  
  // Extract error message
  const errorMessageMatch = errorString.match(/Error Message:\s*([^.]+)/);
  const errorMessage = errorMessageMatch ? errorMessageMatch[1].trim() : 'Transaction failed';
  
  // Extract program logs array
  const logsMatch = errorString.match(/Logs:\s*\[([\s\S]*?)\]/);
  const logs: string[] = [];
  
  if (logsMatch) {
    // Parse the logs array (it's a string representation of an array)
    const logsString = logsMatch[1];
    const logLines = logsString.split(',').map(line => 
      line.trim().replace(/^"|"$/g, '').replace(/\\"/g, '"')
    );
    logs.push(...logLines);
  }
  
  // Extract amounts and addresses from logs
  const amounts = extractAmounts(logs);
  const addresses = extractAddresses(logs);
  const explorerLinks = generateExplorerLinks(addresses);
  const actionableSteps = getActionableSteps(errorCode, amounts);
  
  // Build detailed message
  let detailedMessage = `${errorMessage}\n\n`;
  
  if (amounts) {
    detailedMessage += '💰 Transaction Details:\n';
    if (amounts.bet) detailedMessage += `  • Bet: ${amounts.bet}\n`;
    if (amounts.maxPayout) detailedMessage += `  • Max Payout: ${amounts.maxPayout}\n`;
    if (amounts.treasure) detailedMessage += `  • Current Treasure: ${amounts.treasure}\n`;
    if (amounts.profit) detailedMessage += `  • Profit: ${amounts.profit}\n`;
    detailedMessage += '\n';
  }
  
  if (amounts?.vaultBalance || amounts?.vaultReserved || amounts?.vaultAvailable) {
    detailedMessage += '🏦 Vault Status:\n';
    if (amounts.vaultBalance) detailedMessage += `  • Balance: ${amounts.vaultBalance}\n`;
    if (amounts.vaultReserved) detailedMessage += `  • Reserved: ${amounts.vaultReserved}\n`;
    if (amounts.vaultAvailable) detailedMessage += `  • Available: ${amounts.vaultAvailable}\n`;
    if (amounts.required) detailedMessage += `  • Required: ${amounts.required}\n`;
    if (amounts.shortage) detailedMessage += `  • Shortage: ${amounts.shortage}\n`;
    detailedMessage += '\n';
  }
  
  if (addresses) {
    detailedMessage += '🔗 Addresses:\n';
    if (addresses.user) detailedMessage += `  • User: ${addresses.user}\n`;
    if (addresses.vault) detailedMessage += `  • Vault: ${addresses.vault}\n`;
    if (addresses.session) detailedMessage += `  • Session: ${addresses.session}\n`;
    detailedMessage += '\n';
  }
  
  if (actionableSteps.length > 0) {
    detailedMessage += '📋 What to do:\n';
    actionableSteps.forEach(step => {
      detailedMessage += `  ${step}\n`;
    });
  }
  
  return {
    errorCode,
    errorMessage,
    detailedMessage: detailedMessage.trim(),
    amounts,
    addresses,
    explorerLinks,
    actionableSteps,
  };
}

/**
 * Formats parsed error for display to user
 */
export function formatSolanaErrorForUser(parsedError: ParsedSolanaError): string {
  let message = `❌ ${parsedError.errorMessage}\n\n`;
  
  if (parsedError.amounts) {
    if (parsedError.amounts.bet || parsedError.amounts.treasure) {
      message += '💰 Your Transaction:\n';
      if (parsedError.amounts.bet) message += `Bet: ${parsedError.amounts.bet}\n`;
      if (parsedError.amounts.treasure) message += `Treasure: ${parsedError.amounts.treasure}\n`;
      if (parsedError.amounts.profit) message += `Profit: ${parsedError.amounts.profit}\n`;
      message += '\n';
    }
    
    if (parsedError.amounts.vaultAvailable || parsedError.amounts.required) {
      message += '🏦 Vault:\n';
      if (parsedError.amounts.vaultAvailable) message += `Available: ${parsedError.amounts.vaultAvailable}\n`;
      if (parsedError.amounts.required) message += `Needed: ${parsedError.amounts.required}\n`;
      if (parsedError.amounts.shortage) message += `Short by: ${parsedError.amounts.shortage}\n`;
      message += '\n';
    }
  }
  
  if (parsedError.actionableSteps && parsedError.actionableSteps.length > 0) {
    message += parsedError.actionableSteps.slice(0, 4).join('\n');
  }
  
  return message.trim();
}
