# useWalletBoundReferralCode

This module handles wallet referral code binding functionality.

## Module Structure

```
useWalletBoundReferralCode/
├── index.ts                          # Unified exports
├── types.ts                          # Type definitions
├── useGetReferralCodeWalletInfo.ts   # Get wallet info hook
├── InviteCodeDialog.tsx              # UI component
└── useWalletBoundReferralCode.tsx    # Main hook
```

## Dependency Graph

```
                        index.ts
                           │
        ┌──────────────────┼──────────────────┐
        ▼                  ▼                  ▼
    types.ts    useGetReferralCode-    useWalletBound-
                WalletInfo.ts          ReferralCode.tsx
        │              │                      │
        │              │                      ▼
        │              │            InviteCodeDialog.tsx
        │              │                      │
        └──────────────┴──────────────────────┘
                       ▲
                  (referenced by)
```

## Module Descriptions

### types.ts

Defines `IReferralCodeWalletInfo` type:

| Field | Type | Description |
|-------|------|-------------|
| address | string | Wallet address |
| networkId | string | Network identifier |
| pubkey | string? | Public key (optional) |
| isBtcOnlyWallet | boolean | Whether it's a BTC-only wallet |
| accountId | string | Account identifier |
| walletId | string | Wallet identifier |
| wallet | IDBWallet | Wallet database object |

### useGetReferralCodeWalletInfo.ts

Hook to retrieve wallet information for referral code binding.

**Features:**
- Validates HD wallet or hardware wallet
- Excludes hidden wallets
- Returns first EVM account for regular wallets
- Returns first BTC Taproot account for BTC-only wallets

### InviteCodeDialog.tsx

UI component for the referral code binding dialog.

**Features:**
- Wallet selector dropdown
- Shows binding status for each wallet
- Referral code input with validation (alphanumeric, 1-30 chars)
- Disables already-bound wallets
- "Add Wallet" button when no wallets available

### useWalletBoundReferralCode.tsx

Main hook that orchestrates the referral code binding flow.

**Returns:**

| Method | Description |
|--------|-------------|
| `getReferralCodeBondStatus` | Check if wallet is already bound (with optional timeout) |
| `shouldBondReferralCode` | State indicating if binding is needed |
| `bindWalletInviteCode` | Open the binding dialog |
| `confirmBindReferralCode` | Execute the signing and binding process |

## Data Flow

```
1. getReferralCodeBondStatus()
   └── Check if wallet needs binding

2. bindWalletInviteCode()
   └── Open InviteCodeDialog

3. User selects wallet & enters code
   └── Form validation

4. confirmBindReferralCode()
   ├── Get unsigned message from server
   ├── Sign message (auto-sign for HD, manual for HW)
   └── Submit signed message to bind
```

## Usage

```tsx
const { bindWalletInviteCode, getReferralCodeBondStatus } = useWalletBoundReferralCode({
  entry: 'modal', // or 'tab'
});

// Check binding status
const shouldBind = await getReferralCodeBondStatus({ walletId });

// Open binding dialog
bindWalletInviteCode({
  wallet,
  defaultReferralCode: 'ABC123',
  onSuccess: () => console.log('Bound successfully'),
});
```
