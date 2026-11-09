import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import {
  PublicKey,
  SystemProgram,
  TransactionInstruction,
} from '@solana/web3.js';

// Importing the vault pulls in the localDb singleton, whose constructor opens
// IndexedDB at module load and crashes under jest's node environment.
jest.mock('../../../dbs/local/localDbInstance', () => ({
  __esModule: true,
  default: {},
}));

/* eslint-disable import/first */
import { EMplCorePluginType, MPL_CORE_PROGRAM_ID } from './sdkSol/mplCore';
import SolVault from './Vault';

import type {
  IMplCoreAssetInfo,
  IMplCoreCollectionInfo,
} from './sdkSol/mplCore';
import type { IDasAsset } from './types';
/* eslint-enable import/first */

// Mainnet "Collector Crypt Pack #342" (fetched 2026-10-22): AssetV1 owned by
// OWNER inside collection COLLECTION, no plugin registry.
const ASSET_ID = '3B8m3HMkNd1Jtc97h9CWzkM5smHbnRVNpToHDcMi36Uu';
const OWNER = '4kWXxX9qe7bRR4WtaW9MgEVmgbZmgdwLsXmd8EGrKots';
const COLLECTION = 'CGq5TajpcznCwkwXp5u99Tv1CmU2Hkb5pEajHxkMn63n';
const TO = 'HNDXEEzC1txmsRBstERLKgKJmBh7M8bvwxrpbBHAwHt6';
// A Transfer Delegate that is neither the owner nor the recipient.
const DELEGATE = 'EmwFVyhorqoTeaJFrzns2cWsh1M9SFhSaEqpSVESMszk';
const ASSET_HEX =
  '0137b86df284aae7496e4e3aab22251874a0cd9a9984afa677c39543006580f23802a77ea107023ec31e21cbbbf776cb98ec021acdb2e320ef20c06b548b6acbb23d19000000436f6c6c6563746f72204372797074205061636b20233334325a00000068747470733a2f2f6261667962656967696434337a656371726b73346532636a61726c6d7461667070636866716873776762776f70706f75703570676d35717a376e342e697066732e7733732e6c696e6b2f3334322e6a736f6e00';
// The collection account of ASSET_ID (fetched 2026-10-22): Royalties, an
// unfrozen PermanentFreezeDelegate and UpdateDelegate, no external plugins.
const COLLECTION_UPDATE_AUTHORITY =
  '81yd9DLAKM7qkBMhiAYQkEeCF7wUzWEj99azQT2yEy6Y';
const COLLECTION_HEX =
  '056841d51c47b14e3863466759d3879798d2bbc163766ad67200f6e848756a4d4914000000436f6c6c6563746f72204372797074205061636b6100000068747470733a2f2f6261667962656967696434337a656371726b73346532636a61726c6d7461667070636866716873776762776f70706f75703570676d35717a376e342e697066732e7733732e6c696e6b2f636f6c6c656374696f6e2e6a736f6ee8030000e703000003410100000000000000f40103000000321f7444371cb11a574cf90cde9081df3afb455d2fa44ecbc7eca1a8125d241b0006419c064530f6d6426742d93bfccd9b4782db275a9f0a9e694fd295bfcefbed0978662dc29946d38e186c868bb1e9b600d69218c1a203c084dfa1178f58d2789b5b0005000401000000321f7444371cb11a574cf90cde9081df3afb455d2fa44ecbc7eca1a8125d241b04030000000002af0000000000000005021a0100000000000004021c0100000000000000000000';
const SPL_MINT = 'So11111111111111111111111111111111111111112';

const coreAssetInfo: IMplCoreAssetInfo = {
  owner: OWNER,
  updateAuthority: { type: 'collection', address: COLLECTION },
  name: 'Collector Crypt Pack #342',
  uri: 'https://example.com/342.json',
  freezeState: {},
  hasExternalTransferPlugin: false,
};

const coreCollectionInfo: IMplCoreCollectionInfo = {
  updateAuthority: COLLECTION_UPDATE_AUTHORITY,
  name: 'Collector Crypt Pack',
  uri: 'https://example.com/collection.json',
  freezeState: {},
  hasExternalTransferPlugin: false,
};

