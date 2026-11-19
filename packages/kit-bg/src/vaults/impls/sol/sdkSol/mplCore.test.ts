import {
  ComputeBudgetProgram,
  PublicKey,
  SystemProgram,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
} from '@solana/web3.js';

import { SPL_NOOP_PROGRAM_ID } from './bubblegum';
import {
  EMplCoreExternalPluginType,
  EMplCoreKey,
  EMplCorePluginType,
  MPL_CORE_LIFECYCLE_EVENT_TRANSFER,
  MPL_CORE_PROGRAM_ID,
  buildMplCoreTransferInstruction,
  decodeMplCoreTransferInstruction,
  isMplCoreAssetFrozen,
  parseMplCoreAssetAccount,
  parseMplCoreCollectionAccount,
} from './mplCore';

import type { AccountMeta } from '@solana/web3.js';

// Golden values fetched from Solana mainnet on 2026-10-22.
// "Collector Crypt Pack #342": AssetV1 in a collection, no plugin registry.
const ASSET = {
  address: '3B8m3HMkNd1Jtc97h9CWzkM5smHbnRVNpToHDcMi36Uu',
  owner: '4kWXxX9qe7bRR4WtaW9MgEVmgbZmgdwLsXmd8EGrKots',
  collection: 'CGq5TajpcznCwkwXp5u99Tv1CmU2Hkb5pEajHxkMn63n',
  name: 'Collector Crypt Pack #342',
  uri: 'https://bafybeigid43zecqrks4e2cjarlmtafppchfqhswgbwoppoup5pgm5qz7n4.ipfs.w3s.link/342.json',
  hex: '0137b86df284aae7496e4e3aab22251874a0cd9a9984afa677c39543006580f23802a77ea107023ec31e21cbbbf776cb98ec021acdb2e320ef20c06b548b6acbb23d19000000436f6c6c6563746f72204372797074205061636b20233334325a00000068747470733a2f2f6261667962656967696434337a656371726b73346532636a61726c6d7461667070636866716873776762776f70706f75703570676d35717a376e342e697066732e7733732e6c696e6b2f3334322e6a736f6e00',
};
// "Collector Crypt Pack" (the collection of ASSET): CollectionV1 with
// Royalties, an unfrozen PermanentFreezeDelegate and UpdateDelegate plugins
// and no external plugins (header at 166, registry at 321).
const COLLECTION = {
  address: ASSET.collection,
  updateAuthority: '81yd9DLAKM7qkBMhiAYQkEeCF7wUzWEj99azQT2yEy6Y',
  name: 'Collector Crypt Pack',
  uri: 'https://bafybeigid43zecqrks4e2cjarlmtafppchfqhswgbwoppoup5pgm5qz7n4.ipfs.w3s.link/collection.json',
  baseLength: 166,
  hex: '056841d51c47b14e3863466759d3879798d2bbc163766ad67200f6e848756a4d4914000000436f6c6c6563746f72204372797074205061636b6100000068747470733a2f2f6261667962656967696434337a656371726b73346532636a61726c6d7461667070636866716873776762776f70706f75703570676d35717a376e342e697066732e7733732e6c696e6b2f636f6c6c656374696f6e2e6a736f6ee8030000e703000003410100000000000000f40103000000321f7444371cb11a574cf90cde9081df3afb455d2fa44ecbc7eca1a8125d241b0006419c064530f6d6426742d93bfccd9b4782db275a9f0a9e694fd295bfcefbed0978662dc29946d38e186c868bb1e9b600d69218c1a203c084dfa1178f58d2789b5b0005000401000000321f7444371cb11a574cf90cde9081df3afb455d2fa44ecbc7eca1a8125d241b04030000000002af0000000000000005021a0100000000000004021c0100000000000000000000',
};
// "Galxe - NFT Brasil onchain": AssetV1 with an address update authority and a
// Royalties plugin (header at 193, registry at 243).
const GALXE = {
  address: '3B8mAHxawViRSBNQ5tvZeM9hxP9C7wmGgonvuRSSh4TT',
  owner: 'H4BwkSxx6VduXN4p9qKbnGzb4FKhphD3cQZRHmN618d2',
  updateAuthority: '2fkUJwvGQ1a6sAjykvQFa9uUnrhVXjw6zyPkK2qHEWar',
  name: 'Galxe - NFT Brasil onchain',
  hex: '01ee8c1b8c7eb76f93064b265e478e3a70102e95407921416366b6897bc19612950118c8e90ac3d522cce1a01a1f20ea44899489df82d95ba00f48e09311a4471a071a00000047616c7865202d204e46542042726173696c206f6e636861696e5c00000068747470733a2f2f677261706869676f2e7072642e67616c6178792e65636f2f6d657461646174612f32666b554a7776475131613673416a796b765146613975556e726856586a77367a79506b4b327148455761722f312e6a736f6e0003f3000000000000000000000100000018c8e90ac3d522cce1a01a1f20ea44899489df82d95ba00f48e09311a4471a07640004010000000002ca0000000000000000000000',
};
// Mainnet tx 3kBMLFrkAeNshbBD1kr8Qi5B7aAvGqWZri2BeBpCCBm4g4Ux4hspu34NHcHkq3M4wYVJqLC8MRXo8ceGxvCjBok3:
// TransferV1 of ASSET from EmwF… to 4kWX…, authority passed explicitly.
const TX_EXPLICIT = {
  payer: 'EmwFVyhorqoTeaJFrzns2cWsh1M9SFhSaEqpSVESMszk',
  newOwner: ASSET.owner,
};
// Mainnet tx 3N3tefWvkdE7aNcPWdQv3fx8jb8tJY1L5zfy9ncjZDHZwVdv74PodkyPMXquWo3jLY1qKgM2Y9AT3bfMMV1fkHjd:
// TransferV1 of ASSET from 4kWX… to H9La…, authority omitted (program id placeholder).
const TX_PLACEHOLDER = {
  payer: ASSET.owner,
  newOwner: 'H9LaoWobbcy2m2hoRJTwvaF7yNMDNTxvWcL8KyBxKBj',
};
const PROGRAM_ID = MPL_CORE_PROGRAM_ID.toBase58();

