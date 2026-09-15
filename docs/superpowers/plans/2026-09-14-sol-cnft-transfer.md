# SOL Compressed NFT (cNFT) Transfer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the SOL vault send Metaplex Bubblegum compressed NFTs (cNFTs) through the backend DAS proxy, with a clear error instead of the fake 40001 when DAS is unavailable, and a correct NFT transfer action on the confirm page.

**Architecture:** A new pure module `sdkSol/bubblegum.ts` hand-builds the Bubblegum `transfer` instruction, parses the concurrent-merkle-tree header for canopy depth, and decodes the instruction back. `ClientSol` gains `getAsset` / `getAssetProof` (DAS methods through the existing `rpc` proxy route). `Vault._buildInstructionsForTransfer` detects a cNFT before any ATA logic and routes to `_buildCompressedNFTInstructions`; `_decodeNativeTxActions` recognizes the Bubblegum transfer so the confirm page renders an NFT transfer instead of "Unknown".

**Tech Stack:** TypeScript, `@solana/web3.js@1.98.2` (already installed), `bs58`, jest (`yarn jest <path>`). No new npm dependencies.

**Spec:** `docs/superpowers/specs/2026-08-25-sol-cnft-transfer-design.md`

**Deviations from the spec (decided 2026-09-14, verified against reference libraries):**

1. **No new packages.** The spec planned `@metaplex-foundation/mpl-bubblegum@0.11.0` + `@solana/spl-account-compression@0.2.1`. Those pull stale transitive deps (`@solana/spl-token@0.1.8`, `spl-account-compression@0.1.x`, old `beet`) into the wallet signing path for ~80 lines of needed surface. Instead the instruction bytes, tree-header parsing and asset-id PDA are hand-written and locked by golden-value tests. The golden values below were generated with the official packages (scratch script `golden.js`, asset `Hk561…`, tree `9cNp…`, test env 2026-09-14).
2. **Decode support is required.** The spec said the confirm UI needs no change. Wrong: `_decodeNativeTxActions` only decodes System/SPL-Token transfers and treats every other program as "custom" → the action becomes `UNKNOWN`. Also `METAPLEX_PROGRAM_IDS` in core lists a wrong Bubblegum id. Task 1 and Task 5 fix this.
3. **`leafOwner` is marked `isSigner: true`.** The solita builder leaves both `leafOwner` and `leafDelegate` unsigned and relies on the fee payer being the owner. Marking the owner as signer is what the on-chain program checks (`leaf_owner.is_signer || leaf_delegate.is_signer`) and is harmless because the payer is the owner anyway.

**Backend status:** test env `wallet.onekeytest.com` serves DAS on `sol--101` (verified 2026-09-14). Prod `wallet.onekeycn.com` still returns `Method not found` → degradation path stays live in prod until backend rollout.

**Golden reference values (asset `Redeem #511`):**

| Field | Value |
| --- | --- |
| assetId | `Hk561CaUF6EeSQQus7b6U2eiSi1cafW2NvrCZEB4grT2` |
| owner (`from`) | `GWt2DhskeyYAWMFHmgPSbt4uwJLt5wgNXtiRLrqsQtCc` |
| tree (`tree_id`) | `9cNpzwxid516U8WbDEvfTJe9JNzfGtcqbSnEP4y2qrg7` |
| treeAuthority PDA | `74WpXZPaPNqDQuiNspbJHTi1mJpqKHfD1qAgPBgonpKw` |
| root | `7N8UtpH5ysdrCvbffPwbkYeb1S4Mcss1bn4BEygMcv7T` |
| data_hash | `7VkvRip12PyLToUB8gsqXgDsjPakoZKCwFocYH6gBukB` |
| creator_hash | `ApQRzgo6fmkaBde4KpxXcRUNWJVXeZQRNnW8G6HDsqdv` |
| leaf_id (nonce = index) | `98357` |
| tree header (first 56 bytes, hex) | `010040000000140000005a0c94b73c673e3304b49792f4d2f0a795c2e1b92843b53229679204aa87e1ae54da971500000000000000000000` |
| tree account space | `44728` → maxDepth 20, maxBufferSize 64, canopyDepth 3 |
| proof (20 nodes, in order) | `4RiBn5ApToSctvH2nvURepweKX9oKrAMV3FW1mXkMcLj`, `ExqLnN8qXjpfeppmM3WfuXodYVuB2jBYQnnV6Eb3wcbY`, `2TH8hbc7NbPW62gbnMf6oUyLY5RdtHWuYxCQgxTQD3gQ`, `ASWYJY6a4soRg8XopbMuFUJKJmJjtN2ufqkTPBkGid6r`, `HprMnPCdrFVqb3ajSMeFCoV8iC6bdsz7mnkSJU5NaYpj`, `3sPeSM8BXJTK3riuTicNnWfzp9yWp12XosfrgBLsaxZX`, `2WdetMWQc1L44R5153Av2jHNdRK1wqTJezdbtNVWwDn8`, `7CL5srDEGYsL681FAYnWfU6pGkSrVQMKxnqPDtnqk1px`, `FnKgFK42Qbhv67TZt137U53F9fhV2v4GNS383dA8nwAF`, `2vN47FEhDjgThMoUJpHFqNKLXh41aCYqdahfxkJeqYqm`, `BgJxdoJEbH9PCpoeQm2S1NX2NMrbF9MKace1iPvZdrSx`, `DrhbsRLwQRPGmpbRiym5PWTnA4Cwh68FpWBZ6PfEh9tF`, `Euv5SNHTTqfJMPfXaPJZxUy3cUyctAzpNszUyPv3asBo`, `38GoFkNc9su9pd1T8Y6A6gqJyQZ9X27p6mZfmL1wbWVA`, `8b4wB9bPSxQ2JWYSNT873kiJzdYNtYrZnwSM5jNU2ozK`, `2s7WFUeMPZrHsKzxkQRo6rv9SV9xz271ZUViFGEvYEcm`, `CovhMo17rBi3BEVnTZNSnULHHRGLs7f7942byMMY9wnC`, `BWGYJEetVkrm9yk3dBwHseKWTZZJfATeJ4uNM63B4Kvw`, `61FM1o9AK4T7AZhcFD41DMHCVKtC26seQNanUwn6TZ99`, `2nRjrWSRr1U6BCPcaT42rtGDkRFqeE3xYGPEtCAVzYGW` |
| instruction data (116 bytes, hex, `to` = `11111111111111111111111111111112`) | `a334c8e78c0345ba5e8fc6f9fc6b1fd523771cf1d24b3b2523f08165567c8e3390220287ad90c08260840bc7049b62a7376468a3537c83e2de05fe36023a5af9ca9aa41275bc34b891ddf94bd4e5ade2b45390b20c4694b20eda9b66553b1bcfc71a16cfe583436d358001000000000035800100` |
| second asset (same owner, same tree) | `886YKPGiqwZHfd7z72pCEpYoUuDgCtKPgMUhjV1weEGr` = PDA(`asset`, tree, nonce `528145`) |

---

## File Structure

| File | Responsibility |
| --- | --- |
| `packages/core/src/chains/sol/constants.ts` (modify) | Correct Bubblegum program id in `METAPLEX_PROGRAM_IDS` so the instruction is not flagged as a custom program. |
| `packages/kit-bg/src/vaults/impls/sol/sdkSol/bubblegum.ts` (create) | Pure helpers: program ids, tree-authority / asset-id PDAs, tree header parsing (canopy depth), proof truncation, transfer instruction build + decode. No I/O. |
| `packages/kit-bg/src/vaults/impls/sol/sdkSol/bubblegum.test.ts` (create) | Golden-value tests for the module above. |
| `packages/kit-bg/src/vaults/impls/sol/types.ts` (modify) | `IDasAsset`, `IDasAssetProof` response types. |
| `packages/kit-bg/src/vaults/impls/sol/sdkSol/ClientSol.ts` (modify) | `getAsset`, `getAssetProof` proxy calls. |
| `packages/kit-bg/src/vaults/impls/sol/sdkSol/ClientSol.test.ts` (create) | Request-shape tests for the two DAS calls. |
| `packages/kit-bg/src/vaults/impls/sol/Vault.ts` (modify) | cNFT detection + build path in `_buildInstructionsForTransfer`; Bubblegum decode branch in `_decodeNativeTxActions`. |
| `packages/kit-bg/src/vaults/impls/sol/Vault.cnft.test.ts` (create) | Vault-level tests: detection/degradation, build path, decode. |
| `apps/mobile/bundle-registry/module-id-registry.json` (modify via script) | Register the new non-test file `sdkSol/bubblegum.ts`. |
| `docs/superpowers/specs/2026-08-25-sol-cnft-transfer-design.md` (modify) | Status + deviations note. |

Test command for one file: `yarn jest <repo-relative path>` (≈3 s warm). Type check: `yarn agent:check --profile commit` before each commit (runs lint + tsc; logs under `node_modules/.cache/agent-checks`).

