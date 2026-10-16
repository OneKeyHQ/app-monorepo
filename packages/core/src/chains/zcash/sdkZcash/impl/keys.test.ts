import bs58check from 'bs58check';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';

import { getZcashAccountIndexFromXpub } from '..';

import {
  buildTransparentTxWithAccountXprv,
  createTransparentHardwarePczt,
  deriveAccount,
  deriveTransparentXpubFromUfvk,
  finalizeTransparentHardwarePczt,
  getChainTip,
  parseTransparentTransactions,
  quoteTransparentTx,
  signPczt,
  validateAddress,
} from './keys';

const mockValidateAddress = jest.fn();
const mockChainTipAt = jest.fn<Promise<number>, [string]>();
const mockUfvkFromAccountKeys = jest.fn();
const mockPcztVerifyReview = jest.fn();
const mockPcztSignWithAccountKeys = jest.fn();
const mockUnifiedAddress = jest.fn();
const mockTransparentAddressFromUfvk = jest.fn();
const mockTransparentAccountPubKeyFromUfvk = jest.fn();
const mockTransparentTxQuote = jest.fn();
const mockParseTransparentTransactions = jest.fn();
const mockTransparentTxBuildWithAccountXprv = jest.fn();
const mockShieldCreate = jest.fn();
const mockShieldSign = jest.fn();
const mockHardwareCreate = jest.fn();
const mockHardwareCombine = jest.fn();
const mockProveAtHeight = jest.fn();
const mockExtractStateless = jest.fn();
const mockGetRuntime = jest.fn(async () => ({ chainTipAt: mockChainTipAt }));
const mockGetRuntimeWasm = jest.fn(async () => ({
  pcztProveAtHeight: mockProveAtHeight,
  pcztExtractStateless: mockExtractStateless,
}));
const mockGetKeys = jest.fn(async () => ({
  validateAddress: mockValidateAddress,
  ufvkFromAccountKeys: mockUfvkFromAccountKeys,
  pcztVerifyReview: mockPcztVerifyReview,
  pcztSignWithAccountKeys: mockPcztSignWithAccountKeys,
  unifiedAddress: mockUnifiedAddress,
  transparentAddressFromUfvk: mockTransparentAddressFromUfvk,
  transparentAccountPubKeyFromUfvk: mockTransparentAccountPubKeyFromUfvk,
  transparentTxQuote: mockTransparentTxQuote,
  parseTransparentTransactions: mockParseTransparentTransactions,
  transparentShieldCreateWithAccountXprv: mockShieldCreate,
  transparentShieldSignWithAccountXprv: mockShieldSign,
  transparentTxCreateWithAccountXpub: mockHardwareCreate,
  transparentTxCombineHardwareSigned: mockHardwareCombine,
  transparentTxBuildWithAccountXprv: mockTransparentTxBuildWithAccountXprv,
}));

jest.mock('./carrier', () => ({
  getKeys: () => mockGetKeys(),
  getRuntime: () => mockGetRuntime(),
  getRuntimeWasm: () => mockGetRuntimeWasm(),
  getLightwalletdUrl: (url: string) => url,
}));

const ACCOUNT_XPUB = 'xpub-account';

describe('deriveAccount', () => {
  beforeEach(() => {
    mockChainTipAt.mockReset().mockResolvedValue(3_500_000);
    mockUfvkFromAccountKeys.mockReset().mockReturnValue('ufvk');
    mockUnifiedAddress.mockReset().mockReturnValue('unified-address');
    mockTransparentAddressFromUfvk
      .mockReset()
      .mockReturnValue('transparent-address');
  });

  it('derives from account keys and clears the Orchard key before the network await', async () => {
    let observedSk: Uint8Array | undefined;
    mockUfvkFromAccountKeys.mockImplementation(
      (_network: string, sk: Uint8Array) => {
        observedSk = sk;
        expect(Array.from(sk)).toEqual(new Array(32).fill(0x11));
        return 'ufvk';
      },
    );
    mockChainTipAt.mockImplementation(async () => {
      expect(Array.from(observedSk ?? [])).toEqual(new Array(32).fill(0));
      return 3_500_000;
    });

    await expect(
      deriveAccount({
        network: 'main',
        orchardSkHex: '11'.repeat(32),
        accountXpub: ACCOUNT_XPUB,
        hdIndex: 2,
        lightwalletdUrl: 'https://lightwalletd.example',
      }),
    ).resolves.toEqual({
      ufvk: 'ufvk',
      unifiedAddress: 'unified-address',
      transparentAddress: 'transparent-address',
      chainTip: 3_500_000,
    });
    expect(mockUfvkFromAccountKeys).toHaveBeenCalledWith(
      'main',
      expect.any(Uint8Array),
      ACCOUNT_XPUB,
      2,
    );
  });

  it('clears the Orchard key copy when wasm derivation fails', async () => {
    let observedSk: Uint8Array | undefined;
    mockUfvkFromAccountKeys.mockImplementation(
      (_network: string, sk: Uint8Array) => {
        observedSk = sk;
        throw new OneKeyLocalError('derive failed');
      },
    );

    await expect(
      deriveAccount({
        network: 'main',
        orchardSkHex: '22'.repeat(32),
        accountXpub: ACCOUNT_XPUB,
        hdIndex: 0,
        lightwalletdUrl: 'https://lightwalletd.example',
      }),
    ).rejects.toThrow('derive failed');

    expect(Array.from(observedSk ?? [])).toEqual(new Array(32).fill(0));
    expect(mockChainTipAt).not.toHaveBeenCalled();
  });
});