// ExternalCheckResult flags.
const CAN_LISTEN = 1;
const CAN_REJECT = 4;
// HookableLifecycleEvent variants other than Transfer.
const LIFECYCLE_EVENT_CREATE = 0;
const LIFECYCLE_EVENT_BURN = 2;

function u32(value: number): Buffer {
  const out = Buffer.alloc(4);
  out.writeUInt32LE(value, 0);
  return out;
}

function u64(value: number): Buffer {
  const out = Buffer.alloc(8);
  out.writeBigUInt64LE(BigInt(value), 0);
  return out;
}

// ExternalRegistryRecord held by the update authority, with no data section.
// The parser never dereferences the adapter offset, so it is left at zero.
function externalRecord({
  pluginType,
  lifecycleChecks,
}: {
  pluginType: number;
  lifecycleChecks: Array<[number, number]> | null;
}): Buffer {
  const checks = lifecycleChecks
    ? Buffer.concat([
        Buffer.from([1]),
        u32(lifecycleChecks.length),
        ...lifecycleChecks.map(([event, flags]) =>
          Buffer.concat([Buffer.from([event]), u32(flags)]),
        ),
      ])
    : Buffer.from([0]);
  return Buffer.concat([
    Buffer.from([pluginType, 2]),
    checks,
    u64(0),
    Buffer.from([0]),
    Buffer.from([0]),
  ]);
}

