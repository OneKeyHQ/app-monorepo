# useWalletBoundReferralCode

This module handles wallet referral code binding functionality.

## Module Structure

```
useWalletBoundReferralCode/
├── index.ts                              # Unified exports
├── types.ts                              # Type definitions
├── useGetReferralCodeWalletInfo.ts       # Get single wallet info hook
├── useFetchWalletsWithBoundStatus.ts     # Batch check all wallets bound status
├── referralBindStatusUtils.ts            # Bind status resolution helpers
├── InviteCodeDialog.tsx                  # UI component
└── useWalletBoundReferralCode.tsx        # Main hook
```

## Dependency Graph

```
                           index.ts
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
    types.ts    useGetReferralCode-    useWalletBound-
                WalletInfo.ts          ReferralCode.tsx
        │              │                      │
        │              ▼                      ▼
        │    useFetchWalletsWithBound-  InviteCodeDialog.tsx
        │    Status.ts                        │
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

### useFetchWalletsWithBoundStatus.ts

Hook to batch check all wallets' referral code binding status.

**Features:**
- Fetches all valid wallets (HD and hardware wallets)
- Uses V2 batch API `batchCheckWalletsBoundReferralCodeV2` to check bound status, bindability, and bind-window reason
- Falls back to V1 batch API `batchCheckWalletsBoundReferralCode` when V2 is unavailable
- Preserves cached `bindable` state during V1 fallback because V1 does not return bind-window status
- Keeps local cache unchanged and skips database writes when both batch APIs fail
- Updates local database only when a server status refresh succeeds
- Returns loading state and wallet list with binding status

**Returns:**

| Field | Type | Description |
|-------|------|-------------|
| walletsWithStatus | Array | List of wallets with `{ wallet, isBound, bindable, reason }` |
| isLoading | boolean | Whether the data is being fetched |

**Usage:**

```tsx
const { walletsWithStatus, isLoading } = useFetchWalletsWithBoundStatus();
```

### InviteCodeDialog.tsx

UI component for the referral code binding dialog.

**Features:**
- Wallet selector dropdown with loading state
- Uses `useFetchWalletsWithBoundStatus` to batch check binding status
- Shows binding status for each wallet
- Referral code input with validation (alphanumeric, 1-30 chars)
- Disables already-bound wallets
- "Add Wallet" button when no wallets available

### useWalletBoundReferralCode.tsx

Main hook that orchestrates the referral code binding flow.

**Status cache rules:**
- `isBound: true` is treated as a stable local result.
- `bindable: false` is treated as a stable local bind-window result.
- `bindable: true` and legacy rows with `bindable: undefined` must be revalidated with `checkWalletBindStatus` before showing a bind entry.
- If revalidation fails, cached positive or unknown bindability is not enough to show the bind entry.
- Fresh server status remains authoritative and is persisted back to SimpleDB when available.

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
