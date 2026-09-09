# Pro 2 Portfolio current implementation

## 1. Scope

This document describes the current data contract and sync flow between OneKey App, the Portfolio packing service, and Pro 2 firmware. It covers:

- How the App builds Portfolio display data
- The JSON interface between the App and the packing service
- Hardware upload after the service signs the package
- Amount strings, Unicode, font coverage, and UTF-8 byte limits
- Content dedup, cooldown, hardware-busy handling, and failure handling

It is based on:

- `portfolioPayload.ts` and the Hardware Portfolio Sync service on the current App branch
- The display-string protocol on the remote `firmware-pro2` `dev` branch
- The current `@onekeyfe/hd-core` `uploadPortfolio()` implementation

The packing-service source is not in this repository. Service behavior described here is the interface contract that App and firmware rely on, not an audit of the service internals.

## 2. Core contract

Portfolio amounts follow an "App formats, firmware renders as-is" protocol:

- The App chooses tokens, order, amount format, fiat prefix, canonical names, and allocation percentages
- The service validates the payload, fills trusted token metadata, then builds and signs the Portfolio package
- Firmware treats amounts and balances as length-limited UTF-8 display strings
- Firmware does not parse amounts, add currency symbols, reformat values, or sort by amount
- Firmware draws the ring chart and progress bar from the independent `portfolioPercentage` field

These display strings are all valid:

```text
$27,112.11
< $0.01
0.0₅41
EUR 1.00
```

`0.0₅41` is the App's leading-zero subscript compression, not scientific notation such as `4.1e-6`.

## 3. Runtime

Portfolio build, server submit, and hardware upload run in `kit-bg`.

### 3.1 iOS, Android, and browser extension

- Runtime: `bg`
- `main` and `bg` are isolated JS runtimes; do not assume shared objects or init order
- Home state enters the background service, then build and upload happen in `bg`
- Hardware SDK calls are owned by the background Hardware service

### 3.2 Desktop and Web

- App code runs in a single JS runtime
- Portfolio still goes through the background service interface so the call model stays the same across platforms

## 4. Sync triggers

Home `TokenListBlock` is the only producer. There are two modes:

### 4.1 Silent All Networks USB / WebUSB

After an All Networks token list settles, Home calls `notifyAllNetworksTokenListSettled()`, which runs `syncPortfolio({ syncMode: 'silent' })`.

Silent transfer happens only when all of these hold:

- The current Home wallet is a Protocol V2 hardware wallet
- The wallet is selected and the device is connected
- The active transport is USB / WebUSB
- Content is not a silent duplicate of the last successful upload
- The hardware channel is free
- The 60-second USB cooldown has elapsed

Silent BLE (mobile BLE and desktop WebBLE) does not transfer. It keeps the latest pending snapshot and waits for USB or an explicit tap.

Automatic single-network token polling does not talk to the device.

Silent upload does not use `withHardwareProcessing`, does not drive the Home Sync button into `loading`, and calls `uploadPortfolio` without `uiMode` (SDK default `silent`: no `DEVICE_PROGRESS`, `protocolV2UiMode: 'none'`).

### 4.2 Explicit Sync Portfolio

The Home Sync action creates a `portfolioSyncRequest` and refreshes the token list. When the snapshot is ready, Home calls `syncPortfolio({ syncMode: 'interactive' })`.

Interactive sync:

- Runs through the standard hardware processing UI
- Passes `uiMode: 'progress'` so the SDK can emit transfer progress
- Ignores the 60-second cooldown and the silent BLE skip
- Completes the Home button on success, or shows a toast on identity mismatch / unapplied upload

Empty incomplete All Networks snapshots are deferred so default native tokens are not uploaded too early. After all network requests finish, the current snapshot is used even if some accounts never returned.

### 4.3 Shared upload pipeline

Both modes then:

1. Authorize the payload against the wallet device
2. Build Portfolio JSON from the current account, tokens, fiat, and rates
3. Hash content with `ts` excluded
4. Submit JSON to the packing service
5. Hand the signed Base64 package to the Hardware SDK
6. Write `vol1:/portfolio/portfolio.okpkg.pending`, then send `PortfolioUpdate`
7. Record success only when the device returns `Success`

