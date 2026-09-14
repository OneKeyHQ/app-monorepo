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

function buildGoldenInstruction(proof: string[] = GOLDEN.proof.slice(0, 17)) {
  return buildBubblegumTransferInstruction({
    merkleTree: new PublicKey(GOLDEN.tree),
    leafOwner: new PublicKey(GOLDEN.owner),
    leafDelegate: new PublicKey(GOLDEN.owner),
    newLeafOwner: new PublicKey(GOLDEN.to),
    root: GOLDEN.root,
    dataHash: GOLDEN.dataHash,
    creatorHash: GOLDEN.creatorHash,
    nonce: GOLDEN.leafId,
    index: GOLDEN.leafId,
    proof,
  });
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
    expect(() => parseConcurrentMerkleTreeAccount(Buffer.alloc(10))).toThrow(
      'Invalid merkle tree account',
    );
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
  it('matches the reference instruction data bytes', () => {
    const ix = buildGoldenInstruction();
    expect(ix.programId.equals(BUBBLEGUM_PROGRAM_ID)).toBe(true);
    expect(ix.data.toString('hex')).toBe(GOLDEN.dataHex);
    expect(ix.data.length).toBe(116);
  });

  it('matches the reference account list (owner marked as signer)', () => {
    const ix = buildGoldenInstruction();
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
    expect(
      decodeBubblegumTransferInstruction(buildGoldenInstruction()),
    ).toEqual({
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
    const ix = buildGoldenInstruction([]);
    ix.data.writeUInt8(0, 0);
    expect(decodeBubblegumTransferInstruction(ix)).toBeNull();
  });
});