const dasCoreAsset: IDasAsset = {
  id: ASSET_ID,
  interface: 'MplCoreAsset',
  burnt: false,
  ownership: {
    owner: OWNER,
    delegate: null,
    delegated: false,
    frozen: false,
    ownership_model: 'single',
  },
  content: {
    metadata: { name: 'Collector Crypt Pack #342', symbol: 'CCP' },
    links: { image: 'https://example.com/pack.png' },
  },
};

function buildCoreAccountInfo(hex = ASSET_HEX) {
  return {
    data: [Buffer.from(hex, 'hex').toString('base64'), 'base64'] as [
      string,
      string,
    ],
    executable: false,
    lamports: 1_615_440,
    owner: MPL_CORE_PROGRAM_ID.toBase58(),
  };
}

// getAccountInfo serving the asset and its collection; anything else is
// missing.
function mockCoreAccounts() {
  return jest.fn().mockImplementation(({ address }: { address: string }) => {
    if (address === ASSET_ID) {
      return Promise.resolve(buildCoreAccountInfo());
    }
    if (address === COLLECTION) {
      return Promise.resolve(buildCoreAccountInfo(COLLECTION_HEX));
    }
    return Promise.resolve(null);
  });
}

type IMockClient = {
  getAsset?: jest.Mock;
  getAccountInfo?: jest.Mock;
  getTokenAccountsByOwner?: jest.Mock;
};

function buildVault(client: IMockClient) {
  const vault = Object.create(SolVault.prototype) as SolVault;
  vault.networkId = 'sol--101';
  vault.accountId = "hd-1--m/44'/501'/0'/0'";
  vault.getClient = jest.fn().mockResolvedValue(client) as never;
  return vault;
}

describe('SolVault._resolveMplCoreAsset', () => {
  it('returns the parsed asset for an account owned by the Core program', async () => {
    const getAccountInfo = jest.fn().mockResolvedValue(buildCoreAccountInfo());
    const vault = buildVault({ getAccountInfo });
    await expect(
      vault._resolveMplCoreAsset({ assetId: ASSET_ID }),
    ).resolves.toEqual({
      owner: OWNER,
      updateAuthority: { type: 'collection', address: COLLECTION },
      name: 'Collector Crypt Pack #342',
      uri: 'https://bafybeigid43zecqrks4e2cjarlmtafppchfqhswgbwoppoup5pgm5qz7n4.ipfs.w3s.link/342.json',
      freezeState: {},
      hasExternalTransferPlugin: false,
    });
    expect(getAccountInfo).toHaveBeenCalledWith({
      address: ASSET_ID,
      encoding: 'base64',
    });
  });

  it('returns null when the account does not exist', async () => {
    const getAccountInfo = jest.fn().mockResolvedValue(null);
    const vault = buildVault({ getAccountInfo });
    await expect(
      vault._resolveMplCoreAsset({ assetId: ASSET_ID }),
    ).resolves.toBeNull();
  });

  it('returns null when the account belongs to another program', async () => {
    const getAccountInfo = jest.fn().mockResolvedValue({
      ...buildCoreAccountInfo(),
      owner: TOKEN_PROGRAM_ID.toBase58(),
    });
    const vault = buildVault({ getAccountInfo });
    await expect(
      vault._resolveMplCoreAsset({ assetId: SPL_MINT }),
    ).resolves.toBeNull();
  });

  it('rejects a compressed Core asset with a clear error', async () => {
    const hashed = Buffer.from(ASSET_HEX, 'hex');
    hashed.writeUInt8(2, 0);
    const getAccountInfo = jest
      .fn()
      .mockResolvedValue(buildCoreAccountInfo(hashed.toString('hex')));
    const vault = buildVault({ getAccountInfo });
    await expect(
      vault._resolveMplCoreAsset({ assetId: ASSET_ID }),
    ).rejects.toThrow(
      'Compressed Metaplex Core asset transfer is not supported yet',
    );
  });
});

