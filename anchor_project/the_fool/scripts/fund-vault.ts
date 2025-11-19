import { Connection, PublicKey, SystemProgram, Transaction, sendAndConfirmTransaction, Keypair, LAMPORTS_PER_SOL } from '@solana/web3.js';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

async function main() {
  const amountSol = parseFloat(process.argv[2] || '50');
  
  console.log('Vault: Funding House Vault');
  console.log('======================\n');

  // Config
  const RPC_URL = 'https://api.devnet.solana.com';
  const PROGRAM_ID = 'CBdZ8FbqsgSSiKunsJgr8vogMD4pKqkoXzzi9ZB4URz1';
  const HOUSE_AUTHORITY = '7qdd7r1CJdnXVcr3bFD5CyBRyDF9eW4taoJqABhN5hXW';

  console.log(`Amount: ${amountSol} SOL\n`);

  // Connect
  const connection = new Connection(RPC_URL, 'confirmed');

  // Load keypair
  const keypairPath = path.join(os.homedir(), '.config/solana/id.json');
  const keypairData = JSON.parse(fs.readFileSync(keypairPath, 'utf-8'));
  const houseAuthKeypair = Keypair.fromSecretKey(new Uint8Array(keypairData));

  console.log('House Authority:', houseAuthKeypair.publicKey.toBase58());

  // Derive vault PDA
  const programId = new PublicKey(PROGRAM_ID);
  const houseAuthPubkey = new PublicKey(HOUSE_AUTHORITY);

  const [vaultPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('house_vault'), houseAuthPubkey.toBuffer()],
    programId
  );

  console.log('Vault PDA:', vaultPda.toBase58(), '\n');

  // Check balances
  const houseBalance = await connection.getBalance(houseAuthKeypair.publicKey);
  const vaultBalance = await connection.getBalance(vaultPda);

  console.log('Current Balances:');
  console.log(`  House: ${(houseBalance / LAMPORTS_PER_SOL).toFixed(4)} SOL`);
  console.log(`  Vault: ${(vaultBalance / LAMPORTS_PER_SOL).toFixed(4)} SOL\n`);

  // Transfer
  const lamports = amountSol * LAMPORTS_PER_SOL;
  
  const tx = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: houseAuthKeypair.publicKey,
      toPubkey: vaultPda,
      lamports,
    })
  );

  console.log('Sending transaction...');
  const sig = await sendAndConfirmTransaction(connection, tx, [houseAuthKeypair]);
  
  console.log(`OK: Success: ${sig}\n`);

  // New balances
  const newVaultBalance = await connection.getBalance(vaultPda);
  console.log(`New Vault Balance: ${(newVaultBalance / LAMPORTS_PER_SOL).toFixed(4)} SOL`);
  console.log(`\nhttps://explorer.solana.com/tx/${sig}?cluster=devnet`);
}

main().catch(console.error);