describe('signPczt', () => {
  const review = {
    network: 'main' as const,
    ufvk: 'ufvk',
    toAddress: 'u1-recipient',
    amountZat: '1000',
    feeZat: '10000',
    spendSource: 'orchard' as const,
    isMaxSend: false,
  };

  it.each([false, true])(
    'signs with account keys and clears every copy (fails=%s)',
    async (fails) => {
      const accountXprv = Buffer.alloc(78, 9);
      let observed: Uint8Array[] = [];
      mockPcztVerifyReview.mockReset();
      mockPcztSignWithAccountKeys
        .mockReset()
        .mockImplementation(
          (
            _network: string,
            sk: Uint8Array,
            xprv: string,
            _index: number,
            pczt: Uint8Array,
          ) => {
            observed = [sk, pczt];
            expect(Array.from(sk)).toEqual(new Array(32).fill(0x33));
            expect(xprv).toBe(bs58check.encode(accountXprv));
            if (fails) throw new OneKeyLocalError('ufvk mismatch');
            return new Uint8Array([0xab]);
          },
        );
      const result = signPczt({
        network: 'main',
        orchardSkHex: '33'.repeat(32),
        accountXprvHex: accountXprv.toString('hex'),
        hdIndex: 1,
        pcztHex: '0102',
        review,
      });
      if (fails) {
        await expect(result).rejects.toThrow('ufvk mismatch');
      } else {
        await expect(result).resolves.toEqual({ pcztHex: 'ab' });
      }
      expect(mockPcztVerifyReview).toHaveBeenCalledWith(
        expect.any(Uint8Array),
        stringUtils.stableStringify(review),
      );
      expect(mockPcztSignWithAccountKeys.mock.calls[0]?.[3]).toBe(1);
      for (const bytes of observed) {
        expect(bytes.every((b) => b === 0)).toBe(true);
      }
    },
  );
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
      stringUtils.stableStringify(request),
    );
  });

  it.each([false, true])(
    'keeps shielding proof computation independent of wallet storage and clears PCZT buffers (proof fails=%s)',
    async (fails) => {
      const original = new Uint8Array([1, 2]);
      const proved = new Uint8Array([3, 4]);
      const signed = new Uint8Array([5, 6]);
      const order: string[] = [];
      mockGetRuntime.mockClear();
      mockShieldCreate.mockImplementation(() => {
        order.push('create');
        return original;
      });
      mockProveAtHeight.mockImplementation(() => {
        order.push('prove');
        if (fails) throw new OneKeyLocalError('proof failed');
        return proved;
      });
      mockShieldSign.mockImplementation((_request, _xprv, source, proof) => {
        expect(source).toBe(original);
        expect(proof).toBe(proved);
        order.push('sign');
        return signed;
      });
      mockExtractStateless.mockImplementation(() => {
        order.push('extract');
        return JSON.stringify({ rawTx: 'abcd', txid: '11'.repeat(32) });
      });
      mockTransparentTxQuote.mockReturnValue(
        JSON.stringify({
          feeZat: '15000',
          expiryHeight: request.expiryHeight,
          spentOutpoints: request.selectedOutpoints,
        }),
      );
      const accountXprv = Buffer.alloc(78, 7);
      const result = buildTransparentTxWithAccountXprv({
        ...request,
        recipients: [{ address: 'u1-recipient', amountZat: '50000' }],
        accountXprvHex: accountXprv.toString('hex'),
      });
      if (fails) {
        await expect(result).rejects.toThrow('proof failed');
        expect(order).toEqual(['create', 'prove']);
      } else {
        await expect(result).resolves.toMatchObject({
          rawTx: 'abcd',
          feeZat: '15000',
        });
        expect(order).toEqual(['create', 'prove', 'sign', 'extract']);
        expect([...proved, ...signed]).toEqual([0, 0, 0, 0]);
      }
      expect([...original]).toEqual([0, 0]);
      expect(mockGetRuntime).not.toHaveBeenCalled();
      expect(mockShieldCreate.mock.calls.at(-1)?.[1]).toBe(
        bs58check.encode(accountXprv),
      );
    },
  );

  it.each([false, true])(
    'finalizes device signatures without opening wallet storage (failure=%s)',
    async (fails) => {
      const order: string[] = [];
      mockGetRuntime.mockClear();
      mockGetRuntimeWasm.mockClear();
      const original = new Uint8Array([1, 2]);
      const combined = new Uint8Array([3, 4]);
      const proved = new Uint8Array([5, 6]);
      mockHardwareCreate.mockReturnValue(original);
      const created = await createTransparentHardwarePczt({
        request,
        accountXpub: 'public',
        seedFingerprintHex: '01'.repeat(32),
      });
      expect(created.pcztHex).toBe('0102');
      expect([...original]).toEqual([0, 0]);
      mockHardwareCombine.mockImplementation(() => {
        order.push('verify');
        if (fails) throw new OneKeyLocalError('signature rejected');
        return combined;
      });
      mockProveAtHeight.mockImplementation(() => {
        order.push('prove');
        return proved;
      });
      mockExtractStateless.mockImplementation(() => {
        order.push('extract');
        return JSON.stringify({ rawTx: 'abcd', txid: '11'.repeat(32) });
      });
      mockTransparentTxQuote.mockReturnValue(
        JSON.stringify({
          feeZat: '10000',
          expiryHeight: request.expiryHeight,
          spentOutpoints: request.selectedOutpoints,
        }),
      );
      const result = finalizeTransparentHardwarePczt({
        request,
        accountXpub: 'public',
        originalPcztHex: created.pcztHex,
        signedPcztHex: 'aabb',
      });
      if (fails) {
        await expect(result).rejects.toThrow('signature rejected');
        expect(order).toEqual(['verify']);
        expect(mockGetRuntimeWasm).not.toHaveBeenCalled();
      } else {
        await expect(result).resolves.toMatchObject({
          rawTx: 'abcd',
          feeZat: '10000',
        });
        expect(order).toEqual(['verify', 'prove', 'extract']);
        expect([...combined, ...proved]).toEqual([0, 0, 0, 0]);
      }
      expect(mockGetRuntime).not.toHaveBeenCalled();
    },
  );

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
      stringUtils.stableStringify(request),
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

