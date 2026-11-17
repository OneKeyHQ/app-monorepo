import { mnemonicToSeedSync } from 'bip39';

import {
  deriveZcashAccountSecrets,
  deriveZcashAccountViewingSecrets,
} from '@onekeyhq/core/src/chains/zcash/accountSecrets';
import { fetchZcashChainTipDirect } from '@onekeyhq/core/src/chains/zcash/sdkZcash/impl/chainTipDirect';
import { deriveZcashOrchardSpendingKey } from '@onekeyhq/core/src/chains/zcash/zip32Orchard';
import { seedFromHdCredentialAsync } from '@onekeyhq/core/src/secret';

import { resolveAndSaveZcashAccountMeta } from './accountMeta';
import { KeyringHd } from './KeyringHd';
import { signTransparentTransaction } from './signTransparentTransaction';

import type { IEncodedTxZcash } from './types';

const TEST_SEED = mnemonicToSeedSync(
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
);
const TEST_SEED_HEX = TEST_SEED.toString('hex');

jest.mock('@onekeyhq/core/src/instance/coreChainApi', () => ({
  __esModule: true,
  default: { zec: { hd: {} } },
}));
jest.mock('@onekeyhq/core/src/secret', () => ({
  ...jest.requireActual<typeof import('@onekeyhq/core/src/secret')>(
    '@onekeyhq/core/src/secret',
  ),
  seedFromHdCredentialAsync: jest.fn(),
}));
jest.mock('../btc/KeyringHd', () => ({
  KeyringHd: class {},
}));
jest.mock('./accountMeta', () => ({
  resolveAndSaveZcashAccountMeta: jest.fn(),
}));
jest.mock('@onekeyhq/core/src/chains/zcash/zip32Orchard', () => {
  const actual = jest.requireActual<
    typeof import('@onekeyhq/core/src/chains/zcash/zip32Orchard')
  >('@onekeyhq/core/src/chains/zcash/zip32Orchard');
  return {
    ...actual,
    deriveZcashOrchardSpendingKey: jest.fn(
      actual.deriveZcashOrchardSpendingKey,
    ),
  };
});
jest.mock(
  '@onekeyhq/core/src/chains/zcash/sdkZcash/impl/chainTipDirect',
  () => ({
    fetchZcashChainTipDirect: jest.fn(),
  }),
);
jest.mock('./signTransparentTransaction', () => ({
  signTransparentTransaction: jest.fn(),
}));

const issuedSeeds: Buffer[] = [];

function expectIssuedSeedsWiped() {
  expect(issuedSeeds.length).toBeGreaterThan(0);
  for (const seed of issuedSeeds) {
    expect(seed.every((b) => b === 0)).toBe(true);
  }
}

// No seed-named key and no 64-byte seed value may reach the SDK.
function expectNoSeed(calls: unknown[][]) {
  const visit = (value: unknown) => {
    if (value instanceof Uint8Array) {
      expect(Buffer.from(value).equals(TEST_SEED)).toBe(false);
      return;
    }
    if (typeof value === 'string') {
      expect(value.toLowerCase()).not.toContain(TEST_SEED_HEX);
      return;
    }
    if (value && typeof value === 'object') {
      for (const [key, inner] of Object.entries(value)) {
        expect(key).not.toMatch(/^seed(hex|bytes)?$/i);
        expect(key).not.toMatch(/mnemonic/i);
        visit(inner);
      }
    }
  };
  expect(calls.length).toBeGreaterThan(0);
  calls.forEach((args) => args.forEach(visit));
}

const T_RECIPIENT = 't1Hsc1LR8yKnbbe3twRp88p6vFfC5t7DLbs';

