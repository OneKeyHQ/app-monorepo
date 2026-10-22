import {
  PublicKey,
  SystemProgram,
  TransactionInstruction,
} from '@solana/web3.js';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import { SPL_NOOP_PROGRAM_ID } from './bubblegum';

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

// `ExternalPluginAdapterType` enum (Borsh u8); only used by tests to build
// registries, the parser treats every adapter type the same way.
export enum EMplCoreExternalPluginType {
  LifecycleHook = 0,
  Oracle = 1,
  AppData = 2,
  LinkedLifecycleHook = 3,
  LinkedAppData = 4,
  DataSection = 5,
}

// `HookableLifecycleEvent` enum (Borsh u8): Create, Transfer, Burn, Update,
// Execute.
export const MPL_CORE_LIFECYCLE_EVENT_TRANSFER = 1;

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
// asset, collection, payer, authority, newOwner, systemProgram, logWrapper.
// The program reads exactly these seven; anything after them is the
// `remaining_accounts` consumed by external plugin adapters.
const TRANSFER_V1_ACCOUNTS = 7;

const INVALID_ASSET_ERROR = 'Invalid Metaplex Core asset account';
const INVALID_COLLECTION_ERROR = 'Invalid Metaplex Core collection account';

export type IMplCoreUpdateAuthority =
  | { type: 'none' }
  | { type: 'address'; address: string }
  | { type: 'collection'; address: string };

// Plugin-registry state shared by assets and collections. Both flags are
// false when there is no plugin registry or it cannot be parsed; the program
// is the final judge either way.
export interface IMplCorePluginState {
  // FreezeDelegate / PermanentFreezeDelegate state.
  frozen: boolean;
  // An external plugin adapter (Oracle, LifecycleHook, ...) takes part in the
  // Transfer lifecycle. The program then expects extra accounts the wallet
  // does not derive, so such transfers cannot be built locally.
  hasExternalTransferPlugin: boolean;
}

export interface IMplCoreAssetInfo extends IMplCorePluginState {
  owner: string;
  updateAuthority: IMplCoreUpdateAuthority;
  name: string;
  uri: string;
}

export interface IMplCoreCollectionInfo extends IMplCorePluginState {
  updateAuthority: string;
  name: string;
  uri: string;
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

  constructor(
    private readonly data: Buffer,
    private readonly invalidError: string,
  ) {}

