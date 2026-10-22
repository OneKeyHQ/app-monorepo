import { PublicKey, TransactionInstruction } from '@solana/web3.js';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import type { AccountMeta } from '@solana/web3.js';

// Metaplex Core (mpl-core). A Core asset is a single account owned by this
// program: there is no mint and no token account, so the SPL paths never
// apply to it.
export const MPL_CORE_PROGRAM_ID = new PublicKey(
  'CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d',
);

// Account discriminator (`Key` enum, Borsh u8) stored in the first byte.
export enum EMplCoreKey {
  Uninitialized = 0,
  AssetV1 = 1,
  HashedAssetV1 = 2,
  PluginHeaderV1 = 3,
  PluginRegistryV1 = 4,
  CollectionV1 = 5,
}

// `PluginType` enum (Borsh u8); only the variants the wallet inspects.
export enum EMplCorePluginType {
  Royalties = 0,
  FreezeDelegate = 1,
  PermanentFreezeDelegate = 5,
}

// `UpdateAuthority` enum: None | Address(Pubkey) | Collection(Pubkey).
const UPDATE_AUTHORITY_NONE = 0;
const UPDATE_AUTHORITY_ADDRESS = 1;
const UPDATE_AUTHORITY_COLLECTION = 2;

// Plugin `Authority` enum: 0 None, 1 Owner, 2 UpdateAuthority,
// 3 Address { address: Pubkey }. Only the last one carries a payload.
const PLUGIN_AUTHORITY_ADDRESS = 3;

const PUBKEY_SIZE = 32;

// TransferV1 = u8 discriminator + Borsh Option<CompressionProof>; the proof is
// only used for HashedAssetV1, so an AssetV1 transfer is always `None`.
export const MPL_CORE_TRANSFER_V1_DISCRIMINATOR = 14;
const TRANSFER_V1_DATA = Buffer.from([MPL_CORE_TRANSFER_V1_DISCRIMINATOR, 0]);
// asset, collection, payer, authority, newOwner (+ systemProgram, logWrapper).
const TRANSFER_V1_MIN_ACCOUNTS = 5;

const INVALID_ASSET_ERROR = 'Invalid Metaplex Core asset account';

export type IMplCoreUpdateAuthority =
  | { type: 'none' }
  | { type: 'address'; address: string }
  | { type: 'collection'; address: string };

export interface IMplCoreAssetInfo {
  owner: string;
  updateAuthority: IMplCoreUpdateAuthority;
  name: string;
  uri: string;
  // Asset-level FreezeDelegate / PermanentFreezeDelegate state. False when
  // the asset has no plugin registry or the registry cannot be parsed; the
  // program is the final judge either way.
  frozen: boolean;
}

export interface IMplCoreTransferDecoded {
  asset: string;
  collection: string | null;
  payer: string;
  // The signer that authorizes the transfer: the explicit `authority`
  // account, or `payer` when the authority slot carries the placeholder.
  authority: string;
  newOwner: string;
}

class BorshReader {
  offset = 0;

  constructor(private readonly data: Buffer) {}

  private take(size: number): Buffer {
    if (this.offset + size > this.data.length) {
      throw new OneKeyLocalError(INVALID_ASSET_ERROR);
    }
    const out = this.data.subarray(this.offset, this.offset + size);
    this.offset += size;
    return out;
  }

  u8(): number {
    return this.take(1).readUInt8(0);
  }

  u32(): number {
    return this.take(4).readUInt32LE(0);
  }

  skip(size: number) {
    this.take(size);
  }

  pubkey(): string {
    return new PublicKey(this.take(PUBKEY_SIZE)).toBase58();
  }

  string(): string {
    const length = this.u32();
    return this.take(length).toString('utf8');
  }
}

// Reads the frozen flag out of the optional plugin registry that follows the
// asset. Layout (all offsets absolute within the account):
//   PluginHeaderV1 { key u8 = 3, pluginRegistryOffset u64 } right after the asset
//   PluginRegistryV1 { key u8 = 4, Vec<RegistryRecord>, Vec<ExternalRegistryRecord> }
//   RegistryRecord { pluginType u8, authority u8 (+32 for Address), offset u64 }
//   record.offset -> Borsh `Plugin` enum: variant tag u8 + payload ({ frozen: bool }).
function readFrozenFlag(data: Buffer, baseLength: number): boolean {
  if (data.length <= baseLength) {
    return false;
  }
  try {
    if (data.readUInt8(baseLength) !== EMplCoreKey.PluginHeaderV1) {
      return false;
    }
    const registryOffset = Number(data.readBigUInt64LE(baseLength + 1));
    if (data.readUInt8(registryOffset) !== EMplCoreKey.PluginRegistryV1) {
      return false;
    }
    const recordCount = data.readUInt32LE(registryOffset + 1);
    let cursor = registryOffset + 1 + 4;
    let frozen = false;
    for (let i = 0; i < recordCount; i += 1) {
      const pluginType = data.readUInt8(cursor);
      const authorityTag = data.readUInt8(cursor + 1);
      cursor += 2;
      if (authorityTag === PLUGIN_AUTHORITY_ADDRESS) {
        cursor += PUBKEY_SIZE;
      }
      const pluginOffset = Number(data.readBigUInt64LE(cursor));
      cursor += 8;
      if (
        pluginType === EMplCorePluginType.FreezeDelegate ||
        pluginType === EMplCorePluginType.PermanentFreezeDelegate
      ) {
        if (data.readUInt8(pluginOffset) !== pluginType) {
          // The record does not point at the plugin it claims: unknown
          // layout, do not trust anything read from this registry.
          return false;
        }
        if (data.readUInt8(pluginOffset + 1) === 1) {
          frozen = true;
        }
      }
    }
    return frozen;
  } catch {
    // Out-of-range read: malformed or newer layout, leave it to the chain.
    return false;
  }
}