Commit rules: `type: short description`, no attribution lines, never on `x`. Branch: `feat/sol-cnft-transfer`. `docs/superpowers/**` is gitignored → `git add -f` for doc files.

---

### Task 1: Fix the Bubblegum program id in core constants

**Files:**
- Modify: `packages/core/src/chains/sol/constants.ts:44`

- [ ] **Step 1: Replace the wrong id**

Current line 44:

```ts
  'BGumzjBrGv4hZPuFfbA7tZW1p42fBhm1zEGmfC4p4cXj', // Bubblegum (Compressed NFTs)
```

Replace with:

```ts
  'BGUMAp9Gq7iTEuizy4pqaxsTyUCBK68MDfK752saRPUY', // Bubblegum (Compressed NFTs)
```

(The old value is not a valid Bubblegum deployment; the real mainnet/devnet program id is `BGUMAp9Gq7iTEuizy4pqaxsTyUCBK68MDfK752saRPUY`.)

- [ ] **Step 2: Type check**

Run: `yarn tsc -p packages/core/tsconfig.json --noEmit 2>&1 | tail -3` (or `yarn agent:check --profile commit`)
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/chains/sol/constants.ts
git commit -m "fix: correct Bubblegum program id in Solana Metaplex program set"
```

---

### Task 2: Pure Bubblegum helper module (TDD, golden values)

**Files:**
- Create: `packages/kit-bg/src/vaults/impls/sol/sdkSol/bubblegum.ts`
- Test: `packages/kit-bg/src/vaults/impls/sol/sdkSol/bubblegum.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { PublicKey, SystemProgram } from '@solana/web3.js';

import {
  BUBBLEGUM_PROGRAM_ID,
  SPL_ACCOUNT_COMPRESSION_PROGRAM_ID,
  SPL_NOOP_PROGRAM_ID,
  buildBubblegumTransferInstruction,
  decodeBubblegumTransferInstruction,
  getBubblegumAssetId,
  getBubblegumTreeAuthority,
  parseConcurrentMerkleTreeAccount,
  truncateProofForCanopy,
} from './bubblegum';

// Golden values generated with @metaplex-foundation/mpl-bubblegum@0.11.0 and
// @solana/spl-account-compression@0.2.1 for mainnet asset "Redeem #511"
// (Hk561CaUF6EeSQQus7b6U2eiSi1cafW2NvrCZEB4grT2), fetched via DAS on 2026-09-14.
const GOLDEN = {
  assetId: 'Hk561CaUF6EeSQQus7b6U2eiSi1cafW2NvrCZEB4grT2',
  owner: 'GWt2DhskeyYAWMFHmgPSbt4uwJLt5wgNXtiRLrqsQtCc',
  to: '11111111111111111111111111111112',
  tree: '9cNpzwxid516U8WbDEvfTJe9JNzfGtcqbSnEP4y2qrg7',
  treeAuthority: '74WpXZPaPNqDQuiNspbJHTi1mJpqKHfD1qAgPBgonpKw',
  root: '7N8UtpH5ysdrCvbffPwbkYeb1S4Mcss1bn4BEygMcv7T',
  dataHash: '7VkvRip12PyLToUB8gsqXgDsjPakoZKCwFocYH6gBukB',
  creatorHash: 'ApQRzgo6fmkaBde4KpxXcRUNWJVXeZQRNnW8G6HDsqdv',
  leafId: 98_357,
  proof: [
    '4RiBn5ApToSctvH2nvURepweKX9oKrAMV3FW1mXkMcLj',
    'ExqLnN8qXjpfeppmM3WfuXodYVuB2jBYQnnV6Eb3wcbY',
    '2TH8hbc7NbPW62gbnMf6oUyLY5RdtHWuYxCQgxTQD3gQ',
    'ASWYJY6a4soRg8XopbMuFUJKJmJjtN2ufqkTPBkGid6r',
    'HprMnPCdrFVqb3ajSMeFCoV8iC6bdsz7mnkSJU5NaYpj',
    '3sPeSM8BXJTK3riuTicNnWfzp9yWp12XosfrgBLsaxZX',
    '2WdetMWQc1L44R5153Av2jHNdRK1wqTJezdbtNVWwDn8',
    '7CL5srDEGYsL681FAYnWfU6pGkSrVQMKxnqPDtnqk1px',
    'FnKgFK42Qbhv67TZt137U53F9fhV2v4GNS383dA8nwAF',
    '2vN47FEhDjgThMoUJpHFqNKLXh41aCYqdahfxkJeqYqm',
    'BgJxdoJEbH9PCpoeQm2S1NX2NMrbF9MKace1iPvZdrSx',
    'DrhbsRLwQRPGmpbRiym5PWTnA4Cwh68FpWBZ6PfEh9tF',
    'Euv5SNHTTqfJMPfXaPJZxUy3cUyctAzpNszUyPv3asBo',
    '38GoFkNc9su9pd1T8Y6A6gqJyQZ9X27p6mZfmL1wbWVA',
    '8b4wB9bPSxQ2JWYSNT873kiJzdYNtYrZnwSM5jNU2ozK',
    '2s7WFUeMPZrHsKzxkQRo6rv9SV9xz271ZUViFGEvYEcm',
    'CovhMo17rBi3BEVnTZNSnULHHRGLs7f7942byMMY9wnC',
    'BWGYJEetVkrm9yk3dBwHseKWTZZJfATeJ4uNM63B4Kvw',
    '61FM1o9AK4T7AZhcFD41DMHCVKtC26seQNanUwn6TZ99',
    '2nRjrWSRr1U6BCPcaT42rtGDkRFqeE3xYGPEtCAVzYGW',
  ],
  canopyDepth: 3,
  treeHeaderHex:
    '010040000000140000005a0c94b73c673e3304b49792f4d2f0a795c2e1b92843b53229679204aa87e1ae54da971500000000000000000000',
  treeSpace: 44_728,
  dataHex:
    'a334c8e78c0345ba5e8fc6f9fc6b1fd523771cf1d24b3b2523f08165567c8e3390220287ad90c08260840bc7049b62a7376468a3537c83e2de05fe36023a5af9ca9aa41275bc34b891ddf94bd4e5ade2b45390b20c4694b20eda9b66553b1bcfc71a16cfe583436d358001000000000035800100',
};

function buildGoldenTreeBuffer(): Buffer {
  const buf = Buffer.alloc(GOLDEN.treeSpace);
  Buffer.from(GOLDEN.treeHeaderHex, 'hex').copy(buf, 0);
  return buf;
}

describe('bubblegum PDAs', () => {
  it('derives the tree authority', () => {
    expect(
      getBubblegumTreeAuthority(new PublicKey(GOLDEN.tree)).toBase58(),
    ).toBe(GOLDEN.treeAuthority);
  });

  it('derives the asset id from tree + nonce', () => {
    expect(
      getBubblegumAssetId({
        merkleTree: new PublicKey(GOLDEN.tree),
        nonce: GOLDEN.leafId,
      }).toBase58(),
    ).toBe(GOLDEN.assetId);
    expect(
      getBubblegumAssetId({
        merkleTree: new PublicKey(GOLDEN.tree),
        nonce: 528_145,
      }).toBase58(),
    ).toBe('886YKPGiqwZHfd7z72pCEpYoUuDgCtKPgMUhjV1weEGr');
  });
});

describe('parseConcurrentMerkleTreeAccount', () => {
  it('reads depth, buffer size and canopy depth from the account layout', () => {
    expect(parseConcurrentMerkleTreeAccount(buildGoldenTreeBuffer())).toEqual({
      maxDepth: 20,
      maxBufferSize: 64,
      canopyDepth: 3,
    });
  });

  it('returns canopy depth 0 when the account has no canopy bytes', () => {
    // header 56 + 24 + 64 * (32 + 20 * 32 + 8) + (20 * 32 + 32 + 8) = 44280
    const buf = Buffer.alloc(44_280);
    Buffer.from(GOLDEN.treeHeaderHex, 'hex').copy(buf, 0);
    expect(parseConcurrentMerkleTreeAccount(buf).canopyDepth).toBe(0);
  });

  it('rejects a non merkle-tree account', () => {
    const buf = buildGoldenTreeBuffer();
    buf.writeUInt8(0, 0);
    expect(() => parseConcurrentMerkleTreeAccount(buf)).toThrow(
      'Invalid merkle tree account',
    );
  });

  it('rejects a truncated account', () => {
    expect(() =>
      parseConcurrentMerkleTreeAccount(Buffer.alloc(10)),
    ).toThrow('Invalid merkle tree account');
  });
});