  private take(size: number): Buffer {
    if (this.offset + size > this.data.length) {
      throw new OneKeyLocalError(this.invalidError);
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

  u64(): number {
    return Number(this.take(8).readBigUInt64LE(0));
  }

  // Borsh `Option` tag; anything but 0 / 1 is a malformed layout.
  option(): boolean {
    const tag = this.u8();
    if (tag > 1) {
      throw new OneKeyLocalError(this.invalidError);
    }
    return tag === 1;
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

function skipPluginAuthority(reader: BorshReader) {
  if (reader.u8() === PLUGIN_AUTHORITY_ADDRESS) {
    reader.skip(PUBKEY_SIZE);
  }
}

// Reads the plugin state out of the optional plugin registry that follows the
// base account. Layout (all offsets absolute within the account):
//   PluginHeaderV1 { key u8 = 3, pluginRegistryOffset u64 } right after the base
//   PluginRegistryV1 { key u8 = 4, Vec<RegistryRecord>, Vec<ExternalRegistryRecord> }
//   RegistryRecord { pluginType u8, authority, offset u64 }
//   ExternalRegistryRecord { pluginType u8, authority,
//     lifecycleChecks Option<Vec<(event u8, checkResult u32)>>,
//     offset u64, dataOffset Option<u64>, dataLen Option<u64> }
//   record.offset -> Borsh `Plugin` enum: variant tag u8 + payload ({ frozen: bool }).
function readPluginState(
  data: Buffer,
  baseLength: number,
): IMplCorePluginState {
  const none: IMplCorePluginState = {
    frozen: false,
    hasExternalTransferPlugin: false,
  };
  if (data.length <= baseLength) {
    return none;
  }
  try {
    const reader = new BorshReader(data, INVALID_ASSET_ERROR);
    reader.offset = baseLength;
    if (reader.u8() !== EMplCoreKey.PluginHeaderV1) {
      return none;
    }
    reader.offset = reader.u64();
    if (reader.u8() !== EMplCoreKey.PluginRegistryV1) {
      return none;
    }
    let frozen = false;
    const recordCount = reader.u32();
    for (let i = 0; i < recordCount; i += 1) {
      const pluginType = reader.u8();
      skipPluginAuthority(reader);
      const pluginOffset = reader.u64();
      if (
        pluginType === EMplCorePluginType.FreezeDelegate ||
        pluginType === EMplCorePluginType.PermanentFreezeDelegate
      ) {
        if (data.readUInt8(pluginOffset) !== pluginType) {
          // The record does not point at the plugin it claims: unknown
          // layout, do not trust anything read from this registry.
          return none;
        }
        if (data.readUInt8(pluginOffset + 1) === 1) {
          frozen = true;
        }
      }
    }
    let hasExternalTransferPlugin = false;
    const externalCount = reader.u32();
    for (let i = 0; i < externalCount; i += 1) {
      reader.u8(); // ExternalPluginAdapterType
      skipPluginAuthority(reader);
      if (reader.option()) {
        const checkCount = reader.u32();
        for (let j = 0; j < checkCount; j += 1) {
          const event = reader.u8();
          // ExternalCheckResult { flags: u32 } = CAN_LISTEN | CAN_APPROVE |
          // CAN_REJECT; the program skips the adapter when no flag is set.
          const flags = reader.u32();
          if (event === MPL_CORE_LIFECYCLE_EVENT_TRANSFER && flags !== 0) {
            hasExternalTransferPlugin = true;
          }
        }
      }
      reader.u64(); // offset
      if (reader.option()) {
        reader.u64(); // dataOffset
      }
      if (reader.option()) {
        reader.u64(); // dataLen
      }
    }
    return { frozen, hasExternalTransferPlugin };
  } catch {
    // Out-of-range read: malformed or newer layout, leave it to the chain.
    return none;
  }
}

export function parseMplCoreAssetAccount(data: Buffer): IMplCoreAssetInfo {
  const reader = new BorshReader(data, INVALID_ASSET_ERROR);
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
  if (reader.option()) {
    reader.skip(8);
  }
  return {
    owner,
    updateAuthority,
    name,
    uri,
    ...readPluginState(data, reader.offset),
  };
}

// CollectionV1 { key u8 = 5, updateAuthority Pubkey, name String, uri String,
// numMinted u32, currentSize u32 } followed by the same optional plugin
// registry as an asset. Collection-level plugins apply to every asset in it.
export function parseMplCoreCollectionAccount(
  data: Buffer,
): IMplCoreCollectionInfo {
  const reader = new BorshReader(data, INVALID_COLLECTION_ERROR);
  if (reader.u8() !== EMplCoreKey.CollectionV1) {
    throw new OneKeyLocalError(INVALID_COLLECTION_ERROR);
  }
  const updateAuthority = reader.pubkey();
  const name = reader.string();
  const uri = reader.string();
  reader.skip(8); // numMinted, currentSize
  return {
    updateAuthority,
    name,
    uri,
    ...readPluginState(data, reader.offset),
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
  // Extra accounts feed external plugin adapters (Oracle, LifecycleHook) that
  // run inside the transfer; the wallet cannot show what they do, so only the
  // bare layout is decoded locally and anything else is left to the
  // server-parsed view.
  if (instruction.keys.length !== TRANSFER_V1_ACCOUNTS) {
    return null;
  }
  const [
    asset,
    collection,
    payer,
    authority,
    newOwner,
    systemProgram,
    logWrapper,
  ] = instruction.keys;
  const isPlaceholder = (meta: AccountMeta) =>
    meta.pubkey.equals(MPL_CORE_PROGRAM_ID);
  // Flags and optional accounts the program requires for a plain transfer;
  // anything else is not a layout this wallet produces.
  if (!asset.isWritable || !payer.isSigner) {
    return null;
  }
  if (!isPlaceholder(authority) && !authority.isSigner) {
    return null;
  }
  if (
    !isPlaceholder(systemProgram) &&
    !systemProgram.pubkey.equals(SystemProgram.programId)
  ) {
    return null;
  }
  if (
    !isPlaceholder(logWrapper) &&
    !logWrapper.pubkey.equals(SPL_NOOP_PROGRAM_ID)
  ) {
    return null;
  }
  return {
    asset: asset.pubkey.toBase58(),
    collection: isPlaceholder(collection) ? null : collection.pubkey.toBase58(),
    payer: payer.pubkey.toBase58(),
    authority: (isPlaceholder(authority) ? payer : authority).pubkey.toBase58(),
    newOwner: newOwner.pubkey.toBase58(),
  };
}
