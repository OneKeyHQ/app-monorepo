import { PublicKey } from '@solana/web3.js';

// Importing the vault pulls in the localDb singleton, whose constructor opens
// IndexedDB at module load and crashes under jest's node environment.
jest.mock('../../../dbs/local/localDbInstance', () => ({
  __esModule: true,
  default: {},
}));

/* eslint-disable import/first */
import { BUBBLEGUM_PROGRAM_ID } from './sdkSol/bubblegum';
import SolVault from './Vault';

import type { IDasAsset, IDasAssetProof } from './types';
/* eslint-enable import/first */

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

type IMockClient = {
  getAsset?: jest.Mock;
  getAssetProof?: jest.Mock;
  getAccountInfo?: jest.Mock;
  getTokenAccountsByOwner?: jest.Mock;
};

function buildVault(client: IMockClient) {
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
        ownership: {
          ...(compressedAsset.ownership as NonNullable<IDasAsset['ownership']>),
          delegated: true,
          delegate,
        },
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
    const client = {
      getAsset,
      getAssetProof,
      getAccountInfo,
      getTokenAccountsByOwner,
    };
    const vault = buildVault(client);

    const instructions = await vault._buildInstructionsForTransfer({
      transferInfo: {
        from: OWNER,
        to: TO,
        amount: '1',
        nftInfo: {
          nftId: '',
          nftAddress: ASSET_ID,
          nftType: 'ERC-721' as never,
        },
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

describe('SolVault._decodeNativeTxActions for Bubblegum transfers', () => {
  async function buildGoldenInstruction() {
    const getAssetProof = jest.fn().mockResolvedValue(assetProof);
    const getAccountInfo = jest.fn().mockResolvedValue(buildTreeAccountInfo());
    const builder = buildVault({ getAssetProof, getAccountInfo });
    const [ix] = await builder._buildCompressedNFTInstructions({
      asset: compressedAsset,
      source: new PublicKey(OWNER),
      destination: new PublicKey(TO),
    });
    return ix;
  }

  function buildDecodeVault(getAsset: jest.Mock) {
    const vault = buildVault({ getAsset });
    vault.getAccountAddress = jest.fn().mockResolvedValue(OWNER) as never;
    vault.getNetwork = jest
      .fn()
      .mockResolvedValue({ decimals: 9, symbol: 'SOL' }) as never;
    return vault;
  }

  it('produces an NFT asset transfer action with DAS metadata', async () => {
    const ix = await buildGoldenInstruction();
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
    const ix = await buildGoldenInstruction();
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
      expect.objectContaining({
        tokenIdOnNetwork: ASSET_ID,
        isNFT: true,
        name: '',
      }),
    );
  });
});