describe('SolVault._resolveMplCoreCollection', () => {
  it('returns the parsed collection with its plugin state', async () => {
    const getAccountInfo = mockCoreAccounts();
    const vault = buildVault({ getAccountInfo });
    await expect(
      vault._resolveMplCoreCollection({ address: COLLECTION }),
    ).resolves.toEqual({
      updateAuthority: COLLECTION_UPDATE_AUTHORITY,
      name: 'Collector Crypt Pack',
      uri: 'https://bafybeigid43zecqrks4e2cjarlmtafppchfqhswgbwoppoup5pgm5qz7n4.ipfs.w3s.link/collection.json',
      // The mainnet collection carries an unfrozen PermanentFreezeDelegate.
      freezeState: { [EMplCorePluginType.PermanentFreezeDelegate]: false },
      hasExternalTransferPlugin: false,
    });
  });

  it('returns null when the collection account is missing', async () => {
    const vault = buildVault({ getAccountInfo: mockCoreAccounts() });
    await expect(
      vault._resolveMplCoreCollection({ address: TO }),
    ).resolves.toBeNull();
  });

  it('rejects an account that is not a CollectionV1', async () => {
    const vault = buildVault({ getAccountInfo: mockCoreAccounts() });
    await expect(
      vault._resolveMplCoreCollection({ address: ASSET_ID }),
    ).rejects.toThrow('Invalid Metaplex Core collection account');
  });
});

describe('SolVault._buildMplCoreNFTInstructions', () => {
  it('builds a single TransferV1 carrying the collection', () => {
    const vault = buildVault({});
    const instructions = vault._buildMplCoreNFTInstructions({
      asset: coreAssetInfo,
      collection: coreCollectionInfo,
      assetId: new PublicKey(ASSET_ID),
      source: new PublicKey(OWNER),
      destination: new PublicKey(TO),
    });
    expect(instructions).toHaveLength(1);
    const [ix] = instructions;
    expect(ix.programId.equals(MPL_CORE_PROGRAM_ID)).toBe(true);
    expect(ix.keys.map((k) => k.pubkey.toBase58())).toEqual([
      ASSET_ID,
      COLLECTION,
      OWNER,
      OWNER,
      TO,
      MPL_CORE_PROGRAM_ID.toBase58(),
      MPL_CORE_PROGRAM_ID.toBase58(),
    ]);
    expect(ix.keys[2].isSigner).toBe(true);
    expect(ix.keys[0].isWritable).toBe(true);
  });

  it('omits the collection for an asset with an address update authority', () => {
    const vault = buildVault({});
    const [ix] = vault._buildMplCoreNFTInstructions({
      asset: {
        ...coreAssetInfo,
        updateAuthority: { type: 'address', address: TO },
      },
      collection: null,
      assetId: new PublicKey(ASSET_ID),
      source: new PublicKey(OWNER),
      destination: new PublicKey(TO),
    });
    expect(ix.keys[1].pubkey.equals(MPL_CORE_PROGRAM_ID)).toBe(true);
  });

  it('rejects when the sender does not own the asset', () => {
    const vault = buildVault({});
    expect(() =>
      vault._buildMplCoreNFTInstructions({
        asset: coreAssetInfo,
        collection: coreCollectionInfo,
        assetId: new PublicKey(ASSET_ID),
        source: new PublicKey(TO),
        destination: new PublicKey(OWNER),
      }),
    ).toThrow('Metaplex Core NFT is not owned by the sender');
  });

  it('rejects a frozen asset or a frozen collection', () => {
    const vault = buildVault({});
    const params = {
      assetId: new PublicKey(ASSET_ID),
      source: new PublicKey(OWNER),
      destination: new PublicKey(TO),
    };
    expect(() =>
      vault._buildMplCoreNFTInstructions({
        ...params,
        asset: {
          ...coreAssetInfo,
          freezeState: { [EMplCorePluginType.FreezeDelegate]: true },
        },
        collection: coreCollectionInfo,
      }),
    ).toThrow('Metaplex Core NFT is frozen and cannot be transferred');
    expect(() =>
      vault._buildMplCoreNFTInstructions({
        ...params,
        asset: coreAssetInfo,
        collection: {
          ...coreCollectionInfo,
          freezeState: { [EMplCorePluginType.PermanentFreezeDelegate]: true },
        },
      }),
    ).toThrow('Metaplex Core NFT is frozen and cannot be transferred');
  });

  it('lets the asset override a frozen collection-level PermanentFreezeDelegate', () => {
    const vault = buildVault({});
    const instructions = vault._buildMplCoreNFTInstructions({
      asset: {
        ...coreAssetInfo,
        freezeState: { [EMplCorePluginType.PermanentFreezeDelegate]: false },
      },
      collection: {
        ...coreCollectionInfo,
        freezeState: { [EMplCorePluginType.PermanentFreezeDelegate]: true },
      },
      assetId: new PublicKey(ASSET_ID),
      source: new PublicKey(OWNER),
      destination: new PublicKey(TO),
    });
    expect(instructions).toHaveLength(1);
  });

  it('rejects an asset or collection with an external Transfer plugin', () => {
    const vault = buildVault({});
    const params = {
      assetId: new PublicKey(ASSET_ID),
      source: new PublicKey(OWNER),
      destination: new PublicKey(TO),
    };
    const error =
      'Metaplex Core NFT with an Oracle or lifecycle hook plugin is not supported yet';
    expect(() =>
      vault._buildMplCoreNFTInstructions({
        ...params,
        asset: { ...coreAssetInfo, hasExternalTransferPlugin: true },
        collection: coreCollectionInfo,
      }),
    ).toThrow(error);
    expect(() =>
      vault._buildMplCoreNFTInstructions({
        ...params,
        asset: coreAssetInfo,
        collection: { ...coreCollectionInfo, hasExternalTransferPlugin: true },
      }),
    ).toThrow(error);
  });
});