Dedup and cooldown state are keyed by the physical device (`deviceDbId`), not by transport alias. Software wallets and unauthorized device identifiers never build or submit a package.

USB silent cooldown is 60 seconds from `max(lastAttemptAt, lastTransferAt)`. Desktop BLE idle uses a 5-minute cooldown. Interactive sync does not wait for cooldown. While USB silent is in cooldown, the latest snapshot is scheduled for the remaining window rather than dropped.

## 5. App payload shape

The App root object always has these 7 fields:

```ts
type IPortfolioPayload = {
  v: 1;
  ts: number;
  account: {
    label: string;
    addressMasked: string;
  };
  totalFiat: string;
  tokenCount: number;
  tokens: IPortfolioPayloadToken[];
  otherTokens: {
    count: number;
    fiat: string;
    portfolioPercentage: number;
  };
};
```

Each App-side token contains:

```ts
type IPortfolioPayloadToken = {
  symbol: string;
  name: string;
  contractAddress: string;
  iconName: string | null;
  isAllNetworks: boolean;
  isNative: boolean;
  balance: string;
  fiatValue: string;
  portfolioPercentage: number;
  networkId: string;
};
```

Before server submit, every `iconName` is set to `null`. The service must emit the final `iconName` from a trusted allowlist and fill the `color` that firmware requires.

## 6. Root field rules

| Field | App rule |
| --- | --- |
| `v` | Always integer `1` |
| `ts` | Millisecond timestamp; App pre-adjusts it for current-timezone display |
| `account.label` | Indexed-account name or account name; otherwise `Account #N` or a shortened address |
| `account.addressMasked` | `Account #N` for indexed accounts, otherwise a shortened address |
| `totalFiat` | Fully formatted fiat display string from the App |
| `tokenCount` | `tokens.length`, currently capped at 5 |
| `tokens` | Keep the App-determined order |
| `otherTokens` | Summary of assets not in the detail list; always last |

`currency` and `currencySymbol` are removed from the protocol. Fiat display is embedded in `totalFiat`, `tokens[].fiatValue`, and `otherTokens.fiat`.

## 7. Token selection and order

The App takes the upstream UI token order and keeps the first 5:

```text
tokens.slice(0, 5)
```

Firmware no longer re-sorts by `fiatValue`. Device order matches the App order.

`otherTokens.count` is:

```text
max(trunc(totalTokenCount) - tokens.length, 0)
```

## 8. Amount formatting

### 8.1 Home total

`totalFiat` follows Home total-value rules: current currency, localized grouping and decimal separators, two decimal places, rounded. `0 < value < 0.01` renders as `< {currency}0.01`. Zero renders as `{currency}0.00`.

The App estimates the full string against Pro 2 16dp Roobert Regular and 350dp of usable width. If the string is at most 47 UTF-8 bytes and fits, it is sent as-is. Otherwise it switches to 4 significant digits and ASCII `e` scientific notation. Firmware still receives a single `totalFiat` field and does not parse or reformat it.

Examples:

```text
75.247                              → $75.25
123456789012.34                     → $123,456,789,012.34
123456789012345678901234567890.12   → $1.235e+29
0.009                               → < $0.01
```

### 8.2 Detail fiat amounts

`tokens[].fiatValue` and `otherTokens.fiat` use the Pro 2 compact fiat format: two decimal places, then `K/M/B/T/Q` above 1,000, with rounding at unit boundaries.

### 8.3 Token balance

`tokens[].balance` uses App `formatBalance()`:

- `>= 1` follows App unit and precision rules
- `< 1` keeps 4 significant fraction digits after leading zeros
- More than 4 leading zeros uses subscript compression

Examples:

```text
0.41308123    → 0.4131
0.00001234567 → 0.00001235
0.0000041     → 0.0₅41
```

### 8.4 Unicode subscript serialization

`formatDisplayNumber()` returns structured fragments for tiny values:

```ts
['0.0', { type: 'sub', value: 5 }, '41']
```