describe('validateAddress', () => {
  it('decodes through keys without opening the wallet or querying the network', async () => {
    mockGetRuntime.mockClear();
    mockGetRuntimeWasm.mockClear();
    mockValidateAddress.mockReturnValueOnce(true).mockReturnValueOnce(false);
    await expect(
      validateAddress({ network: 'main', address: 'supported' }),
    ).resolves.toBe(true);
    await expect(
      validateAddress({ network: 'main', address: 'unsupported' }),
    ).resolves.toBe(false);
    expect(mockValidateAddress).toHaveBeenCalledWith('main', 'supported');
    expect(mockGetRuntime).not.toHaveBeenCalled();
    expect(mockGetRuntimeWasm).not.toHaveBeenCalled();
  });
});

describe('parseTransparentTransactions', () => {
  it('uses only the stateless keys module', async () => {
    mockGetRuntime.mockClear();
    mockGetRuntimeWasm.mockClear();
    const params = { transactions: [] };
    mockParseTransparentTransactions.mockReturnValue('[]');
    await expect(parseTransparentTransactions(params)).resolves.toEqual([]);
    expect(mockParseTransparentTransactions).toHaveBeenCalledWith(
      stringUtils.stableStringify(params),
    );
    expect(mockGetRuntime).not.toHaveBeenCalled();
    expect(mockGetRuntimeWasm).not.toHaveBeenCalled();
  });
});