describe('SolVault._buildInstructionsForTransfer routing', () => {
  function buildTransferInfo(nftAddress: string) {
    return {
      from: OWNER,
      to: TO,
      amount: '1',
      nftInfo: {
        nftId: '',
        nftAddress,
        nftType: 'ERC-721' as never,
      },
    };
  }

  it('routes a Core asset to TransferV1 after checking its collection', async () => {
    const getAsset = jest.fn().mockResolvedValue(dasCoreAsset);
    const getAccountInfo = mockCoreAccounts();
    const getTokenAccountsByOwner = jest.fn();
    const client = { getAsset, getAccountInfo, getTokenAccountsByOwner };
    const vault = buildVault(client);

    const instructions = await vault._buildInstructionsForTransfer({
      transferInfo: buildTransferInfo(ASSET_ID),
      source: new PublicKey(OWNER),
      firstReceiver: TO,
      client: client as never,
    });

    expect(instructions).toHaveLength(1);
    expect(instructions[0].programId.equals(MPL_CORE_PROGRAM_ID)).toBe(true);
    expect(instructions[0].keys[4].pubkey.toBase58()).toBe(TO);
    expect(getAccountInfo).toHaveBeenCalledWith({
      address: COLLECTION,
      encoding: 'base64',
    });
    expect(getTokenAccountsByOwner).not.toHaveBeenCalled();
  });

  it('routes a Core asset to TransferV1 when DAS is unavailable', async () => {
    const getAsset = jest.fn().mockRejectedValue(new Error('Method not found'));
    const getAccountInfo = mockCoreAccounts();
    const getTokenAccountsByOwner = jest.fn();
    const client = { getAsset, getAccountInfo, getTokenAccountsByOwner };
    const vault = buildVault(client);

    const instructions = await vault._buildInstructionsForTransfer({
      transferInfo: buildTransferInfo(ASSET_ID),
      source: new PublicKey(OWNER),
      firstReceiver: TO,
      client: client as never,
    });

    expect(instructions).toHaveLength(1);
    expect(instructions[0].programId.equals(MPL_CORE_PROGRAM_ID)).toBe(true);
    expect(getTokenAccountsByOwner).not.toHaveBeenCalled();
  });

  it('keeps a regular SPL NFT on the token-program path', async () => {
    const getAsset = jest.fn().mockResolvedValue({
      ...dasCoreAsset,
      id: SPL_MINT,
      interface: 'V1_NFT',
    });
    // The mint is token-program owned; every other lookup (destination ATA,
    // metadata PDA, OCP mint state) finds nothing.
    const getAccountInfo = jest
      .fn()
      .mockImplementation(({ address }: { address: string }) =>
        Promise.resolve(
          address === SPL_MINT
            ? { ...buildCoreAccountInfo(), owner: TOKEN_PROGRAM_ID.toBase58() }
            : null,
        ),
      );
    const getTokenAccountsByOwner = jest.fn().mockResolvedValue([]);
    const client = { getAsset, getAccountInfo, getTokenAccountsByOwner };
    const vault = buildVault(client);

    const instructions = await vault._buildInstructionsForTransfer({
      transferInfo: buildTransferInfo(SPL_MINT),
      source: new PublicKey(OWNER),
      firstReceiver: TO,
      client: client as never,
    });

    // createAssociatedTokenAccount + transferChecked
    expect(instructions).toHaveLength(2);
    expect(instructions[1].programId.equals(TOKEN_PROGRAM_ID)).toBe(true);
  });
});

