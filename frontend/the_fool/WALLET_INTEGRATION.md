# 🔐 Wallet Integration Guide

## Overview

The app includes comprehensive Solana wallet integration with support for multiple wallets and a beautiful dropdown UI.

## Supported Wallets

✅ **Available Wallets:**
- **Phantom** (most popular - recommended)
- **Solflare** (popular alternative)
- **Trust Wallet** (mobile-friendly)
- **Coinbase Wallet** (mainstream)
- **Coin98** (multi-chain)
- **Nightly** (developer-focused)
- **Ledger** (hardware wallet)
- **Torus** (social login)

All wallets are auto-detected when installed.

---

## Quick Start

### 1. Import the Component

```tsx
import { WalletMultiButton } from '@/components/WalletMultiButton';

// Or use the simple version
import { WalletButton } from '@/components/WalletButton';
```

### 2. Add to Your Page

```tsx
export default function Home() {
  return (
    <div>
      <header className="flex justify-between p-4">
        <h1>Deep Sea Diver</h1>
        <WalletMultiButton />
      </header>
      {/* Rest of your app */}
    </div>
  );
}
```

### 3. Access Wallet Data

```tsx
import { useGameChain } from '@/lib/hooks/useGameChain';

function GameComponent() {
  const { connected, publicKey, wallet } = useGameChain();
  
  if (!connected) {
    return <div>Please connect your wallet</div>;
  }
  
  const walletName = wallet.wallet?.adapter?.name; // "Phantom"
  const address = publicKey?.toBase58(); // "5Qs4Rp..."
  
  return <div>Connected with {walletName}</div>;
}
```

---

## Components

### WalletMultiButton (Recommended)

Full-featured wallet button with dropdown selector.

**Features:**
- Shows all installed wallets
- Displays wallet name and icon
- Address display with copy button
- Change wallet option
- Disconnect button
- Links to install non-installed wallets

**When Connected:**
```
┌──────────────────────────────────┐
│ 👻 Phantom │ 5Qs4...pump ▼      │
└──────────────────────────────────┘
```

**Dropdown:**
```
┌──────────────────────────────────┐
│ Your Address                      │
│ 5Qs4Rpx2X8r9sH7K... [📋 Copy]   │
├──────────────────────────────────┤
│ Change Wallet                     │
│ 👻 Phantom              ●        │
│ ☀️  Solflare                      │
│ 🦊 Trust Wallet                   │
├──────────────────────────────────┤
│ Install Wallet                    │
│ 💰 Coinbase Wallet     ↗         │
├──────────────────────────────────┤
│ [Disconnect]                      │
└──────────────────────────────────┘
```

### WalletButton (Simple)

Cleaner layout with separate buttons.

```tsx
<WalletButton />
```

**When Connected:**
```
┌─────────────────┬──────────┬─────────────┐
│ 👻 Phantom      │ [Change] │ [Disconnect]│
│ 5Qs4...pump     │          │             │
└─────────────────┴──────────┴─────────────┘
```

### WalletMultiButtonCompact

Minimal version for mobile.

```tsx
<WalletMultiButtonCompact />
```

---

## Usage Examples

### Check if Wallet Connected

```tsx
import { useGameChain } from '@/lib/hooks/useGameChain';

function MyComponent() {
  const { connected, publicKey } = useGameChain();
  
  if (!connected || !publicKey) {
    return <div>Connect wallet to continue</div>;
  }
  
  return <div>Welcome! {publicKey.toBase58()}</div>;
}
```

### Start Game Transaction

```tsx
import { useGameChain } from '@/lib/hooks/useGameChain';

function StartGameButton() {
  const { chain, connected, publicKey } = useGameChain();
  const [loading, setLoading] = useState(false);
  
  async function handleStartGame() {
    if (!connected || !publicKey) {
      alert('Please connect your wallet');
      return;
    }
    
    setLoading(true);
    try {
      const result = await chain.startSession({
        userPubkey: publicKey.toBase58(),
        betAmountLamports: BigInt(0.1 * 1e9), // 0.1 SOL
        maxPayoutLamports: BigInt(10 * 1e9),  // 10 SOL max
        houseVaultPda: process.env.NEXT_PUBLIC_VAULT_PDA!,
      });
      
      console.log('Game started!', result);
    } catch (error) {
      console.error('Failed to start game:', error);
      alert('Transaction failed');
    } finally {
      setLoading(false);
    }
  }
  
  return (
    <button 
      onClick={handleStartGame}
      disabled={!connected || loading}
    >
      {loading ? 'Starting...' : 'Start Game'}
    </button>
  );
}
```

### Copy Address to Clipboard

```tsx
async function handleCopyAddress() {
  if (publicKey) {
    await navigator.clipboard.writeText(publicKey.toBase58());
    toast.success('Address copied!');
  }
}
```

### Show User Balance