// Appends PluginHeaderV1 + one plugin + PluginRegistryV1 to a bare account.
function withPlugin({
  base,
  pluginType,
  frozen,
  authorityTag = 1,
  headerKey = EMplCoreKey.PluginHeaderV1,
  pluginTag = pluginType,
  externalRecords = [],
}: {
  base: Buffer;
  pluginType: number;
  frozen: boolean;
  authorityTag?: number;
  headerKey?: number;
  pluginTag?: number;
  externalRecords?: Buffer[];
}): Buffer {
  const headerOffset = base.length;
  const pluginOffset = headerOffset + 9;
  const registryOffset = pluginOffset + 2;
  const header = Buffer.alloc(9);
  header.writeUInt8(headerKey, 0);
  header.writeBigUInt64LE(BigInt(registryOffset), 1);
  const plugin = Buffer.from([pluginTag, frozen ? 1 : 0]);
  const record = Buffer.alloc(1 + 1 + (authorityTag === 3 ? 32 : 0) + 8);
  record.writeUInt8(pluginType, 0);
  record.writeUInt8(authorityTag, 1);
  record.writeBigUInt64LE(BigInt(pluginOffset), record.length - 8);
  const registry = Buffer.concat([
    Buffer.from([EMplCoreKey.PluginRegistryV1]),
    u32(1),
    record,
    u32(externalRecords.length),
    ...externalRecords,
  ]);
  return Buffer.concat([base, header, plugin, registry]);
}

const assetBuffer = Buffer.from(ASSET.hex, 'hex');
const collectionBuffer = Buffer.from(COLLECTION.hex, 'hex');
const collectionBase = collectionBuffer.subarray(0, COLLECTION.baseLength);

