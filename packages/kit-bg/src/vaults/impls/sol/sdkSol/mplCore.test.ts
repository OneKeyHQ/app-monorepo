import {
  ComputeBudgetProgram,
  PublicKey,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
} from '@solana/web3.js';

import {
  EMplCoreKey,
  EMplCorePluginType,
  MPL_CORE_PROGRAM_ID,
  buildMplCoreTransferInstruction,
  decodeMplCoreTransferInstruction,
  parseMplCoreAssetAccount,
} from './mplCore';

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

// Appends PluginHeaderV1 + one plugin + PluginRegistryV1 to a bare asset.
function withPlugin({
  base,
  pluginType,
  frozen,
  authorityTag = 1,
  headerKey = EMplCoreKey.PluginHeaderV1,
  pluginTag = pluginType,
}: {
  base: Buffer;
  pluginType: number;
  frozen: boolean;
  authorityTag?: number;
  headerKey?: number;
  pluginTag?: number;
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
    Buffer.from([1, 0, 0, 0]),
    record,
    Buffer.from([0, 0, 0, 0]),
  ]);
  return Buffer.concat([base, header, plugin, registry]);
}

const assetBuffer = Buffer.from(ASSET.hex, 'hex');

describe('parseMplCoreAssetAccount', () => {
  it('parses an AssetV1 in a collection with no plugins', () => {
    expect(parseMplCoreAssetAccount(assetBuffer)).toEqual({
      owner: ASSET.owner,
      updateAuthority: { type: 'collection', address: ASSET.collection },
      name: ASSET.name,
      uri: ASSET.uri,
      frozen: false,
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
    expect(parsed.frozen).toBe(false);
  });

  it('reports frozen for a frozen FreezeDelegate plugin', () => {
    const data = withPlugin({
      base: assetBuffer,
      pluginType: EMplCorePluginType.FreezeDelegate,
      frozen: true,
    });
    expect(parseMplCoreAssetAccount(data).frozen).toBe(true);
  });

  it('reports frozen for a frozen PermanentFreezeDelegate held by an address authority', () => {
    const data = withPlugin({
      base: assetBuffer,
      pluginType: EMplCorePluginType.PermanentFreezeDelegate,
      frozen: true,
      authorityTag: 3,
    });
    expect(parseMplCoreAssetAccount(data).frozen).toBe(true);
  });

  it('does not report frozen for an unfrozen FreezeDelegate plugin', () => {
    const data = withPlugin({
      base: assetBuffer,
      pluginType: EMplCorePluginType.FreezeDelegate,
      frozen: false,
    });
    expect(parseMplCoreAssetAccount(data).frozen).toBe(false);
  });

  it('ignores a plugin registry it cannot parse', () => {
    const badHeader = withPlugin({
      base: assetBuffer,
      pluginType: EMplCorePluginType.FreezeDelegate,
      frozen: true,
      headerKey: 9,
    });
    expect(parseMplCoreAssetAccount(badHeader).frozen).toBe(false);
    const tagMismatch = withPlugin({
      base: assetBuffer,
      pluginType: EMplCorePluginType.FreezeDelegate,
      frozen: true,
      pluginTag: EMplCorePluginType.Royalties,
    });
    expect(parseMplCoreAssetAccount(tagMismatch).frozen).toBe(false);
    const truncated = withPlugin({
      base: assetBuffer,
      pluginType: EMplCorePluginType.FreezeDelegate,
      frozen: true,
    }).subarray(0, assetBuffer.length + 12);
    expect(parseMplCoreAssetAccount(truncated).frozen).toBe(false);
  });

  it('rejects a compressed (HashedAssetV1) account', () => {
    const data = Buffer.from(assetBuffer);
    data.writeUInt8(EMplCoreKey.HashedAssetV1, 0);
    expect(() => parseMplCoreAssetAccount(data)).toThrow(
      'Compressed Metaplex Core asset transfer is not supported yet',
    );
  });

  it('rejects accounts that are not an AssetV1', () => {
    const collection = Buffer.from(assetBuffer);
    collection.writeUInt8(EMplCoreKey.CollectionV1, 0);
    expect(() => parseMplCoreAssetAccount(collection)).toThrow(
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
  it('round-trips a built instruction', () => {
    const ix = buildMplCoreTransferInstruction({
      asset: new PublicKey(ASSET.address),
      collection: new PublicKey(ASSET.collection),
      payer: new PublicKey(TX_EXPLICIT.payer),
      newOwner: new PublicKey(TX_EXPLICIT.newOwner),
    });
    expect(decodeMplCoreTransferInstruction(ix)).toEqual({
      asset: ASSET.address,
      collection: ASSET.collection,
      payer: TX_EXPLICIT.payer,
      authority: TX_EXPLICIT.payer,
      newOwner: TX_EXPLICIT.newOwner,
    });
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

  it('returns null for other programs and other Core instructions', () => {
    const ix = buildMplCoreTransferInstruction({
      asset: new PublicKey(ASSET.address),
      collection: new PublicKey(ASSET.collection),
      payer: new PublicKey(TX_EXPLICIT.payer),
      newOwner: new PublicKey(TX_EXPLICIT.newOwner),
    });
    const otherProgram = new TransactionInstruction({
      programId: new PublicKey(ASSET.owner),
      keys: ix.keys,
      data: ix.data,
    });
    expect(decodeMplCoreTransferInstruction(otherProgram)).toBeNull();
    // BurnV1
    const burn = new TransactionInstruction({
      programId: MPL_CORE_PROGRAM_ID,
      keys: ix.keys,
      data: Buffer.from([12, 0]),
    });
    expect(decodeMplCoreTransferInstruction(burn)).toBeNull();
    // A transfer carrying a compression proof targets a HashedAssetV1.
    const withProof = new TransactionInstruction({
      programId: MPL_CORE_PROGRAM_ID,
      keys: ix.keys,
      data: Buffer.from([14, 1, 0]),
    });
    expect(decodeMplCoreTransferInstruction(withProof)).toBeNull();
    const shortKeys = new TransactionInstruction({
      programId: MPL_CORE_PROGRAM_ID,
      keys: ix.keys.slice(0, 4),
      data: ix.data,
    });
    expect(decodeMplCoreTransferInstruction(shortKeys)).toBeNull();
  });
});
