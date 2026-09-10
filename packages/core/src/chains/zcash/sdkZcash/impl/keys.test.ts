import bs58check from 'bs58check';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import { getZcashAccountIndexFromXpub } from '..';

import {
  buildTransparentTxWithAccountXprv,
  deriveAccount,
  deriveTransparentXpubFromUfvk,
  getChainTip,
  quoteTransparentTx,
} from './keys';

const mockChainTipAt = jest.fn<Promise<number>, [string]>();
const mockUfvkFromSeed = jest.fn();
const mockSeedFingerprint = jest.fn();
const mockUnifiedAddress = jest.fn();
const mockTransparentAddressFromUfvk = jest.fn();
const mockTransparentAccountPubKeyFromUfvk = jest.fn();
const mockTransparentTxQuote = jest.fn();
const mockTransparentTxBuildWithAccountXprv = jest.fn();
const mockGetKeys = jest.fn(async () => ({
  ufvkFromSeed: mockUfvkFromSeed,
  seedFingerprint: mockSeedFingerprint,
  unifiedAddress: mockUnifiedAddress,
  transparentAddressFromUfvk: mockTransparentAddressFromUfvk,
  transparentAccountPubKeyFromUfvk: mockTransparentAccountPubKeyFromUfvk,
  transparentTxQuote: mockTransparentTxQuote,
  transparentTxBuildWithAccountXprv: mockTransparentTxBuildWithAccountXprv,
}));

jest.mock('./carrier', () => ({
  getKeys: () => mockGetKeys(),
  getRuntime: jest.fn(async () => ({
    chainTipAt: mockChainTipAt,
  })),
  pickLightwalletdUrl: (url: string) => url,
}));

describe('deriveAccount', () => {
  beforeEach(() => {
    mockChainTipAt.mockReset().mockResolvedValue(3_500_000);
    mockUfvkFromSeed.mockReset().mockReturnValue('ufvk');
    mockSeedFingerprint.mockReset().mockReturnValue('fingerprint');
    mockUnifiedAddress.mockReset().mockReturnValue('unified-address');
    mockTransparentAddressFromUfvk
      .mockReset()
      .mockReturnValue('transparent-address');
  });

  it('reuses and clears one mutable seed copy before the network await', async () => {
    let ufvkSeed: Uint8Array | undefined;
    let fingerprintSeed: Uint8Array | undefined;
    mockUfvkFromSeed.mockImplementation(
      (_network: string, seed: Uint8Array) => {
        ufvkSeed = seed;
        return 'ufvk';
      },
    );
    mockSeedFingerprint.mockImplementation((seed: Uint8Array) => {
      fingerprintSeed = seed;
      return 'fingerprint';
    });
    mockChainTipAt.mockImplementation(async () => {
      expect(ufvkSeed).toBeDefined();
      expect(Array.from(ufvkSeed ?? [])).toEqual(new Array(64).fill(0));
      return 3_500_000;
    });

    await deriveAccount({
      network: 'main',
      seedHex: '11'.repeat(64),
      hdIndex: 0,
      lightwalletdUrl: 'https://lightwalletd.example',
    });

    expect(fingerprintSeed).toBe(ufvkSeed);
    expect(Array.from(fingerprintSeed ?? [])).toEqual(new Array(64).fill(0));
  });

  it('clears the seed copy when wasm derivation fails', async () => {
    let observedSeed: Uint8Array | undefined;
    mockUfvkFromSeed.mockImplementation(
      (_network: string, seed: Uint8Array) => {
        observedSeed = seed;
        throw new OneKeyLocalError('derive failed');
      },
    );

    await expect(
      deriveAccount({
        network: 'main',
        seedHex: '22'.repeat(64),
        hdIndex: 0,
        lightwalletdUrl: 'https://lightwalletd.example',
      }),
    ).rejects.toThrow('derive failed');

    expect(Array.from(observedSeed ?? [])).toEqual(new Array(64).fill(0));
    expect(mockSeedFingerprint).not.toHaveBeenCalled();
    expect(mockChainTipAt).not.toHaveBeenCalled();
  });
});