describe('parseMplCoreAssetAccount', () => {
  it('parses an AssetV1 in a collection with no plugins', () => {
    expect(parseMplCoreAssetAccount(assetBuffer)).toEqual({
      owner: ASSET.owner,
      updateAuthority: { type: 'collection', address: ASSET.collection },
      name: ASSET.name,
      uri: ASSET.uri,
      freezeState: {},
      hasExternalTransferPlugin: false,
    });
  });

  it('parses an AssetV1 with an address update authority and a Royalties registry', () => {
    const parsed = parseMplCoreAssetAccount(Buffer.from(GALXE.hex, 'hex'));
    expect(parsed.owner).toBe(GALXE.owner);
    expect(parsed.updateAuthority).toEqual({
      type: 'address',
      address: GALXE.updateAuthority,
    });
    expect(parsed.name).toBe(GALXE.name);
    expect(parsed.freezeState).toEqual({});
    expect(parsed.hasExternalTransferPlugin).toBe(false);
  });

  it('reports frozen for a frozen FreezeDelegate plugin', () => {
    const data = withPlugin({
      base: assetBuffer,
      pluginType: EMplCorePluginType.FreezeDelegate,
      frozen: true,
    });
    expect(parseMplCoreAssetAccount(data).freezeState).toEqual({
      [EMplCorePluginType.FreezeDelegate]: true,
    });
  });

  it('reports frozen for a frozen PermanentFreezeDelegate held by an address authority', () => {
    const data = withPlugin({
      base: assetBuffer,
      pluginType: EMplCorePluginType.PermanentFreezeDelegate,
      frozen: true,
      authorityTag: 3,
    });
    expect(parseMplCoreAssetAccount(data).freezeState).toEqual({
      [EMplCorePluginType.PermanentFreezeDelegate]: true,
    });
  });

  it('does not report frozen for an unfrozen FreezeDelegate plugin', () => {
    const data = withPlugin({
      base: assetBuffer,
      pluginType: EMplCorePluginType.FreezeDelegate,
      frozen: false,
    });
    expect(parseMplCoreAssetAccount(data).freezeState).toEqual({
      [EMplCorePluginType.FreezeDelegate]: false,
    });
  });

  it('ignores a plugin registry it cannot parse', () => {
    const badHeader = withPlugin({
      base: assetBuffer,
      pluginType: EMplCorePluginType.FreezeDelegate,
      frozen: true,
      headerKey: 9,
    });
    expect(parseMplCoreAssetAccount(badHeader).freezeState).toEqual({});
    const tagMismatch = withPlugin({
      base: assetBuffer,
      pluginType: EMplCorePluginType.FreezeDelegate,
      frozen: true,
      pluginTag: EMplCorePluginType.Royalties,
    });
    expect(parseMplCoreAssetAccount(tagMismatch).freezeState).toEqual({});
    const truncated = withPlugin({
      base: assetBuffer,
      pluginType: EMplCorePluginType.FreezeDelegate,
      frozen: true,
    }).subarray(0, assetBuffer.length + 12);
    expect(parseMplCoreAssetAccount(truncated).freezeState).toEqual({});
  });

  it('reports an external adapter that takes part in Transfer', () => {
    const oracle = withPlugin({
      base: assetBuffer,
      pluginType: EMplCorePluginType.FreezeDelegate,
      frozen: false,
      externalRecords: [
        externalRecord({
          pluginType: EMplCoreExternalPluginType.Oracle,
          lifecycleChecks: [[MPL_CORE_LIFECYCLE_EVENT_TRANSFER, CAN_REJECT]],
        }),
      ],
    });
    expect(parseMplCoreAssetAccount(oracle)).toEqual(
      expect.objectContaining({
        freezeState: { [EMplCorePluginType.FreezeDelegate]: false },
        hasExternalTransferPlugin: true,
      }),
    );
    // A hook that only listens still needs its accounts in the instruction.
    const hook = withPlugin({
      base: assetBuffer,
      pluginType: EMplCorePluginType.FreezeDelegate,
      frozen: true,
      externalRecords: [
        externalRecord({
          pluginType: EMplCoreExternalPluginType.AppData,
          lifecycleChecks: null,
        }),
        externalRecord({
          pluginType: EMplCoreExternalPluginType.LifecycleHook,
          lifecycleChecks: [
            [LIFECYCLE_EVENT_CREATE, CAN_REJECT],
            [MPL_CORE_LIFECYCLE_EVENT_TRANSFER, CAN_LISTEN],
          ],
        }),
      ],
    });
    expect(parseMplCoreAssetAccount(hook)).toEqual(
      expect.objectContaining({
        freezeState: { [EMplCorePluginType.FreezeDelegate]: true },
        hasExternalTransferPlugin: true,
      }),
    );
  });

  it('ignores external adapters that do not act on Transfer', () => {
    const data = withPlugin({
      base: assetBuffer,
      pluginType: EMplCorePluginType.FreezeDelegate,
      frozen: false,
      externalRecords: [
        externalRecord({
          pluginType: EMplCoreExternalPluginType.Oracle,
          lifecycleChecks: [[LIFECYCLE_EVENT_BURN, CAN_REJECT]],
        }),
        externalRecord({
          pluginType: EMplCoreExternalPluginType.AppData,
          lifecycleChecks: null,
        }),
        // Present for Transfer but with no check flags: the program skips it.
        externalRecord({
          pluginType: EMplCoreExternalPluginType.Oracle,
          lifecycleChecks: [[MPL_CORE_LIFECYCLE_EVENT_TRANSFER, 0]],
        }),
      ],
    });
    expect(parseMplCoreAssetAccount(data).hasExternalTransferPlugin).toBe(
      false,
    );
  });

  it('ignores the whole registry when the external records cannot be parsed', () => {
    const data = withPlugin({
      base: assetBuffer,
      pluginType: EMplCorePluginType.FreezeDelegate,
      frozen: true,
      externalRecords: [Buffer.from([EMplCoreExternalPluginType.Oracle, 2])],
    });
    expect(parseMplCoreAssetAccount(data)).toEqual(
      expect.objectContaining({
        freezeState: {},
        hasExternalTransferPlugin: false,
      }),
    );
  });

  it('rejects a compressed (HashedAssetV1) account', () => {
    const data = Buffer.from(assetBuffer);
    data.writeUInt8(EMplCoreKey.HashedAssetV1, 0);
    expect(() => parseMplCoreAssetAccount(data)).toThrow(
      'Compressed Metaplex Core asset transfer is not supported yet',
    );
  });

  it('rejects accounts that are not an AssetV1', () => {
    expect(() => parseMplCoreAssetAccount(collectionBuffer)).toThrow(
      'Invalid Metaplex Core asset account',
    );
    expect(() => parseMplCoreAssetAccount(assetBuffer.subarray(0, 40))).toThrow(
      'Invalid Metaplex Core asset account',
    );
    expect(() => parseMplCoreAssetAccount(Buffer.alloc(0))).toThrow(
      'Invalid Metaplex Core asset account',
    );
  });
});

