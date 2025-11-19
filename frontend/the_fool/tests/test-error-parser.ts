/**
 * Test script to verify error parser works with mock Solana errors
 * Run with: npx tsx tests/test-error-parser.ts
 */

import { parseSolanaError, formatSolanaErrorForUser } from '../lib/utils/solanaErrorParser';

// Mock error 1: INSUFFICIENT_VAULT from real Solana transaction
const mockInsufficientVaultError = {
  message: `Transaction simulation failed: Error processing Instruction 0: custom program error: 0x1775
Logs:
[
  "Program CBdZ8FbqsgSSiKunsJgr8vogMD4pKqkoXzzi9ZB4URz1 invoke [1]",
  "Program log: Instruction: StartSession",
  "Program log: INSUFFICIENT_VAULT need=10 have=2 vault=EF6u3Zw2tv8w5ao6KeqpDbnFxzh2mt4DN6PLEzEnwVoV",
  "Program CBdZ8FbqsgSSiKunsJgr8vogMD4pKqkoXzzi9ZB4URz1 consumed 12345 of 200000 compute units",
  "Program CBdZ8FbqsgSSiKunsJgr8vogMD4pKqkoXzzi9ZB4URz1 failed: custom program error: 0x1775"
]`,
  err: {
    InstructionError: [0, { Custom: 6005 }]
  }
};

// Mock error 2: INSUFFICIENT_TREASURE
const mockInsufficientTreasureError = {
  message: `Transaction simulation failed: Error processing Instruction 0: custom program error: 0x1776
Logs:
[
  "Program CBdZ8FbqsgSSiKunsJgr8vogMD4pKqkoXzzi9ZB4URz1 invoke [1]",
  "Program log: Instruction: CashOut",
  "Program log: INSUFFICIENT_TREASURE treasure=0 bet=1 session=AbC123def456ghi789jkl012mno345pqr",
  "Program CBdZ8FbqsgSSiKunsJgr8vogMD4pKqkoXzzi9ZB4URz1 consumed 12345 of 200000 compute units",
  "Program CBdZ8FbqsgSSiKunsJgr8vogMD4pKqkoXzzi9ZB4URz1 failed: custom program error: 0x1776"
]`,
  err: {
    InstructionError: [0, { Custom: 6006 }]
  }
};

console.log('='.repeat(80));
console.log('TEST 1: INSUFFICIENT_VAULT ERROR');
console.log('='.repeat(80));

const parsed1 = parseSolanaError(mockInsufficientVaultError);
console.log('\nParsed Error:');
console.log(JSON.stringify(parsed1, null, 2));

console.log('\nUser-Friendly Message:');
console.log(formatSolanaErrorForUser(parsed1));

console.log('\n' + '='.repeat(80));
console.log('TEST 2: INSUFFICIENT_TREASURE ERROR');
console.log('='.repeat(80));

const parsed2 = parseSolanaError(mockInsufficientTreasureError);
console.log('\nParsed Error:');
console.log(JSON.stringify(parsed2, null, 2));

console.log('\nUser-Friendly Message:');
console.log(formatSolanaErrorForUser(parsed2));

console.log('\n' + '='.repeat(80));
console.log('VERIFICATION');
console.log('='.repeat(80));

// Verify parsing worked
const checks = [
  { name: 'Error code extracted', pass: parsed1.errorCode === 'InsufficientVaultBalance' },
  { name: 'Error code number extracted', pass: parsed1.errorCodeNumber === 6005 },
  { name: 'Amounts extracted', pass: parsed1.amounts !== undefined },
  { name: 'Need amount correct', pass: parsed1.amounts?.need === '10 SOL' },
  { name: 'Have amount correct', pass: parsed1.amounts?.have === '2 SOL' },
  { name: 'Shortage calculated', pass: parsed1.amounts?.shortage === '8.00 SOL' },
  { name: 'Vault address extracted', pass: parsed1.addresses?.vault === 'EF6u3Zw2tv8w5ao6KeqpDbnFxzh2mt4DN6PLEzEnwVoV' },
  { name: 'Explorer link generated', pass: parsed1.explorerLinks?.vault?.includes('EF6u3Zw2tv8w5ao6KeqpDbnFxzh2mt4DN6PLEzEnwVoV') },
  { name: 'Treasure error code', pass: parsed2.errorCode === 'InsufficientTreasure' },
  { name: 'Treasure amounts', pass: parsed2.amounts?.treasure === '0 SOL' && parsed2.amounts?.bet === '1 SOL' },
];

console.log('');
checks.forEach(check => {
  const icon = check.pass ? '✓' : '✗';
  console.log(`${icon} ${check.name}`);
});

const allPassed = checks.every(c => c.pass);
console.log('\n' + (allPassed ? 'ALL TESTS PASSED!' : 'SOME TESTS FAILED!'));
process.exit(allPassed ? 0 : 1);