describe('truncateProofForCanopy', () => {
  it('drops the last canopyDepth nodes', () => {
    expect(
      truncateProofForCanopy({ proof: GOLDEN.proof, canopyDepth: 3 }),
    ).toEqual(GOLDEN.proof.slice(0, 17));
  });

  it('keeps the full proof at canopy depth 0', () => {
    expect(
      truncateProofForCanopy({ proof: GOLDEN.proof, canopyDepth: 0 }),
    ).toEqual(GOLDEN.proof);
  });

  it('never returns a negative-length slice', () => {
    expect(
      truncateProofForCanopy({ proof: ['a', 'b'], canopyDepth: 5 }),
    ).toEqual([]);
  });
});

describe('buildBubblegumTransferInstruction', () => {
  const build = () =>
    buildBubblegumTransferInstruction({
      merkleTree: new PublicKey(GOLDEN.tree),
      leafOwner: new PublicKey(GOLDEN.owner),
      leafDelegate: new PublicKey(GOLDEN.owner),
      newLeafOwner: new PublicKey(GOLDEN.to),
      root: GOLDEN.root,
      dataHash: GOLDEN.dataHash,
      creatorHash: GOLDEN.creatorHash,
      nonce: GOLDEN.leafId,
      index: GOLDEN.leafId,
      proof: GOLDEN.proof.slice(0, 17),
    });

  it('matches the reference instruction data bytes', () => {
    const ix = build();
    expect(ix.programId.equals(BUBBLEGUM_PROGRAM_ID)).toBe(true);
    expect(ix.data.toString('hex')).toBe(GOLDEN.dataHex);
    expect(ix.data.length).toBe(116);
  });

  it('matches the reference account list (owner marked as signer)', () => {
    const ix = build();
    const keys = ix.keys.map((k) => [
      k.pubkey.toBase58(),
      k.isSigner,
      k.isWritable,
    ]);
    expect(keys.slice(0, 8)).toEqual([
      [GOLDEN.treeAuthority, false, false],
      [GOLDEN.owner, true, false],
      [GOLDEN.owner, false, false],
      [GOLDEN.to, false, false],
      [GOLDEN.tree, false, true],
      [SPL_NOOP_PROGRAM_ID.toBase58(), false, false],
      [SPL_ACCOUNT_COMPRESSION_PROGRAM_ID.toBase58(), false, false],
      [SystemProgram.programId.toBase58(), false, false],
    ]);
    expect(keys.slice(8)).toEqual(
      GOLDEN.proof.slice(0, 17).map((p) => [p, false, false]),
    );
  });

  it('rejects hashes that are not 32 bytes', () => {
    expect(() =>
      buildBubblegumTransferInstruction({
        merkleTree: new PublicKey(GOLDEN.tree),
        leafOwner: new PublicKey(GOLDEN.owner),
        leafDelegate: new PublicKey(GOLDEN.owner),
        newLeafOwner: new PublicKey(GOLDEN.to),
        root: 'abc',
        dataHash: GOLDEN.dataHash,
        creatorHash: GOLDEN.creatorHash,
        nonce: GOLDEN.leafId,
        index: GOLDEN.leafId,
        proof: [],
      }),
    ).toThrow('Invalid compressed NFT hash');
  });
});