describe('parseMplCoreCollectionAccount', () => {
  it('parses the mainnet collection and its plugin registry', () => {
    expect(parseMplCoreCollectionAccount(collectionBuffer)).toEqual({
      updateAuthority: COLLECTION.updateAuthority,
      name: COLLECTION.name,
      uri: COLLECTION.uri,
      freezeState: { [EMplCorePluginType.PermanentFreezeDelegate]: false },
      hasExternalTransferPlugin: false,
    });
  });

  it('reports a frozen collection-level PermanentFreezeDelegate', () => {
    const data = withPlugin({
      base: collectionBase,
      pluginType: EMplCorePluginType.PermanentFreezeDelegate,
      frozen: true,
    });
    expect(parseMplCoreCollectionAccount(data).freezeState).toEqual({
      [EMplCorePluginType.PermanentFreezeDelegate]: true,
    });
  });

  it('reports a collection-level Oracle on Transfer', () => {
    const data = withPlugin({
      base: collectionBase,
      pluginType: EMplCorePluginType.Royalties,
      frozen: false,
      externalRecords: [
        externalRecord({
          pluginType: EMplCoreExternalPluginType.Oracle,
          lifecycleChecks: [[MPL_CORE_LIFECYCLE_EVENT_TRANSFER, CAN_REJECT]],
        }),
      ],
    });
    expect(parseMplCoreCollectionAccount(data).hasExternalTransferPlugin).toBe(
      true,
    );
  });

  it('rejects accounts that are not a CollectionV1', () => {
    expect(() => parseMplCoreCollectionAccount(assetBuffer)).toThrow(
      'Invalid Metaplex Core collection account',
    );
    expect(() =>
      parseMplCoreCollectionAccount(collectionBuffer.subarray(0, 40)),
    ).toThrow('Invalid Metaplex Core collection account');
  });
});

describe('isMplCoreAssetFrozen', () => {
  const { FreezeDelegate, PermanentFreezeDelegate } = EMplCorePluginType;
  const state = (
    freezeState: Partial<Record<EMplCorePluginType, boolean>>,
  ) => ({
    freezeState,
    hasExternalTransferPlugin: false,
  });

  it('is frozen when any plugin on the asset is frozen', () => {
    expect(isMplCoreAssetFrozen({ asset: state({}) })).toBe(false);
    expect(
      isMplCoreAssetFrozen({ asset: state({ [FreezeDelegate]: false }) }),
    ).toBe(false);
    expect(
      isMplCoreAssetFrozen({ asset: state({ [FreezeDelegate]: true }) }),
    ).toBe(true);
    expect(
      isMplCoreAssetFrozen({
        asset: state({
          [FreezeDelegate]: false,
          [PermanentFreezeDelegate]: true,
        }),
      }),
    ).toBe(true);
  });

  it('applies a frozen collection plugin only when the asset has none of that type', () => {
    const frozenCollection = state({ [PermanentFreezeDelegate]: true });
    expect(
      isMplCoreAssetFrozen({ asset: state({}), collection: frozenCollection }),
    ).toBe(true);
    // Plugins on the asset override the collection plugins.
    expect(
      isMplCoreAssetFrozen({
        asset: state({ [PermanentFreezeDelegate]: false }),
        collection: frozenCollection,
      }),
    ).toBe(false);
    // A different plugin type does not override it.
    expect(
      isMplCoreAssetFrozen({
        asset: state({ [FreezeDelegate]: false }),
        collection: frozenCollection,
      }),
    ).toBe(true);
    expect(
      isMplCoreAssetFrozen({
        asset: state({}),
        collection: state({ [PermanentFreezeDelegate]: false }),
      }),
    ).toBe(false);
  });
});

