import { mnemonicToSeedSync } from 'bip39';

import {
  deriveZcashAccountSecrets,
  deriveZcashAccountViewingSecrets,
} from '@onekeyhq/core/src/chains/zcash/accountSecrets';
import { seedFromHdCredentialAsync } from '@onekeyhq/core/src/secret';

import { resolveAndSaveZcashAccountMeta } from './accountMeta';
import { KeyringHd } from './KeyringHd';

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

const issuedSeeds: Buffer[] = [];

// The keyring wipes its decrypted seed copy once keys are derived.
function expectIssuedSeedsWiped() {
  expect(issuedSeeds.length).toBeGreaterThan(0);
  for (const seed of issuedSeeds) {
    expect(seed.every((b) => b === 0)).toBe(true);
  }
}

// Every argument the SDK sees must be free of the BIP39 seed: no seed-named
// key anywhere and no 64-byte seed value (hex or bytes).
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

function createKeyring({
  api,
  accountXpub,
  pathIndex = 0,
}: {
  api: Record<string, jest.Mock>;
  accountXpub: string;
  pathIndex?: number;
}) {
  return Object.assign(Object.create(KeyringHd.prototype), {
    vault: {
      accountId: 'hd-1--acc',
      zcashGetApi: jest.fn(async () => api),
      zcashResolveLightwalletdUrl: jest.fn(async () => 'https://lwd.example'),
    },
    backgroundApi: {
      simpleDb: {
        zcash: {
          getPrivacyModeState: jest.fn(async () => ({ intent: 'on' })),
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

  it('sets up the viewing key from the Orchard sk and stored xpub', async () => {
    const expected = deriveZcashAccountViewingSecrets({
      seed: TEST_SEED,
      accountIndex: 0,
    });
    const deriveAccount = jest.fn(async () => ({
      ufvk: 'ufvk',
      unifiedAddress: 'u1',
      transparentAddress: 't1',
      chainTip: 3_000_000,
    }));
    let derived: unknown;
    jest
      .mocked(resolveAndSaveZcashAccountMeta)
      .mockImplementation(async ({ derive }) => {
        derived = await derive({ hdIndex: 0 });
      });
    const keyring = createKeyring({
      api: { deriveAccount },
      accountXpub: expected.accountXpub,
    });

    await keyring.retryLocalWalletSetup({ password: 'pw' });

    expect(deriveAccount).toHaveBeenCalledWith({
      network: 'main',
      orchardSkHex: Buffer.from(expected.orchardSk).toString('hex'),
      accountXpub: expected.accountXpub,
      hdIndex: 0,
      lightwalletdUrl: 'https://lwd.example',
    });
    expectNoSeed(deriveAccount.mock.calls as unknown[][]);
    expectIssuedSeedsWiped();
    expect(derived).toMatchObject({
      ufvk: 'ufvk',
      seedFingerprintHex: expected.seedFingerprintHex,
    });
    expected.orchardSk.fill(0);
  });
});