export function parseMplCoreAssetAccount(data: Buffer): IMplCoreAssetInfo {
  const reader = new BorshReader(data);
  const key = reader.u8();
  if (key === EMplCoreKey.HashedAssetV1) {
    throw new OneKeyLocalError(
      'Compressed Metaplex Core asset transfer is not supported yet',
    );
  }
  if (key !== EMplCoreKey.AssetV1) {
    throw new OneKeyLocalError(INVALID_ASSET_ERROR);
  }
  const owner = reader.pubkey();
  const updateAuthorityTag = reader.u8();
  let updateAuthority: IMplCoreUpdateAuthority;
  switch (updateAuthorityTag) {
    case UPDATE_AUTHORITY_NONE:
      updateAuthority = { type: 'none' };
      break;
    case UPDATE_AUTHORITY_ADDRESS:
      updateAuthority = { type: 'address', address: reader.pubkey() };
      break;
    case UPDATE_AUTHORITY_COLLECTION:
      updateAuthority = { type: 'collection', address: reader.pubkey() };
      break;
    default:
      throw new OneKeyLocalError(INVALID_ASSET_ERROR);
  }
  const name = reader.string();
  const uri = reader.string();
  // seq: Option<u64>
  const seqTag = reader.u8();
  if (seqTag === 1) {
    reader.skip(8);
  } else if (seqTag !== 0) {
    throw new OneKeyLocalError(INVALID_ASSET_ERROR);
  }
  return {
    owner,
    updateAuthority,
    name,
    uri,
    frozen: readFrozenFlag(data, reader.offset),
  };
}

export function buildMplCoreTransferInstruction({
  asset,
  collection,
  payer,
  newOwner,
}: {
  asset: PublicKey;
  // Required by the program when the asset's update authority is a
  // collection; omitted otherwise.
  collection?: PublicKey | null;
  payer: PublicKey;
  newOwner: PublicKey;
}): TransactionInstruction {
  // Omitted optional accounts are passed as the program id, which is how the
  // official client and on-chain transfers encode them.
  const placeholder = MPL_CORE_PROGRAM_ID;
  const keys: AccountMeta[] = [
    { pubkey: asset, isSigner: false, isWritable: true },
    { pubkey: collection ?? placeholder, isSigner: false, isWritable: false },
    { pubkey: payer, isSigner: true, isWritable: true },
    // authority: the wallet transfers as the owner, which is also the payer.
    { pubkey: payer, isSigner: true, isWritable: false },
    { pubkey: newOwner, isSigner: false, isWritable: false },
    // systemProgram and logWrapper are only used for HashedAssetV1.
    { pubkey: placeholder, isSigner: false, isWritable: false },
    { pubkey: placeholder, isSigner: false, isWritable: false },
  ];
  return new TransactionInstruction({
    programId: MPL_CORE_PROGRAM_ID,
    keys,
    data: Buffer.from(TRANSFER_V1_DATA),
  });
}

export function decodeMplCoreTransferInstruction(
  instruction: TransactionInstruction,
): IMplCoreTransferDecoded | null {
  if (!instruction.programId.equals(MPL_CORE_PROGRAM_ID)) {
    return null;
  }
  // Only the AssetV1 form (no compression proof) is decoded; a proof means a
  // HashedAssetV1 transfer, which the wallet does not build or display.
  if (!Buffer.from(instruction.data).equals(TRANSFER_V1_DATA)) {
    return null;
  }
  if (instruction.keys.length < TRANSFER_V1_MIN_ACCOUNTS) {
    return null;
  }
  const [asset, collection, payer, authority, newOwner] = instruction.keys;
  const isPlaceholder = (meta: AccountMeta) =>
    meta.pubkey.equals(MPL_CORE_PROGRAM_ID);
  return {
    asset: asset.pubkey.toBase58(),
    collection: isPlaceholder(collection) ? null : collection.pubkey.toBase58(),
    payer: payer.pubkey.toBase58(),
    authority: (isPlaceholder(authority) ? payer : authority).pubkey.toBase58(),
    newOwner: newOwner.pubkey.toBase58(),
  };
}