```tsx
import { useUserBalance } from '@/lib/hooks/useGameChain';

function WalletBalance() {
  const { balance, loading } = useUserBalance();
  
  if (loading) return <div>Loading...</div>;
  
  return (
    <div>
      Balance: {(Number(balance) / 1e9).toFixed(2)} SOL
    </div>
  );
}
```

---

## Wallet Setup (For Users)

### Install Phantom (Recommended)

1. Visit https://phantom.app/
2. Install browser extension
3. Create new wallet or import existing
4. **Save recovery phrase securely!**

### Switch to Localnet (Development)

1. Open Phantom
2. Settings → Change Network
3. Select "Custom RPC"
4. Enter:
   - **RPC URL:** `http://localhost:8899`
   - **Network Name:** Localnet
5. Save

### Get Test SOL

```bash
# Get your address from Phantom (click to copy)
# Then run:
solana airdrop 10 <YOUR_ADDRESS> --url localhost

# Or use npm script (airdrops to default keypair):
npm run airdrop
```

### Connect in App

1. Click "Connect Wallet" button
2. Select Phantom from list
3. Click "Connect"
4. Approve connection in Phantom
5. You're connected! 🎉

---

## API Reference

### useGameChain()

```tsx
const {
  chain,        // GameChainPort instance
  wallet,       // Wallet adapter
  connected,    // boolean
  publicKey,    // PublicKey | null
  connecting,   // boolean
  disconnecting // boolean
} = useGameChain();
```

### useWallet()

```tsx
const {
  publicKey,     // PublicKey | null
  wallet,        // Wallet | null
  wallets,       // Wallet[]
  select,        // (name: string) => void
  connect,       // () => Promise<void>
  disconnect,    // () => Promise<void>
  connecting,    // boolean
  disconnecting, // boolean
  connected      // boolean
} = useWallet();
```

### Wallet Properties

```tsx
wallet.adapter.name    // "Phantom"
wallet.adapter.icon    // URL to icon
wallet.adapter.url     // Installation URL
wallet.readyState      // "Installed" | "NotDetected" | "Loadable"
```

---

## Styling

Components use Tailwind CSS with dark theme:

**Colors:**
- Primary: `bg-blue-600` `hover:bg-blue-700`
- Background: `bg-gray-800` `border-gray-700`
- Success: `text-green-500`
- Danger: `bg-red-600` `hover:bg-red-700`

**Customize:**

```tsx
<WalletMultiButton className="my-custom-class" />
```

Or edit the component files directly for global changes.

---

## Troubleshooting

### "No wallets detected"

**Solution:** Install Phantom or another supported wallet
- Phantom: https://phantom.app/
- Solflare: https://solflare.com/
- Trust: https://trustwallet.com/

### "Connection failed"

1. Check wallet is on correct network (Localnet for development)
2. Refresh page and try again
3. Check browser console for errors
4. Try different wallet

### "Transaction failed"

1. Check balance: `npm run balance`
2. Airdrop SOL: `npm run airdrop`
3. Verify localnet is running
4. Check wallet approves transactions

### Wallet shows wrong network

1. Open wallet settings
2. Change to Localnet
3. RPC URL: `http://localhost:8899`
4. Reconnect

---

## Best Practices

### 1. Always Check Connection

```tsx
if (!connected || !publicKey) {
  return <ConnectWalletPrompt />;
}
```

### 2. Handle Errors

```tsx
try {
  await transaction();
} catch (error) {
  if (error.code === 'USER_REJECTED') {
    toast.info('Transaction cancelled');
  } else {
    toast.error('Transaction failed');
  }
}
```

### 3. Show Loading States

```tsx
{loading && (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center">
    <div className="bg-white p-6 rounded">
      <span className="animate-spin">⏳</span>
      <p>Processing transaction...</p>
    </div>
  </div>
)}
```

### 4. Provide Feedback

```tsx
const [copied, setCopied] = useState(false);

async function copyAddress() {
  await navigator.clipboard.writeText(address);
  setCopied(true);
  setTimeout(() => setCopied(false), 2000);
}

<button onClick={copyAddress}>
  {copied ? '✓ Copied!' : '📋 Copy'}
</button>
```

---

## Advanced

### Get Transaction History

```tsx
import { useConnection } from '@solana/wallet-adapter-react';

const { connection } = useConnection();
const { publicKey } = useWallet();

async function getHistory() {
  if (publicKey) {
    const sigs = await connection.getSignaturesForAddress(publicKey);
    return sigs;
  }
}
```

### Sign Message

```tsx
const { signMessage } = useWallet();

async function signMyMessage() {
  const message = new TextEncoder().encode('Hello Solana!');
  const signature = await signMessage(message);
  return signature;
}
```

---

## Resources

- **Wallet Adapter:** https://github.com/solana-labs/wallet-adapter
- **Phantom Docs:** https://docs.phantom.app/
- **Solflare Docs:** https://docs.solflare.com/
- **Solana Docs:** https://docs.solana.com/

---

**Created:** 2025-11-17  
**Status:** ✅ Complete and tested  
**Components:** 3 wallet components + provider ready to use