function createKeyring({
  api,
  accountXpub,
  pathIndex = 0,
  recipient = T_RECIPIENT,
  storedUfvk,
}: {
  api: Record<string, jest.Mock>;
  accountXpub: string;
  pathIndex?: number;
  recipient?: string;
  storedUfvk?: string;
}) {
  return Object.assign(Object.create(KeyringHd.prototype), {
    vault: {
      accountId: 'hd-1--acc',
      zcashGetApi: jest.fn(async () => api),
      zcashResolveLightwalletdUrl: jest.fn(async () => 'https://lwd.example'),
      zcashPrepareFreshTransparentRequest: jest.fn(async () => ({
        network: 'main',
        accountIndex: pathIndex,
        recipients: [{ address: recipient, amountZat: '1000' }],
      })),
      zcashGetStoredUfvk: jest.fn(async () => storedUfvk),
    },
    backgroundApi: {
      serviceDevSetting: {
        getDevSetting: jest.fn(async () => ({ enabled: false })),
      },
      simpleDb: {
        privacyChainState: {
          getZcashPrivacyModeState: jest.fn(async () => ({ intent: 'on' })),
        },
      },
      serviceAccount: {
        getDBAccount: jest.fn(async () => ({
          id: 'hd-1--acc',
          pathIndex,
          xpub: accountXpub,
        })),
      },
    },
    baseGetCredentialsInfo: jest.fn(async () => ({ hd: 'hd-credential' })),
  }) as KeyringHd;
}

const review = {
  network: 'main' as const,
  ufvk: 'ufvk',
  toAddress: 'u1-recipient',
  amountZat: '1000',
  feeZat: '10000',
  spendSource: 'orchard' as const,
  isMaxSend: false,
};

type ISignPcztHex = (params: {
  password: string;
  hdIndex: number;
  pcztHex: string;
  review: typeof review;
}) => Promise<{ pcztHex: string }>;