Portfolio serializes subscript digits to real Unicode before JSON:

```text
0 → ₀
1 → ₁
2 → ₂
3 → ₃
4 → ₄
5 → ₅
6 → ₆
7 → ₇
8 → ₈
9 → ₉
```

Multi-digit subscripts convert digit by digit:

```text
12 → ₁₂
```

Do not stringify `{ type: "sub", value: 5 }` as `"5"`. That would turn `0.0000041` into `0.0541`.

## 9. Fiat symbol compatibility

Portfolio only sends characters that firmware fonts can render.

The App currently accepts symbols in these firmware font ranges:

```text
U+0020–U+007E
U+00A0–U+024F
U+1E00–U+1EFF
U+2000–U+206F
U+2080–U+2089
```

If the symbol is empty, or any character is outside those ranges, the App uses the uppercase ISO currency code plus one ASCII space:

```text
€ → EUR
₹ → INR
unknown new symbol → uppercase currency id
```

Final examples:

```text
EUR 1.00
< EUR 0.01
```

The ISO code itself must also fall in the firmware range, otherwise build stops so the device never receives an undisplayable Portfolio.

Firmware fonts must include `U+2080–U+2089` to render the App's subscript digits.

## 10. UTF-8 byte limits

Each of these amount fields must be a non-empty string of at most 47 UTF-8 bytes:

- `totalFiat`
- `tokens[].balance`
- `tokens[].fiatValue`
- `otherTokens.fiat`

Validation runs after all of:

1. App numeric formatting
2. Unicode subscript serialization
3. ASCII `<` normalization
4. Fiat symbol or ISO code selection
5. Final string concatenation

The App uses UTF-8 byte length, not JavaScript UTF-16 `string.length`:

```ts
Buffer.byteLength(value, 'utf8')
```

Examples:

```text
0.0000041 → 9 UTF-8 bytes
0.0₅41    → 8 UTF-8 bytes
```

`₅` is 3 UTF-8 bytes.

If the full `totalFiat` format exceeds the limit, the App switches to scientific notation. If any other field exceeds the limit, this Portfolio build aborts. Do not truncate bytes; truncation can break UTF-8 characters or change amount meaning.

## 11. Fiat conversion

Raw token fiat amounts are converted to the App display currency:

```text
targetAmount = rawAmount / rawRate * targetRate
```

Treat the amount as unavailable when:

- The amount is `null`, `undefined`, or an empty string
- The amount is not a finite number
- The raw or target rate is missing, zero, or not finite

Unavailable token fiat amounts participate in Portfolio display and allocation as zero.

## 12. Allocation percentage

Firmware does not parse display amounts. The App computes these from pre-format numbers:

- `tokens[].portfolioPercentage`
- `otherTokens.portfolioPercentage`

Rules:

1. Every non-negative valid amount participates
2. If the total is `<= 0`, every percentage is zero
3. Percentages keep two decimal places
4. The largest item absorbs rounding error
5. For a non-zero Portfolio, all token percentages plus Other sum to 100

That lets firmware safely render non-numeric strings such as `< $0.01` and `0.0₅41` while still drawing allocation correctly.

## 13. Token metadata

### 13.1 Native assets and contract addresses

- All Networks aggregate assets: `contractAddress = ""`
- Most network native assets: `contractAddress = ""`
- Aptos and Sui natives may keep a normalized address
- Ordinary contract assets keep the normalized contract address
- Case-sensitive networks keep original address case; others use lowercase

### 13.2 Canonical names and icons

The App uses one trusted allowlist for `iconName` and canonical English names:

| `iconName` | Canonical `name` |
| --- | --- |
| `BTC` | `Bitcoin` |
| `ETH` | `Ethereum` |
| `BNB` | `BNB` |
| `SOL` | `Solana` |
| `TRON` | `TRON` |
| `USDT` | `Tether USD` |
| `USDC` | `USD Coin` |

Name rules:

1. A hit on the native, contract, or All Networks icon allowlist uses the canonical `name` above
2. A miss keeps the upstream `token.name` and `iconName = null`
3. The App never assigns a canonical name or icon from a normal contract token `symbol` alone
4. Aggregate symbols `TRX` and `TRON` both normalize to `name = "TRON"` and `iconName = "TRON"`

Local mock Portfolio keeps the resolved `iconName`. Production server submit clears `iconName` but keeps the canonical `name`:

```ts
{
  ...token,
  iconName: null,
}
```

The signed package `iconName` and `color` must come from trusted server rules. Firmware only consumes the server result.

### 13.3 Server allowlist key

The service builds an exact-match key as:

```ts
const key = `${networkId}:${contractAddress}:${name}`;
```

The App already normalizes contract addresses when building Portfolio: EVM addresses are lowercase; Solana and TRON keep case. The service must not re-derive the name from `isNative`, `isAllNetworks`, or `symbol`.

#### Native token

| Network | `networkId` | `contractAddress` | `symbol` | `name` | `iconName` | Server key |
| --- | --- | --- | --- | --- | --- | --- |
| Bitcoin | `btc--0` | `""` | `BTC` | `Bitcoin` | `BTC` | `btc--0::Bitcoin` |
| Ethereum | `evm--1` | `""` | `ETH` | `Ethereum` | `ETH` | `evm--1::Ethereum` |
| BNB Smart Chain | `evm--56` | `""` | `BNB` | `BNB` | `BNB` | `evm--56::BNB` |
| Solana | `sol--101` | `""` | `SOL` | `Solana` | `SOL` | `sol--101::Solana` |
| TRON | `tron--0x2b6653dc` | `""` | `TRX` | `TRON` | `TRON` | `tron--0x2b6653dc::TRON` |

#### Contract token

| Network | `networkId` | `contractAddress` | `symbol` | `name` | `iconName` | Server key |
| --- | --- | --- | --- | --- | --- | --- |
| Ethereum | `evm--1` | `0xdac17f958d2ee523a2206206994597c13d831ec7` | `USDT` | `Tether USD` | `USDT` | `evm--1:0xdac17f958d2ee523a2206206994597c13d831ec7:Tether USD` |
| Ethereum | `evm--1` | `0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48` | `USDC` | `USD Coin` | `USDC` | `evm--1:0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48:USD Coin` |
| BNB Smart Chain | `evm--56` | `0x55d398326f99059ff775485246999027b3197955` | `USDT` | `Tether USD` | `USDT` | `evm--56:0x55d398326f99059ff775485246999027b3197955:Tether USD` |
| BNB Smart Chain | `evm--56` | `0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d` | `USDC` | `USD Coin` | `USDC` | `evm--56:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d:USD Coin` |
| Polygon | `evm--137` | `0x3c499c542cef5e3811e1192ce70d8cc03d5c3359` | `USDC` | `USD Coin` | `USDC` | `evm--137:0x3c499c542cef5e3811e1192ce70d8cc03d5c3359:USD Coin` |
| Polygon | `evm--137` | `0xc2132d05d31c914a87c6611c10748aeb04b58e8f` | `USDT` | `Tether USD` | `USDT` | `evm--137:0xc2132d05d31c914a87c6611c10748aeb04b58e8f:Tether USD` |
| Solana | `sol--101` | `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v` | `USDC` | `USD Coin` | `USDC` | `sol--101:EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v:USD Coin` |
| Solana | `sol--101` | `Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB` | `USDT` | `Tether USD` | `USDT` | `sol--101:Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB:Tether USD` |
| TRON | `tron--0x2b6653dc` | `TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t` | `USDT` | `Tether USD` | `USDT` | `tron--0x2b6653dc:TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t:Tether USD` |

#### All Networks aggregate token

| `symbol` | `name` | `iconName` | `networkId` | `contractAddress` | Server key |
| --- | --- | --- | --- | --- | --- |
| `BTC` | `Bitcoin` | `BTC` | `""` | `""` | `::Bitcoin` |
| `ETH` | `Ethereum` | `ETH` | `""` | `""` | `::Ethereum` |
| `BNB` | `BNB` | `BNB` | `""` | `""` | `::BNB` |
| `SOL` | `Solana` | `SOL` | `""` | `""` | `::Solana` |
| `TRX` / `TRON` | `TRON` | `TRON` | `""` | `""` | `::TRON` |
| `USDT` | `Tether USD` | `USDT` | `""` | `""` | `::Tether USD` |
| `USDC` | `USD Coin` | `USDC` | `""` | `""` | `::USD Coin` |