describe('buildMplCoreTransferInstruction', () => {
  it('matches the mainnet TransferV1 layout for an asset in a collection', () => {
    const ix = buildMplCoreTransferInstruction({
      asset: new PublicKey(ASSET.address),
      collection: new PublicKey(ASSET.collection),
      payer: new PublicKey(TX_EXPLICIT.payer),
      newOwner: new PublicKey(TX_EXPLICIT.newOwner),
    });
    expect(ix.programId.toBase58()).toBe(PROGRAM_ID);
    expect(Buffer.from(ix.data).toString('hex')).toBe('0e00');
    expect(
      ix.keys.map((k) => [k.pubkey.toBase58(), k.isSigner, k.isWritable]),
    ).toEqual([
      [ASSET.address, false, true],
      [ASSET.collection, false, false],
      [TX_EXPLICIT.payer, true, true],
      [TX_EXPLICIT.payer, true, false],
      [TX_EXPLICIT.newOwner, false, false],
      [PROGRAM_ID, false, false],
      [PROGRAM_ID, false, false],
    ]);
  });

  it('compiles with the payer as the only signer despite the duplicate authority key', () => {
    const payer = new PublicKey(TX_EXPLICIT.payer);
    const transfer = buildMplCoreTransferInstruction({
      asset: new PublicKey(ASSET.address),
      collection: new PublicKey(ASSET.collection),
      payer,
      newOwner: new PublicKey(TX_EXPLICIT.newOwner),
    });
    const message = new TransactionMessage({
      payerKey: payer,
      recentBlockhash: PublicKey.default.toString(),
      instructions: [
        ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1 }),
        transfer,
      ],
    }).compileToV0Message([]);
    expect(message.header.numRequiredSignatures).toBe(1);
    expect(
      message.staticAccountKeys.filter((k) => k.equals(payer)),
    ).toHaveLength(1);
    // Mainnet transfers of this asset are 3-5 accounts + 2 bytes of data.
    expect(new VersionedTransaction(message).serialize().length).toBeLessThan(
      400,
    );
  });

  it('passes the program id placeholder when the asset has no collection', () => {
    const ix = buildMplCoreTransferInstruction({
      asset: new PublicKey(GALXE.address),
      collection: null,
      payer: new PublicKey(GALXE.owner),
      newOwner: new PublicKey(TX_PLACEHOLDER.newOwner),
    });
    expect(ix.keys[1].pubkey.toBase58()).toBe(PROGRAM_ID);
    expect(ix.keys).toHaveLength(7);
  });
});