describe('transparent keys-only transaction API', () => {
  const request = {
    network: 'main' as const,
    accountIndex: 0,
    targetHeight: 3_500_000,
    expiryHeight: 3_500_010,
    utxos: [],
    selectedOutpoints: [],
    recipients: [{ address: 't1-recipient', amountZat: '50000' }],
    sendMax: false,
  };

  it('quotes without loading the wallet runtime', async () => {
    mockTransparentTxQuote.mockReturnValue(
      JSON.stringify({
        feeZat: '10000',
        inputTotalZat: '100000',
        sendAmountZat: '50000',
        changeZat: '40000',
        expiryHeight: request.expiryHeight,
        spentOutpoints: [],
      }),
    );
    await expect(quoteTransparentTx(request)).resolves.toMatchObject({
      feeZat: '10000',
    });
    expect(mockTransparentTxQuote).toHaveBeenCalledWith(
      JSON.stringify(request),
    );
  });

  it('converts the stored account-xprv bytes at the wasm boundary', async () => {
    mockTransparentTxBuildWithAccountXprv.mockReturnValue(
      JSON.stringify({
        rawTx: '00',
        txid: '11'.repeat(32),
        feeZat: '10000',
        expiryHeight: request.expiryHeight,
        spentOutpoints: [],
      }),
    );
    const accountXprv = Buffer.alloc(78, 7);
    await buildTransparentTxWithAccountXprv({
      ...request,
      accountXprvHex: accountXprv.toString('hex'),
    });
    expect(mockTransparentTxBuildWithAccountXprv).toHaveBeenCalledWith(
      JSON.stringify(request),
      bs58check.encode(accountXprv),
    );
  });
});

describe('deriveTransparentXpubFromUfvk', () => {
  it('rebuilds a depth-3 hardened account xpub around the UFVK key', async () => {
    const chainCode = '11'.repeat(32);
    const pubKey = `02${'22'.repeat(32)}`;
    mockTransparentAccountPubKeyFromUfvk.mockReturnValue(chainCode + pubKey);

    const { xpub } = await deriveTransparentXpubFromUfvk({
      network: 'main',
      ufvk: 'ufvk',
      hdIndex: 7,
    });

    expect(xpub.startsWith('xpub')).toBe(true);
    expect(getZcashAccountIndexFromXpub(xpub)).toBe(7);
    const payload = Buffer.from(bs58check.decode(xpub));
    expect(payload.subarray(13, 45).toString('hex')).toBe(chainCode);
    expect(payload.subarray(45).toString('hex')).toBe(pubKey);
  });

  it('rejects a malformed account key', async () => {
    mockTransparentAccountPubKeyFromUfvk.mockReturnValue('00'.repeat(10));
    await expect(
      deriveTransparentXpubFromUfvk({
        network: 'main',
        ufvk: 'ufvk',
        hdIndex: 0,
      }),
    ).rejects.toThrow('account key length');
  });
});

describe('getChainTip', () => {
  beforeEach(() => {
    mockChainTipAt.mockReset();
  });

  it('uses an isolated endpoint client', async () => {
    mockChainTipAt.mockResolvedValue(3_500_000);

    await expect(
      getChainTip({
        network: 'main',
        lightwalletdUrl: 'https://lightwalletd.example',
      }),
    ).resolves.toBe(3_500_000);
    expect(mockChainTipAt).toHaveBeenCalledWith('https://lightwalletd.example');
  });

  it('keeps the nullable probe contract on network failure', async () => {
    mockChainTipAt.mockRejectedValue(new Error('offline'));

    await expect(
      getChainTip({
        network: 'main',
        lightwalletdUrl: 'https://lightwalletd.example',
      }),
    ).resolves.toBeNull();
  });
});