### 13.4 Aggregate assets

All Networks aggregate assets use:

```json
{
  "isAllNetworks": true,
  "isNative": false,
  "contractAddress": "",
  "networkId": ""
}
```

Current firmware allows an empty `networkId` when `isAllNetworks = true`.

## 14. App to packing service

Endpoint:

```text
POST /wallet/v1/hardware/portfolio/pack
```

The body is the Portfolio JSON object, not a PFOL/OKPKG binary.

The App expects the service to:

- Strictly validate JSON fields
- Keep amount and balance display strings unchanged
- Validate UTF-8 byte length of every display amount
- Exact-match the trusted allowlist with `networkId:contractAddress:name`
- Fill `iconName` and `color` from the matched allowlist entry
- Build a package firmware accepts
- Sign with the production key set
- Return the full package as Base64

Response shape:

```json
{
  "data": {
    "packageBase64": "..."
  }
}
```

If `packageBase64` is missing, Base64 cannot be decoded, or the request fails, the App does not start a hardware upload.

## 15. Content hash and dedup

The App hashes stable JSON with SHA-256.

The hash excludes `ts`:

```ts
const { ts, ...content } = portfolio;
```

A Portfolio whose only change is the timestamp is not uploaded again.

Dedup state is committed only when:

- Server submit finishes, or
- The device completes `PortfolioUpdate`

Hardware-busy, disconnect, or upload failure must not persist a success hash, so the same content can retry when conditions recover.

Silent sync honors the persisted hash. Explicit sync only dedupes an in-flight identical snapshot; it may upload an unchanged snapshot again.

## 16. Hardware SDK upload

The App calls:

```ts
uploadPortfolio(connectId, {
  packageBase64,
  timeoutMs,
  uiMode, // omit for silent; 'progress' for explicit Sync
});
```

The SDK runs a two-stage flow:

1. Write the package with `FilesystemFileWrite` to:

   ```text
   vol1:/portfolio/portfolio.okpkg.pending
   ```

2. After the last chunk is confirmed, send:

   ```text
   PortfolioUpdate {}
   ```

Only a `PortfolioUpdate` `Success` makes the SDK return:

```json
{
  "portfolioUpdated": true
}
```

A finished file write only means the candidate package is staged. It does not mean Portfolio has been applied.

Default `uiMode` is silent: no `DEVICE_PROGRESS` and no Protocol V2 UI lifecycle events. `uiMode: 'progress'` emits transfer progress for the explicit Home action. Neither mode emits `REQUEST_PIN` or `REQUEST_BUTTON`, and neither mode unlocks the wallet.

## 17. Status and failure handling

| Status | Meaning |
| --- | --- |
| `disabled` | Target is not an authorized connected Protocol V2 hardware wallet |
| `empty` | No positive-balance assets need syncing |
| `duplicate` | Content hash matches a completed or in-flight snapshot |
| `cooldown` | Target is still inside the silent USB 60s window, or desktop BLE 5-minute window |
| `hardware-busy` | Another hardware operation owns the channel |
| `disconnected` | Silent sync requires a live connection |
| `inactive` | Home is no longer showing this wallet |
| `identity-mismatch` | Live device identity does not match the wallet device |
| `identity-unavailable` | Identity is missing, for example Bootloader |
| `device-locked` | Silent upload skipped because the device is locked |
| `ble-suspended` / `desktop-suspended` | Silent BLE kept a pending snapshot instead of transferring |
| `uploaded` | Device successfully ran `PortfolioUpdate` |
| `error` | Build, server, or hardware step failed |

