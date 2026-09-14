import {
  PublicKey,
  SystemProgram,
  TransactionInstruction,
} from '@solana/web3.js';
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
const NONCE_OFFSET = 8 + HASH_SIZE * 3;
const INDEX_OFFSET = NONCE_OFFSET + 8;

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
  data.writeBigUInt64LE(BigInt(nonce), NONCE_OFFSET);
  data.writeUInt32LE(index, INDEX_OFFSET);

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
  const nonce = Number(instruction.data.readBigUInt64LE(NONCE_OFFSET));
  const index = instruction.data.readUInt32LE(INDEX_OFFSET);
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