describe('Zcash KeyringHd never hands the seed to the SDK', () => {
  beforeEach(() => {
    issuedSeeds.length = 0;
    jest.mocked(seedFromHdCredentialAsync).mockImplementation(async () => {
      const seed = Buffer.from(TEST_SEED);
      issuedSeeds.push(seed);
      return seed;
    });
  });

  it('signs a PCZT with the Orchard sk and account xprv only', async () => {
    const expected = deriveZcashAccountSecrets({
      seed: TEST_SEED,
      accountIndex: 1,
    });
    const signPczt = jest.fn(async () => ({ pcztHex: 'signed' }));
    const keyring = createKeyring({
      api: { signPczt },
      accountXpub: expected.accountXpub,
      pathIndex: 1,
    });

    await expect(
      (keyring as unknown as { signPcztHex: ISignPcztHex }).signPcztHex({
        password: 'pw',
        hdIndex: 1,
        pcztHex: '0102',
        review,
      }),
    ).resolves.toEqual({ pcztHex: 'signed' });

    expect(signPczt).toHaveBeenCalledWith({
      network: 'main',
      orchardSkHex: Buffer.from(expected.orchardSk).toString('hex'),
      accountXprvHex: expected.accountXprvHex,
      hdIndex: 1,
      pcztHex: '0102',
      review,
    });
    expectNoSeed(signPczt.mock.calls as unknown[][]);
    expectIssuedSeedsWiped();
    expected.orchardSk.fill(0);
  });

  it('refuses to sign when the derived key does not match the stored xpub', async () => {
    const other = deriveZcashAccountSecrets({
      seed: TEST_SEED,
      accountIndex: 2,
    });
    other.orchardSk.fill(0);
    const signPczt = jest.fn();
    const keyring = createKeyring({
      api: { signPczt },
      accountXpub: other.accountXpub,
    });

    await expect(
      (keyring as unknown as { signPcztHex: ISignPcztHex }).signPcztHex({
        password: 'pw',
        hdIndex: 0,
        pcztHex: '0102',
        review,
      }),
    ).rejects.toThrow('does not match this account');
    expect(signPczt).not.toHaveBeenCalled();
    expectIssuedSeedsWiped();
  });

  it('sets up the viewing key offline and wipes the Orchard sk before saving metadata', async () => {
    const expected = deriveZcashAccountViewingSecrets({
      seed: TEST_SEED,
      accountIndex: 0,
    });
    let passedSk: Uint8Array | undefined;
    const deriveAccountKeys = jest.fn(async () => ({
      ufvk: 'ufvk',
      unifiedAddress: 'u1',
      transparentAddress: 't1',
    }));
    const getChainTip = jest.fn(async () => {
      expect(passedSk?.every((b) => b === 0)).toBe(true);
      return 3_000_000;
    });
    let derived: unknown;
    jest
      .mocked(resolveAndSaveZcashAccountMeta)
      .mockImplementation(async ({ derive }) => {
        derived = await derive({ hdIndex: 0 });
      });
    jest
      .mocked(deriveZcashOrchardSpendingKey)
      .mockImplementationOnce(({ seed, accountIndex }) => {
        passedSk = jest
          .requireActual<
            typeof import('@onekeyhq/core/src/chains/zcash/zip32Orchard')
          >('@onekeyhq/core/src/chains/zcash/zip32Orchard')
          .deriveZcashOrchardSpendingKey({ seed, accountIndex });
        return passedSk;
      });
    const keyring = createKeyring({
      api: { deriveAccountKeys, getChainTip },
      accountXpub: expected.accountXpub,
    });

    await keyring.retryLocalWalletSetup({ password: 'pw' });

    expect(deriveAccountKeys).toHaveBeenCalledTimes(1);
    expect(deriveAccountKeys).toHaveBeenCalledWith({
      network: 'main',
      orchardSkHex: Buffer.from(expected.orchardSk).toString('hex'),
      accountXpub: expected.accountXpub,
      hdIndex: 0,
    });
    expect(getChainTip).not.toHaveBeenCalled();
    expect(passedSk?.every((b) => b === 0)).toBe(true);
    expectNoSeed(deriveAccountKeys.mock.calls as unknown[][]);
    expectIssuedSeedsWiped();
    expect(derived).toEqual({
      ufvk: 'ufvk',
      unifiedAddress: 'u1',
      transparentAddress: 't1',
      chainTip: null,
      seedFingerprintHex: expected.seedFingerprintHex,
    });
    expected.orchardSk.fill(0);
  });

  it('does not wait for node retries after deriving the viewing key', async () => {
    jest.useFakeTimers();
    let warnSpy: jest.SpyInstance | undefined;
    try {
      const expected = deriveZcashAccountViewingSecrets({
        seed: TEST_SEED,
        accountIndex: 0,
      });
      const deriveAccountKeys = jest.fn(async () => ({
        ufvk: 'ufvk',
        unifiedAddress: 'u1',
        transparentAddress: 't1',
      }));
      const getChainTip = jest
        .fn<Promise<number | null>, []>()
        .mockRejectedValueOnce(new Error('connection reset'))
        .mockResolvedValueOnce(null);
      jest.mocked(fetchZcashChainTipDirect).mockResolvedValueOnce(3_100_000);
      let derived: unknown;
      jest
        .mocked(resolveAndSaveZcashAccountMeta)
        .mockImplementation(async ({ derive }) => {
          derived = await derive({ hdIndex: 0 });
        });
      const keyring = createKeyring({
        api: { deriveAccountKeys, getChainTip },
        accountXpub: expected.accountXpub,
      });
      warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

      const pending = keyring.retryLocalWalletSetup({ password: 'pw' });
      await jest.runAllTimersAsync();
      await pending;

      expect(deriveAccountKeys).toHaveBeenCalledTimes(1);
      expect(getChainTip).not.toHaveBeenCalled();
      expect(fetchZcashChainTipDirect).not.toHaveBeenCalled();
      expect(derived).toMatchObject({ ufvk: 'ufvk', chainTip: null });
      expectIssuedSeedsWiped();
      expected.orchardSk.fill(0);
    } finally {
      warnSpy?.mockRestore();
      jest.useRealTimers();
    }
  });

  it('signs transparent inputs with the account xprv only', async () => {
    const expected = deriveZcashAccountSecrets({
      seed: TEST_SEED,
      accountIndex: 0,
    });
    expected.orchardSk.fill(0);
    jest.mocked(deriveZcashOrchardSpendingKey).mockClear();
    const buildTransparentTxWithAccountXprv = jest.fn(async () => ({
      rawTxHex: '00',
    }));
    jest
      .mocked(signTransparentTransaction)
      .mockImplementation(async ({ sign }) => {
        await sign();
        return { txid: '', rawTx: '00', encodedTx: null };
      });
    const keyring = createKeyring({
      api: { buildTransparentTxWithAccountXprv },
      accountXpub: expected.accountXpub,
    });

    await (
      keyring as unknown as {
        signTransparentTransaction: (params: {
          encodedTx: IEncodedTxZcash;
          password: string;
        }) => Promise<unknown>;
      }
    ).signTransparentTransaction({
      encodedTx: { zcashMode: 'transparent' } as IEncodedTxZcash,
      password: 'pw',
    });

    expect(deriveZcashOrchardSpendingKey).not.toHaveBeenCalled();
    expect(buildTransparentTxWithAccountXprv).toHaveBeenCalledWith({
      network: 'main',
      accountIndex: 0,
      recipients: [{ address: T_RECIPIENT, amountZat: '1000' }],
      accountXprvHex: expected.accountXprvHex,
      ufvk: undefined,
    });
    const calls = buildTransparentTxWithAccountXprv.mock.calls as unknown[][];
    for (const [arg] of calls) {
      expect(Object.keys(arg as object)).not.toContain('orchardSkHex');
    }
    expectNoSeed(calls);
    expectIssuedSeedsWiped();
  });

  describe('a shielded payment from transparent funds', () => {
    const signShielded = async (storedUfvk?: string) => {
      const expected = deriveZcashAccountSecrets({
        seed: TEST_SEED,
        accountIndex: 0,
      });
      const deriveAccountKeys = jest.fn(async () => ({
        ufvk: 'derived-ufvk',
      }));
      const buildTransparentTxWithAccountXprv = jest.fn(async () => ({
        rawTxHex: '00',
      }));
      jest
        .mocked(signTransparentTransaction)
        .mockImplementation(async ({ sign }) => {
          await sign();
          return { txid: '', rawTx: '00', encodedTx: null };
        });
      jest.mocked(deriveZcashOrchardSpendingKey).mockClear();
      const keyring = createKeyring({
        api: { buildTransparentTxWithAccountXprv, deriveAccountKeys },
        accountXpub: expected.accountXpub,
        recipient: 'u1-recipient',
        storedUfvk,
      });
      await (
        keyring as unknown as {
          signTransparentTransaction: (params: {
            encodedTx: IEncodedTxZcash;
            password: string;
          }) => Promise<unknown>;
        }
      ).signTransparentTransaction({
        encodedTx: { zcashMode: 'transparent' } as IEncodedTxZcash,
        password: 'pw',
      });
      return { expected, deriveAccountKeys, buildTransparentTxWithAccountXprv };
    };

    it('uses the stored UFVK without deriving the Orchard key', async () => {
      const { expected, deriveAccountKeys, buildTransparentTxWithAccountXprv } =
        await signShielded('stored-ufvk');
      expected.orchardSk.fill(0);
      expect(deriveZcashOrchardSpendingKey).not.toHaveBeenCalled();
      expect(deriveAccountKeys).not.toHaveBeenCalled();
      expect(buildTransparentTxWithAccountXprv).toHaveBeenCalledWith(
        expect.objectContaining({
          accountXprvHex: expected.accountXprvHex,
          ufvk: 'stored-ufvk',
        }),
      );
      expectIssuedSeedsWiped();
    });

    it('rebuilds a missing UFVK from the seed and wipes the Orchard key', async () => {
      const { expected, deriveAccountKeys, buildTransparentTxWithAccountXprv } =
        await signShielded();
      expect(deriveAccountKeys).toHaveBeenCalledWith({
        network: 'main',
        orchardSkHex: Buffer.from(expected.orchardSk).toString('hex'),
        accountXpub: expected.accountXpub,
        hdIndex: 0,
      });
      expected.orchardSk.fill(0);
      const issuedKey = jest.mocked(deriveZcashOrchardSpendingKey).mock
        .results[0]?.value as Uint8Array;
      expect(issuedKey.every((b) => b === 0)).toBe(true);
      expect(buildTransparentTxWithAccountXprv).toHaveBeenCalledWith(
        expect.objectContaining({
          accountXprvHex: expected.accountXprvHex,
          ufvk: 'derived-ufvk',
        }),
      );
      const calls = buildTransparentTxWithAccountXprv.mock.calls as unknown[][];
      for (const [arg] of calls) {
        expect(Object.keys(arg as object)).not.toContain('orchardSkHex');
      }
      expectNoSeed([
        ...calls,
        ...(deriveAccountKeys.mock.calls as unknown[][]),
      ]);
      expectIssuedSeedsWiped();
    });
  });
});