describe('decodeMplCoreTransferInstruction', () => {
  const built = buildMplCoreTransferInstruction({
    asset: new PublicKey(ASSET.address),
    collection: new PublicKey(ASSET.collection),
    payer: new PublicKey(TX_EXPLICIT.payer),
    newOwner: new PublicKey(TX_EXPLICIT.newOwner),
  });
  const decodedBuilt = {
    asset: ASSET.address,
    collection: ASSET.collection,
    payer: TX_EXPLICIT.payer,
    authority: TX_EXPLICIT.payer,
    newOwner: TX_EXPLICIT.newOwner,
  };

  // Same instruction with `keys` replaced.
  function withKeys(keys: AccountMeta[]): TransactionInstruction {
    return new TransactionInstruction({
      programId: built.programId,
      keys,
      data: built.data,
    });
  }

  function replaceKey(index: number, patch: Partial<AccountMeta>) {
    return built.keys.map((meta, i) =>
      i === index ? { ...meta, ...patch } : meta,
    );
  }

  it('round-trips a built instruction', () => {
    expect(decodeMplCoreTransferInstruction(built)).toEqual(decodedBuilt);
  });

  it('treats a placeholder authority as the payer', () => {
    const ix = new TransactionInstruction({
      programId: MPL_CORE_PROGRAM_ID,
      keys: [
        {
          pubkey: new PublicKey(ASSET.address),
          isSigner: false,
          isWritable: true,
        },
        {
          pubkey: new PublicKey(ASSET.collection),
          isSigner: false,
          isWritable: false,
        },
        {
          pubkey: new PublicKey(TX_PLACEHOLDER.payer),
          isSigner: true,
          isWritable: true,
        },
        { pubkey: MPL_CORE_PROGRAM_ID, isSigner: false, isWritable: false },
        {
          pubkey: new PublicKey(TX_PLACEHOLDER.newOwner),
          isSigner: false,
          isWritable: false,
        },
        { pubkey: MPL_CORE_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: MPL_CORE_PROGRAM_ID, isSigner: false, isWritable: false },
      ],
      data: Buffer.from([14, 0]),
    });
    expect(decodeMplCoreTransferInstruction(ix)).toEqual({
      asset: ASSET.address,
      collection: ASSET.collection,
      payer: TX_PLACEHOLDER.payer,
      authority: TX_PLACEHOLDER.payer,
      newOwner: TX_PLACEHOLDER.newOwner,
    });
  });

  it('decodes a transfer without a collection', () => {
    const ix = buildMplCoreTransferInstruction({
      asset: new PublicKey(GALXE.address),
      collection: null,
      payer: new PublicKey(GALXE.owner),
      newOwner: new PublicKey(TX_PLACEHOLDER.newOwner),
    });
    expect(decodeMplCoreTransferInstruction(ix)?.collection).toBeNull();
  });

  it('accepts the real system and noop programs in the optional slots', () => {
    const keys = replaceKey(5, { pubkey: SystemProgram.programId });
    keys[6] = { ...keys[6], pubkey: SPL_NOOP_PROGRAM_ID };
    expect(decodeMplCoreTransferInstruction(withKeys(keys))).toEqual(
      decodedBuilt,
    );
  });

  it('leaves a transfer carrying remaining accounts to the server-parsed view', () => {
    // An Oracle / LifecycleHook account appended after the seven base slots.
    const oracleAccount: AccountMeta = {
      pubkey: new PublicKey(GALXE.updateAuthority),
      isSigner: false,
      isWritable: false,
    };
    expect(
      decodeMplCoreTransferInstruction(
        withKeys([...built.keys, oracleAccount]),
      ),
    ).toBeNull();
  });

  it('rejects layouts the wallet does not produce', () => {
    // Payer must sign.
    expect(
      decodeMplCoreTransferInstruction(
        withKeys(replaceKey(2, { isSigner: false })),
      ),
    ).toBeNull();
    // An explicit authority must sign.
    expect(
      decodeMplCoreTransferInstruction(
        withKeys(replaceKey(3, { isSigner: false })),
      ),
    ).toBeNull();
    // The asset is rewritten by the transfer.
    expect(
      decodeMplCoreTransferInstruction(
        withKeys(replaceKey(0, { isWritable: false })),
      ),
    ).toBeNull();
    // Unknown program in an optional program slot.
    expect(
      decodeMplCoreTransferInstruction(
        withKeys(
          replaceKey(5, { pubkey: new PublicKey(GALXE.updateAuthority) }),
        ),
      ),
    ).toBeNull();
    expect(
      decodeMplCoreTransferInstruction(
        withKeys(
          replaceKey(6, { pubkey: new PublicKey(GALXE.updateAuthority) }),
        ),
      ),
    ).toBeNull();
  });

  it('returns null for other programs and other Core instructions', () => {
    const otherProgram = new TransactionInstruction({
      programId: new PublicKey(ASSET.owner),
      keys: built.keys,
      data: built.data,
    });
    expect(decodeMplCoreTransferInstruction(otherProgram)).toBeNull();
    // BurnV1
    const burn = new TransactionInstruction({
      programId: MPL_CORE_PROGRAM_ID,
      keys: built.keys,
      data: Buffer.from([12, 0]),
    });
    expect(decodeMplCoreTransferInstruction(burn)).toBeNull();
    // A transfer carrying a compression proof targets a HashedAssetV1.
    const withProof = new TransactionInstruction({
      programId: MPL_CORE_PROGRAM_ID,
      keys: built.keys,
      data: Buffer.from([14, 1, 0]),
    });
    expect(decodeMplCoreTransferInstruction(withProof)).toBeNull();
    expect(
      decodeMplCoreTransferInstruction(withKeys(built.keys.slice(0, 4))),
    ).toBeNull();
  });
});