Hardware-busy keeps the latest snapshot and retries after a short delay. USB silent cooldown schedules the latest snapshot for the remaining 60 seconds. Interactive identity mismatch throws `DeviceNotSame`. Interactive unapplied / locked / unavailable uploads throw a user-visible sync error. Switching away from the wallet returns silent `false` and does not toast on the new wallet.

## 18. Security and privacy

Portfolio JSON includes:

- Account name, account index, or shortened-address fallback
- Account index or shortened address
- Primary asset balances and fiat values
- Token symbol, name, network, and contract address
- Portfolio generation time

Treat this as sensitive financial data.

The package is signed, not encrypted. Do not log the full Portfolio, holdings, or full addresses.

Production signing keys stay on the server. The App does not hold the production private key.

## 19. Verification checklist

### 19.1 App

- [ ] `0.0000041` emits `0.0₅41`
- [ ] Multi-digit leading-zero counts convert to Unicode subscripts digit by digit
- [ ] Small fiat uses ASCII `<`
- [ ] Full-width `＜` is never sent
- [ ] `totalFiat` prefers the localized full amount with two decimals
- [ ] `totalFiat` uses 4-significant-digit scientific notation only when 16dp/350dp cannot fit or 47 bytes is exceeded
- [ ] Out-of-range fiat symbols fall back to ISO code
- [ ] All four amount fields are checked for 47 UTF-8 bytes after final concatenation
- [ ] Non-`totalFiat` overflow aborts the build instead of truncating
- [ ] Token order matches UI order
- [ ] Allowlisted tokens use canonical `name`
- [ ] Non-allowlisted tokens keep the original `name` and `iconName = null`
- [ ] Percentages sum correctly
- [ ] Content hash excludes `ts`
- [ ] Silent All Networks USB / WebUSB uses the 60-second cooldown and does not show hardware processing UI
- [ ] Silent BLE keeps a pending snapshot and does not transfer
- [ ] Explicit Sync ignores cooldown, uses hardware processing UI, and passes `uiMode: 'progress'`

### 19.2 Packing service

- [ ] Keep App amount display strings unchanged
- [ ] Reject amount fields over 47 UTF-8 bytes
- [ ] Exact-match the allowlist with `networkId:contractAddress:name`
- [ ] Fill valid `iconName` and `color`
- [ ] Return a signed package the target firmware can verify

### 19.3 Firmware

- [ ] Parser treats amounts as length-limited UTF-8 strings
- [ ] Font resources include `U+2080–U+2089`
- [ ] Home and detail pages render Unicode subscripts
- [ ] Ring chart uses only `portfolioPercentage`
- [ ] Tokens keep App order
- [ ] UI refreshes only after `PortfolioUpdate` succeeds

## 20. Key code locations

| Area | File |
| --- | --- |
| Portfolio types, formatting, percentages, and byte checks | `packages/shared/src/utils/portfolioPayload.ts` |
| Canonical token names and icon allowlist | `packages/shared/src/utils/portfolioTokenIcon.ts` |
| Portfolio unit tests | `packages/shared/src/utils/portfolioPayload.test.ts` |
| Home silent vs explicit producer | `packages/kit/src/views/Home/components/TokenListBlock/TokenListBlock.tsx` |
| Stable serialization and cooldown math | `packages/kit-bg/src/services/ServiceHardware/serviceHardwarePortfolioSync/serviceHardwarePortfolioSyncUtils.ts` |
| Sync state, dedup, cooldown, and server request | `packages/kit-bg/src/services/ServiceHardware/serviceHardwarePortfolioSync/ServiceHardwarePortfolioSync.ts` |
| Hardware service adapter | `packages/kit-bg/src/services/ServiceHardware/ServiceHardware.ts` |
| SDK upload implementation | `node_modules/@onekeyfe/hd-core/src/api/UploadPortfolio.ts` |
| Firmware display-string protocol | `firmware-pro2/utils/onekey_protocol_cli/portfolio.protocol.md` |
| Firmware JSON parser | `firmware-pro2/tasks/task_foreground/pages/standalone/portfolio_data.c` |
| Firmware Portfolio UI | `firmware-pro2/ui/components/portfolio/portfolio.c` |
