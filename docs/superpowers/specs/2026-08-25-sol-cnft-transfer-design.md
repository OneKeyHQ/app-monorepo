# SOL Compressed NFT (cNFT) Transfer Support — Design

- Date: 2026-08-25
- Branch: `feat/sol-cnft-transfer`
- Status: Design approved, implementation not started
- Related: QA Slack thread 2026-08-12 ("SOL 的 NFT 转账一直报拥挤"); the server masks the simulation failure as error 40001

## 1. Problem

Sending certain Solana NFTs fails with server error 40001 ("链上服务拥挤"). The
real failure is a transaction simulation error:
`Error processing Instruction 1: incorrect program id for instruction`.

Root cause (verified on mainnet):

- The failing assets (e.g. `Redeem #511`, asset id
  `Hk561CaUF6EeSQQus7b6U2eiSi1cafW2NvrCZEB4grT2`) are **Metaplex Bubblegum
  compressed NFTs (cNFTs)**. A cNFT has no mint account on chain —
  `getAccountInfo` returns `null`; the asset lives as a leaf in a concurrent
  merkle tree and the "address" is a derived asset id (off-curve PDA).
- The SOL vault NFT branch
  (`packages/kit-bg/src/vaults/impls/sol/Vault.ts`, `buildEncodedTx` →
  pNFT → OCP → plain SPL fallback) has no cNFT path. It treats the asset id
  as an SPL mint, builds createATA + transferChecked against a nonexistent
  mint, and simulation fails. `_getTokenProgramId` also silently falls back
  to `TOKEN_PROGRAM_ID` because the owner has no token account for a cNFT.
- Working assets (e.g. `Nfty Star #801`) are standard SPL NFTs with a real
  mint account, so the existing path succeeds.

Goal: full cNFT transfer support via the Bubblegum program, with a clear
error (instead of the misleading 40001) whenever the required data source is
unavailable.

## 2. Decisions

| Topic | Decision |
| --- | --- |
| DAS data source | OneKey backend RPC proxy passes through DAS methods (`getAsset`, `getAssetProof`). Backend must switch/add a DAS-capable upstream node (e.g. Helius) for `sol--101`. Verified on 2026-08-25 that prod proxy currently returns `"Method not found"` for `getAsset`. |
| Instruction building | Add solita-era `@metaplex-foundation/mpl-bubblegum@0.11.0` (`createTransferInstruction`) and `@solana/spl-account-compression@0.2.1` (`ConcurrentMerkleTreeAccount` for canopy depth). Matches the existing solita-style `@metaplex-foundation/mpl-token-metadata@2.7` usage; compatible with `@solana/web3.js@1.98.2`. |
| Custom RPC | Out of scope. Transaction building always goes through the backend proxy (`ClientSol`); `ClientCustomRpcSol` is only used for broadcast/health and stays untouched. |
| Rollout | Client code merges first with a graceful degradation path; it activates automatically once backend DAS goes live. |

## 3. Data Flow

All changes live in `packages/kit-bg/src/vaults/impls/sol/`.

### 3.1 Detection (entry of the NFT branch in `buildEncodedTx`)

Add `ClientSol.getAsset(assetId)` (proxy route `'rpc'`, method `getAsset`).
Before the existing pNFT/OCP/SPL branching:

1. Call `getAsset(nftInfo.nftAddress)`.
   - `compression.compressed === true` → new cNFT path (3.2).
   - `compression.compressed === false` → existing path, behavior unchanged.
   - Backend not ready (`Method not found`) or DAS unavailable → fallback:
     probe `getAccountInfo(mint)`. If the account does not exist, throw
     `OneKeyLocalError('Compressed NFT transfer is not supported yet')`
     (clear client-side error replacing the misleading 40001). If it exists,
     continue with the existing path.

### 3.2 cNFT build path (`_buildCompressedNFTInstructions`)

1. Validate from `getAsset` result: `ownership.owner === from`, and
   `burnt !== true`; otherwise throw a specific `OneKeyLocalError`.
2. Add `ClientSol.getAssetProof(assetId)` → `root`, `proof[]`, `tree_id`.
3. Fetch the merkle tree account (`getAccountInfo`, base64) →
   `ConcurrentMerkleTreeAccount.fromBuffer()` → `canopyDepth` → truncate:
   `proof.slice(0, proof.length - canopyDepth)`.
   If the truncated proof still cannot fit the 1232-byte packet limit
   (deep tree with shallow canopy), throw a specific error instead of
   building a transaction that cannot broadcast.
4. Build the Bubblegum `createTransferInstruction`:
   - Accounts: `treeAuthority` (Bubblegum PDA of the tree), `leafOwner = from`
     (signer), `leafDelegate = ownership.delegate ?? from`,
     `newLeafOwner = to`, `merkleTree`, `logWrapper` (SPL Noop),
     `compressionProgram` (SPL Account Compression), `systemProgram`,
     remaining accounts = truncated proof nodes.
   - Args: `root`, `dataHash`, `creatorHash`, `nonce = compression.leaf_id`,
     `index = compression.leaf_id`.
5. Skip all ATA/rent logic — a cNFT transfer has no token accounts and the
   recipient needs no rent-exempt account.

### 3.3 Unchanged

Fee estimation, signing (all keyrings — HD, hardware, Ledger, QR — sign the
native transaction message and need no changes), broadcast, and the send
confirmation UI (renders from `transferInfo.nftInfo`, not from decoded
instructions).

## 4. Error Handling

All new failure modes throw `OneKeyLocalError` with a clear English message
(consistent with existing vault errors such as `'token account is locked'`);
the send flow surfaces it as a toast:

- DAS unavailable while the asset looks compressed (mint account missing).
- `getAsset` / `getAssetProof` request failure.
- Asset owner mismatch or asset burnt.
- Proof too long to fit a transaction after canopy truncation.

## 5. Testing

- Unit tests (`Vault` / instruction builder):
  - Golden-value test: mocked `getAsset` / `getAssetProof` / tree account
    data; assert the generated instruction's account list and data bytes
    against a reference-implementation output.
  - Canopy truncation math, including canopy depth 0.
  - Degradation branch: DAS `Method not found` + missing mint account →
    clear "not supported" error.
  - Regression branch: regular SPL NFT still routes to the existing path
    when `getAsset` is unavailable.
- Integration (after backend DAS is live):
  - Send `Redeem #511` (the QA-reported cNFT) end to end.
  - Regression: standard NFT (`Nfty Star #801`), pNFT, and SPL token
    transfers unaffected.

## 6. Backend Dependency (parallel track)

- Backend adds DAS passthrough (`getAsset`, `getAssetProof`) to the
  `sol--101` RPC proxy upstream.
- Until then the client ships the degradation path; cNFT sends fail fast
  with an explicit unsupported error instead of the fake congestion error.

## 7. Out of Scope (YAGNI)

- DAS support for user-configured custom RPC endpoints.
- cNFT badges / risk labeling in NFT list and detail UI.
- Deep decoding of Bubblegum instructions in transaction history.
- Compressed-NFT indexing changes on the server NFT list API (the list
  payload currently mislabels Solana NFTs as `ERC-721`; tracked separately).