describe('SolVault._decodeNativeTxActions for Core transfers', () => {
  function buildTransferInstruction() {
    const vault = buildVault({});
    const [ix] = vault._buildMplCoreNFTInstructions({
      asset: coreAssetInfo,
      collection: coreCollectionInfo,
      assetId: new PublicKey(ASSET_ID),
      source: new PublicKey(OWNER),
      destination: new PublicKey(TO),
    });
    return ix;
  }

  // TransferV1 signed by DELEGATE (payer + authority) for the asset of OWNER.
  function buildDelegateTransferInstruction() {
    const ix = buildTransferInstruction();
    const delegate = new PublicKey(DELEGATE);
    ix.keys[2] = { ...ix.keys[2], pubkey: delegate };
    ix.keys[3] = { ...ix.keys[3], pubkey: delegate };
    return ix;
  }

  function buildDecodeVault(client: IMockClient, accountAddress = OWNER) {
    const vault = buildVault(client);
    vault.getAccountAddress = jest
      .fn()
      .mockResolvedValue(accountAddress) as never;
    vault.getNetwork = jest
      .fn()
      .mockResolvedValue({ decimals: 9, symbol: 'SOL' }) as never;
    return vault;
  }

  it('produces an NFT asset transfer action with DAS metadata and owner', async () => {
    const getAsset = jest.fn().mockResolvedValue(dasCoreAsset);
    const getAccountInfo = jest.fn();
    const vault = buildDecodeVault({ getAsset, getAccountInfo });

    const actions = await vault._decodeNativeTxActions({
      instructions: [buildTransferInstruction()],
      isNFT: true,
      amountToSend: '1',
      sendTokenInfo: undefined,
    });

    expect(getAsset).toHaveBeenCalledWith(ASSET_ID);
    expect(getAccountInfo).not.toHaveBeenCalled();
    expect(actions).toHaveLength(1);
    expect(actions[0].type).toBe('ASSET_TRANSFER');
    expect(actions[0].assetTransfer?.from).toBe(OWNER);
    expect(actions[0].assetTransfer?.sends).toEqual([
      expect.objectContaining({
        from: OWNER,
        to: TO,
        tokenIdOnNetwork: ASSET_ID,
        amount: '1',
        name: 'Collector Crypt Pack #342',
        symbol: 'CCP',
        icon: 'https://example.com/pack.png',
        isNFT: true,
      }),
    ]);
  });

  it('falls back to the on-chain owner and name when DAS metadata cannot be loaded', async () => {
    const getAsset = jest.fn().mockRejectedValue(new Error('Method not found'));
    const getAccountInfo = jest.fn().mockResolvedValue(buildCoreAccountInfo());
    const vault = buildDecodeVault({ getAsset, getAccountInfo });

    const actions = await vault._decodeNativeTxActions({
      instructions: [buildTransferInstruction()],
      isNFT: true,
      amountToSend: '1',
      sendTokenInfo: undefined,
    });

    expect(actions[0].type).toBe('ASSET_TRANSFER');
    expect(actions[0].assetTransfer?.from).toBe(OWNER);
    expect(actions[0].assetTransfer?.sends[0]).toEqual(
      expect.objectContaining({
        from: OWNER,
        tokenIdOnNetwork: ASSET_ID,
        isNFT: true,
        name: 'Collector Crypt Pack #342',
        icon: '',
      }),
    );
  });

  it('reads the owner on-chain when DAS has no ownership data', async () => {
    const getAsset = jest
      .fn()
      .mockResolvedValue({ ...dasCoreAsset, ownership: undefined });
    const getAccountInfo = jest.fn().mockResolvedValue(buildCoreAccountInfo());
    const vault = buildDecodeVault({ getAsset, getAccountInfo });

    const actions = await vault._decodeNativeTxActions({
      instructions: [buildTransferInstruction()],
      isNFT: true,
      amountToSend: '1',
      sendTokenInfo: undefined,
    });

    expect(actions[0].assetTransfer?.from).toBe(OWNER);
    // DAS metadata still wins over the on-chain name.
    expect(actions[0].assetTransfer?.sends[0]).toEqual(
      expect.objectContaining({
        symbol: 'CCP',
        icon: 'https://example.com/pack.png',
      }),
    );
  });

  it('classifies against the asset owner, not the signing Transfer Delegate', async () => {
    const getAsset = jest.fn().mockResolvedValue(dasCoreAsset);
    const vault = buildDecodeVault({ getAsset });

    const actions = await vault._decodeNativeTxActions({
      instructions: [buildDelegateTransferInstruction()],
      isNFT: true,
      amountToSend: '1',
      sendTokenInfo: undefined,
    });

    expect(actions[0].type).toBe('ASSET_TRANSFER');
    expect(actions[0].assetTransfer?.from).toBe(OWNER);
    // The wallet owns the asset, so the delegate-signed transfer is a spend.
    expect(actions[0].assetTransfer?.sends).toEqual([
      expect.objectContaining({
        from: OWNER,
        to: TO,
        tokenIdOnNetwork: ASSET_ID,
      }),
    ]);
    expect(actions[0].assetTransfer?.receives).toEqual([]);
  });

  it('falls back to UNKNOWN when the owner cannot be established', async () => {
    const getAsset = jest.fn().mockRejectedValue(new Error('Method not found'));
    const getAccountInfo = jest.fn().mockRejectedValue(new Error('timeout'));
    const vault = buildDecodeVault({ getAsset, getAccountInfo });

    const actions = await vault._decodeNativeTxActions({
      instructions: [buildTransferInstruction()],
      isNFT: true,
      amountToSend: '1',
      sendTokenInfo: undefined,
    });

    expect(actions).toEqual([
      { type: 'UNKNOWN', unknownAction: { from: OWNER, to: '' } },
    ]);
  });

  it('falls back to UNKNOWN when a non-transfer Core instruction is present', async () => {
    // BurnV1: a Core instruction the wallet does not decode locally.
    const burnIx = new TransactionInstruction({
      programId: MPL_CORE_PROGRAM_ID,
      keys: [],
      data: Buffer.from([12, 0]),
    });
    const systemTransfer = SystemProgram.transfer({
      fromPubkey: new PublicKey(OWNER),
      toPubkey: new PublicKey(TO),
      lamports: 1,
    });
    const vault = buildDecodeVault({});
    vault.backgroundApi = {
      serviceToken: {
        getNativeToken: jest.fn().mockResolvedValue({
          address: '',
          name: 'Solana',
          symbol: 'SOL',
          decimals: 9,
          logoURI: '',
        }),
      },
    } as never;

    const actions = await vault._decodeNativeTxActions({
      instructions: [burnIx, systemTransfer],
      isNFT: false,
      amountToSend: undefined,
      sendTokenInfo: undefined,
    });

    expect(actions).toEqual([
      { type: 'UNKNOWN', unknownAction: { from: OWNER, to: '' } },
    ]);
  });
});