describe('decodeBubblegumTransferInstruction', () => {
  it('round-trips the built instruction', () => {
    const ix = buildBubblegumTransferInstruction({
      merkleTree: new PublicKey(GOLDEN.tree),
      leafOwner: new PublicKey(GOLDEN.owner),
      leafDelegate: new PublicKey(GOLDEN.owner),
      newLeafOwner: new PublicKey(GOLDEN.to),
      root: GOLDEN.root,
      dataHash: GOLDEN.dataHash,
      creatorHash: GOLDEN.creatorHash,
      nonce: GOLDEN.leafId,
      index: GOLDEN.leafId,
      proof: GOLDEN.proof.slice(0, 17),
    });
    expect(decodeBubblegumTransferInstruction(ix)).toEqual({
      leafOwner: GOLDEN.owner,
      leafDelegate: GOLDEN.owner,
      newLeafOwner: GOLDEN.to,
      merkleTree: GOLDEN.tree,
      nonce: GOLDEN.leafId,
      index: GOLDEN.leafId,
      assetId: GOLDEN.assetId,
    });
  });

  it('returns null for a system transfer', () => {
    const ix = SystemProgram.transfer({
      fromPubkey: new PublicKey(GOLDEN.owner),
      toPubkey: new PublicKey(GOLDEN.to),
      lamports: 1,
    });
    expect(decodeBubblegumTransferInstruction(ix)).toBeNull();
  });

  it('returns null for a Bubblegum instruction with another discriminator', () => {
    const ix = buildBubblegumTransferInstruction({
      merkleTree: new PublicKey(GOLDEN.tree),
      leafOwner: new PublicKey(GOLDEN.owner),
      leafDelegate: new PublicKey(GOLDEN.owner),
      newLeafOwner: new PublicKey(GOLDEN.to),
      root: GOLDEN.root,
      dataHash: GOLDEN.dataHash,
      creatorHash: GOLDEN.creatorHash,
      nonce: GOLDEN.leafId,
      index: GOLDEN.leafId,
      proof: [],
    });
    ix.data.writeUInt8(0, 0);
    expect(decodeBubblegumTransferInstruction(ix)).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `yarn jest packages/kit-bg/src/vaults/impls/sol/sdkSol/bubblegum.test.ts`
Expected: FAIL — `Cannot find module './bubblegum'`.

- [ ] **Step 3: Write the implementation**

```ts
import { PublicKey, SystemProgram, TransactionInstruction } from '@solana/web3.js';
import bs58 from 'bs58';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

// Metaplex Bubblegum (compressed NFT) program and its two helper programs.
export const BUBBLEGUM_PROGRAM_ID = new PublicKey(
  'BGUMAp9Gq7iTEuizy4pqaxsTyUCBK68MDfK752saRPUY',
);
export const SPL_NOOP_PROGRAM_ID = new PublicKey(
  'noopb9bkMVfRPU8AsbpTUg8AQkHtKwMYZiFUjNRtMmV',
);
export const SPL_ACCOUNT_COMPRESSION_PROGRAM_ID = new PublicKey(
  'cmtDvXumGCrqC1Age74AVPhSRVXJMd8PJS91L8KbNCK',
);

// Anchor instruction discriminator: sha256("global:transfer")[0..8].
export const BUBBLEGUM_TRANSFER_DISCRIMINATOR = Buffer.from(
  'a334c8e78c0345ba',
  'hex',
);

const HASH_SIZE = 32;
// Bubblegum transfer args: root(32) + dataHash(32) + creatorHash(32) + nonce(u64) + index(u32).
const TRANSFER_DATA_SIZE = 8 + HASH_SIZE * 3 + 8 + 4;
const TRANSFER_FIXED_ACCOUNTS = 8;

// spl-account-compression ConcurrentMerkleTreeHeader (V1):
// accountType u8 + version u8 + maxBufferSize u32 + maxDepth u32
// + authority Pubkey(32) + creationSlot u64 + padding[6].
const TREE_HEADER_SIZE = 56;
const TREE_ACCOUNT_TYPE_CONCURRENT_MERKLE_TREE = 1;

export interface IConcurrentMerkleTreeInfo {
  maxDepth: number;
  maxBufferSize: number;
  canopyDepth: number;
}

export interface IBubblegumTransferDecoded {
  leafOwner: string;
  leafDelegate: string;
  newLeafOwner: string;
  merkleTree: string;
  nonce: number;
  index: number;
  assetId: string;
}

export function getBubblegumTreeAuthority(merkleTree: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [merkleTree.toBuffer()],
    BUBBLEGUM_PROGRAM_ID,
  )[0];
}

export function getBubblegumAssetId({
  merkleTree,
  nonce,
}: {
  merkleTree: PublicKey;
  nonce: number;
}): PublicKey {
  const nonceBuffer = Buffer.alloc(8);
  nonceBuffer.writeBigUInt64LE(BigInt(nonce));
  return PublicKey.findProgramAddressSync(
    [Buffer.from('asset'), merkleTree.toBuffer(), nonceBuffer],
    BUBBLEGUM_PROGRAM_ID,
  )[0];
}

export function parseConcurrentMerkleTreeAccount(
  data: Buffer,
): IConcurrentMerkleTreeInfo {
  if (data.length < TREE_HEADER_SIZE) {
    throw new OneKeyLocalError('Invalid merkle tree account: data too short');
  }
  const accountType = data.readUInt8(0);
  if (accountType !== TREE_ACCOUNT_TYPE_CONCURRENT_MERKLE_TREE) {
    throw new OneKeyLocalError(
      `Invalid merkle tree account: unexpected account type ${accountType}`,
    );
  }
  const maxBufferSize = data.readUInt32LE(2);
  const maxDepth = data.readUInt32LE(6);

  // ConcurrentMerkleTree<maxDepth, maxBufferSize> body:
  // sequenceNumber u64 + activeIndex u64 + bufferSize u64
  // + changeLogs[maxBufferSize] { root 32, path[maxDepth] 32, index u32, padding u32 }
  // + rightMostPath { proof[maxDepth] 32, leaf 32, index u32, padding u32 }
  const changeLogSize = HASH_SIZE + maxDepth * HASH_SIZE + 4 + 4;
  const pathSize = maxDepth * HASH_SIZE + HASH_SIZE + 4 + 4;
  const treeSize = 8 + 8 + 8 + maxBufferSize * changeLogSize + pathSize;
  const canopyByteLength = data.length - TREE_HEADER_SIZE - treeSize;
  if (canopyByteLength < 0) {
    throw new OneKeyLocalError(
      'Invalid merkle tree account: size does not match header',
    );
  }
  // The canopy caches the top `canopyDepth` levels: 2^(canopyDepth+1) - 2 nodes.
  const canopyDepth =
    canopyByteLength === 0
      ? 0
      : Math.round(Math.log2(canopyByteLength / HASH_SIZE + 2) - 1);

  return { maxDepth, maxBufferSize, canopyDepth };
}

export function truncateProofForCanopy({
  proof,
  canopyDepth,
}: {
  proof: string[];
  canopyDepth: number;
}): string[] {
  return proof.slice(0, Math.max(proof.length - canopyDepth, 0));
}

function decodeHash(value: string): Buffer {
  let bytes: Uint8Array;
  try {
    bytes = bs58.decode(value);
  } catch {
    throw new OneKeyLocalError('Invalid compressed NFT hash');
  }
  if (bytes.length !== HASH_SIZE) {
    throw new OneKeyLocalError('Invalid compressed NFT hash');
  }
  return Buffer.from(bytes);
}

export function buildBubblegumTransferInstruction({
  merkleTree,
  leafOwner,
  leafDelegate,
  newLeafOwner,
  root,
  dataHash,
  creatorHash,
  nonce,
  index,
  proof,
}: {
  merkleTree: PublicKey;
  leafOwner: PublicKey;
  leafDelegate: PublicKey;
  newLeafOwner: PublicKey;
  root: string;
  dataHash: string;
  creatorHash: string;
  nonce: number;
  index: number;
  proof: string[];
}): TransactionInstruction {
  const data = Buffer.alloc(TRANSFER_DATA_SIZE);
  BUBBLEGUM_TRANSFER_DISCRIMINATOR.copy(data, 0);
  decodeHash(root).copy(data, 8);
  decodeHash(dataHash).copy(data, 8 + HASH_SIZE);
  decodeHash(creatorHash).copy(data, 8 + HASH_SIZE * 2);
  data.writeBigUInt64LE(BigInt(nonce), 8 + HASH_SIZE * 3);
  data.writeUInt32LE(index, 8 + HASH_SIZE * 3 + 8);

  // The program accepts either leafOwner or leafDelegate as signer; the wallet
  // always signs as the owner (it is also the fee payer).
  const keys = [
    {
      pubkey: getBubblegumTreeAuthority(merkleTree),
      isSigner: false,
      isWritable: false,
    },
    { pubkey: leafOwner, isSigner: true, isWritable: false },
    { pubkey: leafDelegate, isSigner: false, isWritable: false },
    { pubkey: newLeafOwner, isSigner: false, isWritable: false },
    { pubkey: merkleTree, isSigner: false, isWritable: true },
    { pubkey: SPL_NOOP_PROGRAM_ID, isSigner: false, isWritable: false },
    {
      pubkey: SPL_ACCOUNT_COMPRESSION_PROGRAM_ID,
      isSigner: false,
      isWritable: false,
    },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ...proof.map((node) => ({
      pubkey: new PublicKey(node),
      isSigner: false,
      isWritable: false,
    })),
  ];

  return new TransactionInstruction({
    programId: BUBBLEGUM_PROGRAM_ID,
    keys,
    data,
  });
}

export function decodeBubblegumTransferInstruction(
  instruction: TransactionInstruction,
): IBubblegumTransferDecoded | null {
  if (!instruction.programId.equals(BUBBLEGUM_PROGRAM_ID)) {
    return null;
  }
  if (
    instruction.data.length < TRANSFER_DATA_SIZE ||
    !instruction.data
      .subarray(0, BUBBLEGUM_TRANSFER_DISCRIMINATOR.length)
      .equals(BUBBLEGUM_TRANSFER_DISCRIMINATOR)
  ) {
    return null;
  }
  if (instruction.keys.length < TRANSFER_FIXED_ACCOUNTS) {
    return null;
  }
  const nonce = Number(instruction.data.readBigUInt64LE(8 + HASH_SIZE * 3));
  const index = instruction.data.readUInt32LE(8 + HASH_SIZE * 3 + 8);
  const merkleTree = instruction.keys[4].pubkey;
  return {
    leafOwner: instruction.keys[1].pubkey.toString(),
    leafDelegate: instruction.keys[2].pubkey.toString(),
    newLeafOwner: instruction.keys[3].pubkey.toString(),
    merkleTree: merkleTree.toString(),
    nonce,
    index,
    assetId: getBubblegumAssetId({ merkleTree, nonce }).toString(),
  };
}
```

- [ ] **Step 4: Run tests**

Run: `yarn jest packages/kit-bg/src/vaults/impls/sol/sdkSol/bubblegum.test.ts`
Expected: PASS, 12 tests.

- [ ] **Step 5: Lint + commit**

Run: `npx oxlint --tsconfig ./tsconfig.json --type-aware --deny-warnings packages/kit-bg/src/vaults/impls/sol/sdkSol` (directory, not file — oxlint ignores explicit file args). Expected: no output, exit 0.

```bash
git add packages/kit-bg/src/vaults/impls/sol/sdkSol/bubblegum.ts packages/kit-bg/src/vaults/impls/sol/sdkSol/bubblegum.test.ts
git commit -m "feat: add Bubblegum compressed NFT instruction helpers for Solana"
```

---

### Task 3: DAS types and `ClientSol.getAsset` / `getAssetProof`

**Files:**
- Modify: `packages/kit-bg/src/vaults/impls/sol/types.ts` (append)
- Modify: `packages/kit-bg/src/vaults/impls/sol/sdkSol/ClientSol.ts` (enum + two methods)
- Test: `packages/kit-bg/src/vaults/impls/sol/sdkSol/ClientSol.test.ts` (create)

- [ ] **Step 1: Write the failing test**

```ts
import ClientSol from './ClientSol';

const ASSET_ID = 'Hk561CaUF6EeSQQus7b6U2eiSi1cafW2NvrCZEB4grT2';

function buildClient() {
  const sendProxyRequest = jest.fn();
  const client = new ClientSol({
    networkId: 'sol--101',
    backgroundApi: {
      serviceAccountProfile: { sendProxyRequest },
    },
  });
  return { client, sendProxyRequest };
}

describe('ClientSol DAS methods', () => {
  it('getAsset sends the DAS getAsset rpc through the proxy', async () => {
    const { client, sendProxyRequest } = buildClient();
    const asset = { id: ASSET_ID, compression: { compressed: true } };
    sendProxyRequest.mockResolvedValue([asset]);

    await expect(client.getAsset(ASSET_ID)).resolves.toBe(asset);
    expect(sendProxyRequest).toHaveBeenCalledWith({
      networkId: 'sol--101',
      body: [
        {
          route: 'rpc',
          params: { method: 'getAsset', params: { id: ASSET_ID } },
        },
      ],
    });
  });

  it('getAssetProof sends the DAS getAssetProof rpc through the proxy', async () => {
    const { client, sendProxyRequest } = buildClient();
    const proof = { root: 'r', proof: ['a'], node_index: 1, leaf: 'l', tree_id: 't' };
    sendProxyRequest.mockResolvedValue([proof]);

    await expect(client.getAssetProof(ASSET_ID)).resolves.toBe(proof);
    expect(sendProxyRequest).toHaveBeenCalledWith({
      networkId: 'sol--101',
      body: [
        {
          route: 'rpc',
          params: { method: 'getAssetProof', params: { id: ASSET_ID } },
        },
      ],
    });
  });

  it('propagates proxy errors (e.g. Method not found on backends without DAS)', async () => {
    const { client, sendProxyRequest } = buildClient();
    sendProxyRequest.mockRejectedValue(new Error('Method not found'));
    await expect(client.getAsset(ASSET_ID)).rejects.toThrow('Method not found');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `yarn jest packages/kit-bg/src/vaults/impls/sol/sdkSol/ClientSol.test.ts`
Expected: FAIL — `client.getAsset is not a function`.

- [ ] **Step 3: Add the types**

Append to `packages/kit-bg/src/vaults/impls/sol/types.ts`:

```ts
// Metaplex DAS (Digital Asset Standard) `getAsset` response, trimmed to the
// fields the vault reads. Proxied through the backend RPC route.
export type IDasAsset = {
  id: string;
  interface: string;
  burnt?: boolean;
  compression?: {
    compressed: boolean;
    data_hash: string;
    creator_hash: string;
    asset_hash: string;
    tree: string;
    seq: number;
    leaf_id: number;
  };
  ownership?: {
    owner: string;
    delegate: string | null;
    delegated: boolean;
    frozen: boolean;
    ownership_model: string;
  };
  content?: {
    metadata?: {
      name?: string;
      symbol?: string;
    };
    links?: {
      image?: string;
    };
  };
};

// DAS `getAssetProof` response.
export type IDasAssetProof = {
  root: string;
  proof: string[];
  node_index: number;
  leaf: string;
  tree_id: string;
};
```

- [ ] **Step 4: Add enum members and methods to `ClientSol.ts`**

In `ERpcMethods` add:

```ts
  GET_ASSET = 'getAsset',
  GET_ASSET_PROOF = 'getAssetProof',
```

Add the import at the top (after the `IBackgroundApi` import):

```ts
import type { IDasAsset, IDasAssetProof } from '../types';
```

Add two methods to the class (after `getMultipleAccountsInfo`):

```ts
  // DAS methods are only served by DAS-capable upstreams; on other backends
  // the proxy rejects with "Method not found" and the vault degrades.
  async getAsset(assetId: string): Promise<IDasAsset> {
    const [response] =
      await this.backgroundApi.serviceAccountProfile.sendProxyRequest<IDasAsset>(
        {
          networkId: this.networkId,
          body: [
            {
              route: 'rpc',
              params: {
                method: ERpcMethods.GET_ASSET,
                params: { id: assetId },
              },
            },
          ],
        },
      );
    return response;
  }

  async getAssetProof(assetId: string): Promise<IDasAssetProof> {
    const [response] =
      await this.backgroundApi.serviceAccountProfile.sendProxyRequest<IDasAssetProof>(
        {
          networkId: this.networkId,
          body: [
            {
              route: 'rpc',
              params: {
                method: ERpcMethods.GET_ASSET_PROOF,
                params: { id: assetId },
              },
            },
          ],
        },
      );
    return response;
  }
```

- [ ] **Step 5: Run tests**

Run: `yarn jest packages/kit-bg/src/vaults/impls/sol/sdkSol/ClientSol.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 6: Commit**

```bash
git add packages/kit-bg/src/vaults/impls/sol/types.ts packages/kit-bg/src/vaults/impls/sol/sdkSol/ClientSol.ts packages/kit-bg/src/vaults/impls/sol/sdkSol/ClientSol.test.ts
git commit -m "feat: add DAS getAsset and getAssetProof to Solana proxy client"
```

---

### Task 4: cNFT detection and build path in the vault

**Files:**
- Modify: `packages/kit-bg/src/vaults/impls/sol/Vault.ts` (`_buildInstructionsForTransfer` ~line 270; new methods after `_getTokenProgramId`)
- Test: `packages/kit-bg/src/vaults/impls/sol/Vault.cnft.test.ts` (create)

- [ ] **Step 1: Write the failing tests**

```ts
import { PublicKey } from '@solana/web3.js';

import type { IDasAsset, IDasAssetProof } from './types';

// Importing the vault pulls in the localDb singleton, whose constructor opens
// IndexedDB at module load and crashes under jest's node environment.
jest.mock('../../../dbs/local/localDbInstance', () => ({
  __esModule: true,
  default: {},
}));

// eslint-disable-next-line import/first
import SolVault from './Vault';
// eslint-disable-next-line import/first
import { BUBBLEGUM_PROGRAM_ID } from './sdkSol/bubblegum';

const ASSET_ID = 'Hk561CaUF6EeSQQus7b6U2eiSi1cafW2NvrCZEB4grT2';
const OWNER = 'GWt2DhskeyYAWMFHmgPSbt4uwJLt5wgNXtiRLrqsQtCc';
const TO = '11111111111111111111111111111112';
const TREE = '9cNpzwxid516U8WbDEvfTJe9JNzfGtcqbSnEP4y2qrg7';
const TREE_HEADER_HEX =
  '010040000000140000005a0c94b73c673e3304b49792f4d2f0a795c2e1b92843b53229679204aa87e1ae54da971500000000000000000000';
const PROOF = [
  '4RiBn5ApToSctvH2nvURepweKX9oKrAMV3FW1mXkMcLj',
  'ExqLnN8qXjpfeppmM3WfuXodYVuB2jBYQnnV6Eb3wcbY',
  '2TH8hbc7NbPW62gbnMf6oUyLY5RdtHWuYxCQgxTQD3gQ',
  'ASWYJY6a4soRg8XopbMuFUJKJmJjtN2ufqkTPBkGid6r',
  'HprMnPCdrFVqb3ajSMeFCoV8iC6bdsz7mnkSJU5NaYpj',
  '3sPeSM8BXJTK3riuTicNnWfzp9yWp12XosfrgBLsaxZX',
  '2WdetMWQc1L44R5153Av2jHNdRK1wqTJezdbtNVWwDn8',
  '7CL5srDEGYsL681FAYnWfU6pGkSrVQMKxnqPDtnqk1px',
  'FnKgFK42Qbhv67TZt137U53F9fhV2v4GNS383dA8nwAF',
  '2vN47FEhDjgThMoUJpHFqNKLXh41aCYqdahfxkJeqYqm',
  'BgJxdoJEbH9PCpoeQm2S1NX2NMrbF9MKace1iPvZdrSx',
  'DrhbsRLwQRPGmpbRiym5PWTnA4Cwh68FpWBZ6PfEh9tF',
  'Euv5SNHTTqfJMPfXaPJZxUy3cUyctAzpNszUyPv3asBo',
  '38GoFkNc9su9pd1T8Y6A6gqJyQZ9X27p6mZfmL1wbWVA',
  '8b4wB9bPSxQ2JWYSNT873kiJzdYNtYrZnwSM5jNU2ozK',
  '2s7WFUeMPZrHsKzxkQRo6rv9SV9xz271ZUViFGEvYEcm',
  'CovhMo17rBi3BEVnTZNSnULHHRGLs7f7942byMMY9wnC',
  'BWGYJEetVkrm9yk3dBwHseKWTZZJfATeJ4uNM63B4Kvw',
  '61FM1o9AK4T7AZhcFD41DMHCVKtC26seQNanUwn6TZ99',
  '2nRjrWSRr1U6BCPcaT42rtGDkRFqeE3xYGPEtCAVzYGW',
];

const compressedAsset: IDasAsset = {
  id: ASSET_ID,
  interface: 'V1_NFT',
  burnt: false,
  compression: {
    compressed: true,
    data_hash: '7VkvRip12PyLToUB8gsqXgDsjPakoZKCwFocYH6gBukB',
    creator_hash: 'ApQRzgo6fmkaBde4KpxXcRUNWJVXeZQRNnW8G6HDsqdv',
    asset_hash: 'E38umAdjzGmJBRKxYYxxZ7t9edpHAYy9fvgjtADbuCJ5',
    tree: TREE,
    seq: 98_367,
    leaf_id: 98_357,
  },
  ownership: {
    owner: OWNER,
    delegate: null,
    delegated: false,
    frozen: false,
    ownership_model: 'single',
  },
  content: {
    metadata: { name: 'Redeem #511', symbol: 'MyNF' },
    links: { image: 'https://example.com/redeem.png' },
  },
};

const assetProof: IDasAssetProof = {
  root: '7N8UtpH5ysdrCvbffPwbkYeb1S4Mcss1bn4BEygMcv7T',
  proof: PROOF,
  node_index: 1_146_933,
  leaf: 'E38umAdjzGmJBRKxYYxxZ7t9edpHAYy9fvgjtADbuCJ5',
  tree_id: TREE,
};

function buildTreeAccountInfo(space = 44_728) {
  const buf = Buffer.alloc(space);
  Buffer.from(TREE_HEADER_HEX, 'hex').copy(buf, 0);
  return {
    data: [buf.toString('base64'), 'base64'] as [string, string],
    executable: false,
    lamports: 1,
    owner: 'cmtDvXumGCrqC1Age74AVPhSRVXJMd8PJS91L8KbNCK',
  };
}

function buildVault(client: {
  getAsset?: jest.Mock;
  getAssetProof?: jest.Mock;
  getAccountInfo?: jest.Mock;
}) {
  const vault = Object.create(SolVault.prototype) as SolVault;
  vault.networkId = 'sol--101';
  vault.accountId = "hd-1--m/44'/501'/0'/0'";
  // Only the client is needed for the cNFT paths under test.
  vault.getClient = jest.fn().mockResolvedValue(client) as never;
  return vault;
}

describe('SolVault compressed NFT detection', () => {
  it('returns the asset when DAS reports it as compressed', async () => {
    const getAsset = jest.fn().mockResolvedValue(compressedAsset);
    const vault = buildVault({ getAsset });
    await expect(
      vault._resolveCompressedNft({ assetId: ASSET_ID }),
    ).resolves.toBe(compressedAsset);
  });

  it('returns null for a regular (non-compressed) asset', async () => {
    const getAsset = jest.fn().mockResolvedValue({
      ...compressedAsset,
      compression: { ...compressedAsset.compression, compressed: false },
    });
    const vault = buildVault({ getAsset });
    await expect(
      vault._resolveCompressedNft({ assetId: ASSET_ID }),
    ).resolves.toBeNull();
  });

  it('throws a clear error when DAS is unavailable and the mint account is missing', async () => {
    const getAsset = jest.fn().mockRejectedValue(new Error('Method not found'));
    const getAccountInfo = jest.fn().mockResolvedValue(null);
    const vault = buildVault({ getAsset, getAccountInfo });
    await expect(
      vault._resolveCompressedNft({ assetId: ASSET_ID }),
    ).rejects.toThrow('Compressed NFT transfer is not supported yet');
    expect(getAccountInfo).toHaveBeenCalledWith({
      address: ASSET_ID,
      encoding: 'base64',
    });
  });

  it('falls back to the SPL path when DAS is unavailable but the mint account exists', async () => {
    const getAsset = jest.fn().mockRejectedValue(new Error('Method not found'));
    const getAccountInfo = jest
      .fn()
      .mockResolvedValue({ data: ['', 'base64'], owner: 'x' });
    const vault = buildVault({ getAsset, getAccountInfo });
    await expect(
      vault._resolveCompressedNft({ assetId: ASSET_ID }),
    ).resolves.toBeNull();
  });
});

describe('SolVault._buildCompressedNFTInstructions', () => {
  it('builds a single Bubblegum transfer with the canopy-truncated proof', async () => {
    const getAssetProof = jest.fn().mockResolvedValue(assetProof);
    const getAccountInfo = jest.fn().mockResolvedValue(buildTreeAccountInfo());
    const vault = buildVault({ getAssetProof, getAccountInfo });

    const instructions = await vault._buildCompressedNFTInstructions({
      asset: compressedAsset,
      source: new PublicKey(OWNER),
      destination: new PublicKey(TO),
    });

    expect(instructions).toHaveLength(1);
    const [ix] = instructions;
    expect(ix.programId.equals(BUBBLEGUM_PROGRAM_ID)).toBe(true);
    // 8 fixed accounts + (20 - canopy 3) proof nodes
    expect(ix.keys).toHaveLength(8 + 17);
    expect(ix.keys[1].pubkey.toBase58()).toBe(OWNER);
    expect(ix.keys[1].isSigner).toBe(true);
    expect(ix.keys[2].pubkey.toBase58()).toBe(OWNER);
    expect(ix.keys[3].pubkey.toBase58()).toBe(TO);
    expect(ix.keys[8].pubkey.toBase58()).toBe(PROOF[0]);
    expect(ix.keys[24].pubkey.toBase58()).toBe(PROOF[16]);
    expect(getAccountInfo).toHaveBeenCalledWith({
      address: TREE,
      encoding: 'base64',
    });
  });

  it('uses the delegate as leafDelegate when the asset is delegated', async () => {
    const delegate = '11111111111111111111111111111113';
    const getAssetProof = jest.fn().mockResolvedValue(assetProof);
    const getAccountInfo = jest.fn().mockResolvedValue(buildTreeAccountInfo());
    const vault = buildVault({ getAssetProof, getAccountInfo });

    const [ix] = await vault._buildCompressedNFTInstructions({
      asset: {
        ...compressedAsset,
        ownership: { ...compressedAsset.ownership!, delegated: true, delegate },
      },
      source: new PublicKey(OWNER),
      destination: new PublicKey(TO),
    });
    expect(ix.keys[2].pubkey.toBase58()).toBe(delegate);
  });

  it('rejects when the sender does not own the asset', async () => {
    const vault = buildVault({});
    await expect(
      vault._buildCompressedNFTInstructions({
        asset: compressedAsset,
        source: new PublicKey(TO),
        destination: new PublicKey(OWNER),
      }),
    ).rejects.toThrow('Compressed NFT is not owned by the sender');
  });

  it('rejects a burnt asset', async () => {
    const vault = buildVault({});
    await expect(
      vault._buildCompressedNFTInstructions({
        asset: { ...compressedAsset, burnt: true },
        source: new PublicKey(OWNER),
        destination: new PublicKey(TO),
      }),
    ).rejects.toThrow('Compressed NFT has been burnt');
  });

  it('rejects when the merkle tree account is missing', async () => {
    const getAssetProof = jest.fn().mockResolvedValue(assetProof);
    const getAccountInfo = jest.fn().mockResolvedValue(null);
    const vault = buildVault({ getAssetProof, getAccountInfo });
    await expect(
      vault._buildCompressedNFTInstructions({
        asset: compressedAsset,
        source: new PublicKey(OWNER),
        destination: new PublicKey(TO),
      }),
    ).rejects.toThrow('Compressed NFT merkle tree account not found');
  });

  it('rejects when the proof cannot fit in one transaction', async () => {
    // Depth 30 tree, canopy 0: 30 proof nodes never fit the 1232-byte packet.
    const deepProof: IDasAssetProof = {
      ...assetProof,
      proof: Array.from({ length: 30 }, (_, i) =>
        PublicKey.findProgramAddressSync(
          [Buffer.from(`node-${i}`)],
          BUBBLEGUM_PROGRAM_ID,
        )[0].toBase58(),
      ),
    };
    const header = Buffer.from(TREE_HEADER_HEX, 'hex');
    header.writeUInt32LE(30, 6); // maxDepth
    // header 56 + 24 + 64 * (32 + 30 * 32 + 8) + (30 * 32 + 32 + 8) = 65_080
    const buf = Buffer.alloc(65_080);
    header.copy(buf, 0);
    const getAssetProof = jest.fn().mockResolvedValue(deepProof);
    const getAccountInfo = jest.fn().mockResolvedValue({
      ...buildTreeAccountInfo(),
      data: [buf.toString('base64'), 'base64'],
    });
    const vault = buildVault({ getAssetProof, getAccountInfo });
    await expect(
      vault._buildCompressedNFTInstructions({
        asset: compressedAsset,
        source: new PublicKey(OWNER),
        destination: new PublicKey(TO),
      }),
    ).rejects.toThrow('Compressed NFT proof is too large');
  });
});

describe('SolVault._buildInstructionsForTransfer routing', () => {
  it('routes an NFT transfer to the Bubblegum path when DAS says compressed', async () => {
    const getAsset = jest.fn().mockResolvedValue(compressedAsset);
    const getAssetProof = jest.fn().mockResolvedValue(assetProof);
    const getAccountInfo = jest.fn().mockResolvedValue(buildTreeAccountInfo());
    const getTokenAccountsByOwner = jest.fn();
    const client = { getAsset, getAssetProof, getAccountInfo, getTokenAccountsByOwner };
    const vault = buildVault(client);

    const instructions = await vault._buildInstructionsForTransfer({
      transferInfo: {
        from: OWNER,
        to: TO,
        amount: '1',
        nftInfo: { nftId: '', nftAddress: ASSET_ID, nftType: 'ERC-721' as never },
      },
      source: new PublicKey(OWNER),
      firstReceiver: TO,
      client: client as never,
    });

    expect(instructions).toHaveLength(1);
    expect(instructions[0].programId.equals(BUBBLEGUM_PROGRAM_ID)).toBe(true);
    // No SPL token-program lookups happen on the cNFT path.
    expect(getTokenAccountsByOwner).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `yarn jest packages/kit-bg/src/vaults/impls/sol/Vault.cnft.test.ts`
Expected: FAIL — `vault._resolveCompressedNft is not a function`.

- [ ] **Step 3: Add imports to `Vault.ts`**

After the `import ClientSol from './sdkSol/ClientSol';` line add:

```ts
import {
  buildBubblegumTransferInstruction,
  decodeBubblegumTransferInstruction,
  parseConcurrentMerkleTreeAccount,
  truncateProofForCanopy,
} from './sdkSol/bubblegum';
```

Extend the existing `import { EParamsEncodings } ...`? Check: `EParamsEncodings` is exported from `./sdkSol/ClientSol`; if `Vault.ts` does not already import it, change the import to:

```ts
import ClientSol, { EParamsEncodings } from './sdkSol/ClientSol';
```

Extend the existing `import type { IAssociatedTokenInfo, IParsedAccountInfo } from './types';` (find the actual line with `from './types'`) to include `IDasAsset`:

```ts
import type { IAssociatedTokenInfo, IDasAsset, IParsedAccountInfo } from './types';
```

Also `PACKET_DATA_SIZE`, `TransactionMessage`, `VersionedTransaction` are already imported from `@solana/web3.js` (line ~31-40); reuse them. `decodeBubblegumTransferInstruction` is used in Task 5 — importing it now is fine (lint will flag unused only if Task 5 is skipped; if you run lint between tasks, add the import in Task 5 instead).

- [ ] **Step 4: Route cNFTs before ATA logic in `_buildInstructionsForTransfer`**

Locate (around line 272):

```ts
      // ata - associated token account
      const tokenAddress = tokenInfo?.address ?? nftInfo?.nftAddress ?? '';
      const tokenSendAddress = tokenInfo?.sendAddress;
      const mint = new PublicKey(tokenAddress);
      let destinationAta = destination;
```

Insert between `const tokenAddress = ...;` and `const tokenSendAddress = ...;`:

```ts
      if (nftInfo) {
        // Compressed NFTs (Bubblegum) have no mint / token accounts; detect
        // them first so the SPL path below never builds an unusable tx.
        const compressedNft = await this._resolveCompressedNft({
          assetId: tokenAddress,
        });
        if (compressedNft) {
          instructions.push(
            ...(await this._buildCompressedNFTInstructions({
              asset: compressedNft,
              source,
              destination,
            })),
          );
          return instructions;
        }
      }
```

- [ ] **Step 5: Add the two vault methods**

Insert right after the `_getTokenProgramId` method (before `_getAssociatedTokenAddress`):

```ts
  // Returns the DAS asset when it is a compressed NFT, null when the asset
  // should take the regular SPL/pNFT path. When DAS is unavailable (backend
  // without DAS upstream → "Method not found", or the asset is not indexed)
  // the mint account decides: no account on chain means it can only be a
  // cNFT, which we cannot transfer without DAS.
  async _resolveCompressedNft({
    assetId,
  }: {
    assetId: string;
  }): Promise<IDasAsset | null> {
    const client = await this.getClient();
    let asset: IDasAsset | undefined;
    try {
      asset = await client.getAsset(assetId);
    } catch {
      const mintAccountInfo = await client.getAccountInfo({
        address: assetId,
        encoding: EParamsEncodings.BASE64,
      });
      if (!mintAccountInfo) {
        throw new OneKeyLocalError(
          'Compressed NFT transfer is not supported yet',
        );
      }
      return null;
    }
    return asset?.compression?.compressed ? asset : null;
  }

  async _buildCompressedNFTInstructions({
    asset,
    source,
    destination,
  }: {
    asset: IDasAsset;
    source: PublicKey;
    destination: PublicKey;
  }): Promise<TransactionInstruction[]> {
    const { compression, ownership } = asset;
    if (!compression || !ownership) {
      throw new OneKeyLocalError('Compressed NFT data is incomplete');
    }
    if (asset.burnt) {
      throw new OneKeyLocalError('Compressed NFT has been burnt');
    }
    if (ownership.owner !== source.toString()) {
      throw new OneKeyLocalError('Compressed NFT is not owned by the sender');
    }

    const client = await this.getClient();
    const assetProof = await client.getAssetProof(asset.id);
    const treeAccountInfo = await client.getAccountInfo({
      address: assetProof.tree_id,
      encoding: EParamsEncodings.BASE64,
    });
    if (!treeAccountInfo) {
      throw new OneKeyLocalError(
        'Compressed NFT merkle tree account not found',
      );
    }
    const { canopyDepth } = parseConcurrentMerkleTreeAccount(
      Buffer.from(treeAccountInfo.data[0], 'base64'),
    );
    const proof = truncateProofForCanopy({
      proof: assetProof.proof,
      canopyDepth,
    });

    const instruction = buildBubblegumTransferInstruction({
      merkleTree: new PublicKey(assetProof.tree_id),
      leafOwner: source,
      leafDelegate: ownership.delegate
        ? new PublicKey(ownership.delegate)
        : source,
      newLeafOwner: destination,
      root: assetProof.root,
      dataHash: compression.data_hash,
      creatorHash: compression.creator_hash,
      nonce: compression.leaf_id,
      index: compression.leaf_id,
      proof,
    });

    // Deep trees with a shallow canopy need more proof accounts than a single
    // transaction can carry; fail here instead of at broadcast. The trial
    // message uses a placeholder blockhash and leaves headroom for the
    // priority-fee instruction that is prepended by the caller.
    const trialMessage = new TransactionMessage({
      payerKey: source,
      recentBlockhash: PublicKey.default.toString(),
      instructions: [
        ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1 }),
        instruction,
      ],
    }).compileToV0Message([]);
    if (
      new VersionedTransaction(trialMessage).serialize().length >
      PACKET_DATA_SIZE
    ) {
      throw new OneKeyLocalError(
        'Compressed NFT proof is too large to fit in a single transaction',
      );
    }

    return [instruction];
  }
```

(`ComputeBudgetProgram` is already imported in `Vault.ts`.)

- [ ] **Step 6: Run tests**

Run: `yarn jest packages/kit-bg/src/vaults/impls/sol/Vault.cnft.test.ts`
Expected: PASS, 10 tests. If the "too large" test does not throw, print `new VersionedTransaction(trialMessage).serialize().length` in the test to confirm the 30-node tx exceeds 1232 bytes (expected ≈ 1550).

- [ ] **Step 7: Type check and commit**

Run: `yarn agent:check --profile commit`
Expected: PASS (if `decodeBubblegumTransferInstruction` is reported unused, remove it from the import and re-add it in Task 5).

```bash
git add packages/kit-bg/src/vaults/impls/sol/Vault.ts packages/kit-bg/src/vaults/impls/sol/Vault.cnft.test.ts
git commit -m "feat: build Bubblegum transfers for Solana compressed NFTs"
```

---

### Task 5: Decode the Bubblegum transfer for the confirm page

**Files:**
- Modify: `packages/kit-bg/src/vaults/impls/sol/Vault.ts` (`_decodeNativeTxActions`, the `for (const instruction of instructions)` loop ~line 1216)
- Test: `packages/kit-bg/src/vaults/impls/sol/Vault.cnft.test.ts` (append)

- [ ] **Step 1: Write the failing test** (append to `Vault.cnft.test.ts`)

```ts
describe('SolVault._decodeNativeTxActions for Bubblegum transfers', () => {
  function buildDecodeVault(getAsset: jest.Mock) {
    const vault = buildVault({ getAsset });
    vault.getAccountAddress = jest.fn().mockResolvedValue(OWNER) as never;
    vault.getNetwork = jest
      .fn()
      .mockResolvedValue({ decimals: 9, symbol: 'SOL' }) as never;
    return vault;
  }

  it('produces an NFT asset transfer action with DAS metadata', async () => {
    const getAssetProof = jest.fn().mockResolvedValue(assetProof);
    const getAccountInfo = jest.fn().mockResolvedValue(buildTreeAccountInfo());
    const builder = buildVault({ getAssetProof, getAccountInfo });
    const [ix] = await builder._buildCompressedNFTInstructions({
      asset: compressedAsset,
      source: new PublicKey(OWNER),
      destination: new PublicKey(TO),
    });

    const getAsset = jest.fn().mockResolvedValue(compressedAsset);
    const vault = buildDecodeVault(getAsset);
    const actions = await vault._decodeNativeTxActions({
      instructions: [ix],
      isNFT: true,
      amountToSend: '1',
      sendTokenInfo: undefined,
    });

    expect(getAsset).toHaveBeenCalledWith(ASSET_ID);
    expect(actions).toHaveLength(1);
    expect(actions[0].type).toBe('ASSET_TRANSFER');
    expect(actions[0].assetTransfer?.sends).toEqual([
      expect.objectContaining({
        from: OWNER,
        to: TO,
        tokenIdOnNetwork: ASSET_ID,
        amount: '1',
        name: 'Redeem #511',
        symbol: 'MyNF',
        icon: 'https://example.com/redeem.png',
        isNFT: true,
      }),
    ]);
  });

  it('still produces the transfer when DAS metadata cannot be loaded', async () => {
    const getAssetProof = jest.fn().mockResolvedValue(assetProof);
    const getAccountInfo = jest.fn().mockResolvedValue(buildTreeAccountInfo());
    const builder = buildVault({ getAssetProof, getAccountInfo });
    const [ix] = await builder._buildCompressedNFTInstructions({
      asset: compressedAsset,
      source: new PublicKey(OWNER),
      destination: new PublicKey(TO),
    });

    const getAsset = jest.fn().mockRejectedValue(new Error('Method not found'));
    const vault = buildDecodeVault(getAsset);
    const actions = await vault._decodeNativeTxActions({
      instructions: [ix],
      isNFT: true,
      amountToSend: '1',
      sendTokenInfo: undefined,
    });

    expect(actions[0].type).toBe('ASSET_TRANSFER');
    expect(actions[0].assetTransfer?.sends[0]).toEqual(
      expect.objectContaining({ tokenIdOnNetwork: ASSET_ID, isNFT: true, name: '' }),
    );
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `yarn jest packages/kit-bg/src/vaults/impls/sol/Vault.cnft.test.ts -t Bubblegum`
Expected: FAIL — `actions[0].type` is `UNKNOWN` (no Bubblegum branch yet).

- [ ] **Step 3: Add the decode branch**

In `_decodeNativeTxActions`, the loop body starts with:

```ts
    for (const instruction of instructions) {
      if (isCustomProgram(instruction.programId.toString())) {
        hasCustomProgram = true;
      }

      // TODO: only support system transfer & token transfer now
      if (
        instruction.programId.toString() === SystemProgram.programId.toString()
      ) {
```

Insert a new branch immediately before the `// TODO: only support system transfer & token transfer now` comment:

```ts
      const bubblegumTransfer =
        decodeBubblegumTransferInstruction(instruction);
      if (bubblegumTransfer) {
        actions.push(
          await this._buildCompressedNFTTransferAction({
            transfer: bubblegumTransfer,
            amountToSend,
          }),
        );
        // eslint-disable-next-line no-continue
        continue;
      }
```

Then add the helper method right after `_decodeNativeTxActions` (before `buildUnsignedTx`):

```ts
  async _buildCompressedNFTTransferAction({
    transfer,
    amountToSend,
  }: {
    transfer: IBubblegumTransferDecoded;
    amountToSend: string | undefined;
  }): Promise<IDecodedTxAction> {
    // Metadata comes from DAS; the wallet NFT detail API cannot address a
    // cNFT (no itemId), so degrade to an unnamed NFT transfer if DAS fails.
    let name = '';
    let symbol = '';
    let icon = '';
    try {
      const client = await this.getClient();
      const asset = await client.getAsset(transfer.assetId);
      name = asset.content?.metadata?.name ?? '';
      symbol = asset.content?.metadata?.symbol ?? name;
      icon = asset.content?.links?.image ?? '';
    } catch {
      // keep empty metadata
    }
    const transferInfo: IDecodedTxTransferInfo = {
      from: transfer.leafOwner,
      to: transfer.newLeafOwner,
      tokenIdOnNetwork: transfer.assetId,
      icon,
      name,
      symbol,
      amount: amountToSend ?? '1',
      isNFT: true,
      NFTType: ENFTType.ERC721,
    };
    return this.buildTxTransferAssetAction({
      from: transfer.leafOwner,
      to: transfer.newLeafOwner,
      transfers: [transferInfo],
    });
  }
```

Add imports: `IBubblegumTransferDecoded` (type) from `./sdkSol/bubblegum` and `ENFTType` from `@onekeyhq/shared/types/nft`:

```ts
import { ENFTType } from '@onekeyhq/shared/types/nft';
```

and extend the bubblegum import:

```ts
import {
  buildBubblegumTransferInstruction,
  decodeBubblegumTransferInstruction,
  parseConcurrentMerkleTreeAccount,
  truncateProofForCanopy,
} from './sdkSol/bubblegum';
import type { IBubblegumTransferDecoded } from './sdkSol/bubblegum';
```

Note: `hasCustomProgram` stays false for Bubblegum because Task 1 fixed the id in `METAPLEX_PROGRAM_IDS`; the branch `if (hasCustomProgram) actions = []` therefore does not wipe the action.

- [ ] **Step 4: Run all SOL tests**

Run: `yarn jest packages/kit-bg/src/vaults/impls/sol`
Expected: PASS (new: 12 + 3 + 12; existing keyring tests untouched).

- [ ] **Step 5: Check and commit**

Run: `yarn agent:check --profile commit`
Expected: PASS.

```bash
git add packages/kit-bg/src/vaults/impls/sol/Vault.ts packages/kit-bg/src/vaults/impls/sol/Vault.cnft.test.ts
git commit -m "feat: decode Bubblegum transfers as NFT actions on Solana confirm page"
```

---

### Task 6: Register the new module, update the spec, final checks

**Files:**
- Modify (via script): `apps/mobile/bundle-registry/module-id-registry.json`
- Modify: `docs/superpowers/specs/2026-08-25-sol-cnft-transfer-design.md`

- [ ] **Step 1: Register `bubblegum.ts` in the native module-id registry**

Write `/tmp`-free map in the scratchpad, e.g. `<scratchpad>/module-id-map.json`:

```json
{ "main": { "1": "packages/kit-bg/src/vaults/impls/sol/sdkSol/bubblegum.ts" } }
```

Run:

```bash
yarn workspace @onekeyhq/mobile module-id:update --map <scratchpad>/module-id-map.json
git diff --stat apps/mobile/bundle-registry/module-id-registry.json
```

Expected: one added entry for `bubblegum.ts`. Verify nothing else is missing:

```bash
for f in $(git diff --diff-filter=A --name-only origin/x...HEAD -- packages apps | grep -E "\.(ts|tsx)$" | grep -v "\.test\."); do grep -q "\"$f\"" apps/mobile/bundle-registry/module-id-registry.json || echo MISS $f; done
```

Expected: no `MISS` lines.

- [ ] **Step 2: Update the spec status**

In `docs/superpowers/specs/2026-08-25-sol-cnft-transfer-design.md` change:

```
- Status: Design approved, implementation not started
```

to:

```
- Status: Implemented 2026-09-14 (plan: `docs/superpowers/plans/2026-09-14-sol-cnft-transfer.md`); deviations: no new npm packages (hand-written Bubblegum instruction locked by golden tests), Bubblegum decode branch added for the confirm page, `leafOwner` marked signer
```

and in the Decisions table replace the "Instruction building" row's decision text with:

```
Hand-written `sdkSol/bubblegum.ts` (transfer instruction, tree header/canopy parsing, asset-id PDA); golden values generated from `@metaplex-foundation/mpl-bubblegum@0.11.0` + `@solana/spl-account-compression@0.2.1`. No new dependencies.
```

- [ ] **Step 3: Full check and commit**

Run: `yarn agent:check --profile commit`
Expected: PASS.

```bash
git add apps/mobile/bundle-registry/module-id-registry.json
git add -f docs/superpowers/specs/2026-08-25-sol-cnft-transfer-design.md docs/superpowers/plans/2026-09-14-sol-cnft-transfer.md
git commit -m "chore: register Bubblegum module and record cNFT transfer plan"
```

---

### Task 7: Live verification against the test backend (no signing)

Purpose: prove the real DAS proxy + build + decode path end to end with the QA asset, without needing the owner's key.

- [ ] **Step 1: Start the dev desktop app pointed at the test endpoints** (`/1k-dev-commands`; dev builds use `onekeytest.com` endpoints by default — confirm in Dev Settings that the endpoint env is `test`).

- [ ] **Step 2: Add a watching account** for `GWt2DhskeyYAWMFHmgPSbt4uwJLt5wgNXtiRLrqsQtCc` on Solana, open the NFT tab, open `Redeem #511` (collectionAddress `Hk561…` or `886Y…`), tap Send, enter any valid SOL recipient, continue to the confirm page.

- [ ] **Step 3: Verify via CDP** (`desktop-dev-cdp-live-debug` memory: `$backgroundApiProxy`):

```js
await $backgroundApiProxy.serviceAccountProfile.sendProxyRequest({ networkId: 'sol--101', body: [{ route: 'rpc', params: { method: 'getAsset', params: { id: 'Hk561CaUF6EeSQQus7b6U2eiSi1cafW2NvrCZEB4grT2' } } }] })
```

Expected: `compression.compressed === true`. On the confirm page expect an NFT transfer row named `Redeem #511` (not "Unknown"), and no 40001 toast. Signing is not possible on a watching account — stop there. Record the screenshot in the PR.

- [ ] **Step 4: Regression** — repeat Step 2 with a regular SPL NFT from the same account (e.g. `Nfty Star #801`): confirm page must still show the SPL NFT transfer (path unchanged; `getAsset` returns `compressed: false`).

- [ ] **Step 5: Report** — summarize results; hand the signed E2E (real send of `Redeem #511`) to QA with the owner wallet, and note that prod still returns `Method not found` (degradation path → "Compressed NFT transfer is not supported yet") until backend rollout.

---

## Self-Review

- **Spec coverage:** 3.1 detection → Task 4 (`_resolveCompressedNft`); 3.2 build path incl. owner/burnt checks, proof truncation, packet-size guard, account list/args → Tasks 2 + 4; 3.3 "unchanged" corrected → Task 5 decode; 4 error handling → all four error classes have tests (DAS unavailable + missing mint, request failure surfaces via proxy error / tree missing, owner mismatch / burnt, proof too large); 5 unit tests (golden, canopy 0, degradation, regression routing) → Tasks 2/3/4; integration → Task 7; 6 backend → verified live on test env.
- **Placeholders:** none; every code step is complete.
- **Type consistency:** `IDasAsset` / `IDasAssetProof` (Task 3) used in Task 4/5; `IBubblegumTransferDecoded` (Task 2) used in Task 5; method names `_resolveCompressedNft`, `_buildCompressedNFTInstructions`, `_buildCompressedNFTTransferAction` consistent across tasks and tests; `EParamsEncodings.BASE64 === 'base64'` matches the test expectations.
