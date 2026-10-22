import { mnemonicToSeedSync } from 'bip39';

import { deriveZcashAccountSecrets } from '@onekeyhq/core/src/chains/zcash/accountSecrets';
import { seedFromHdCredentialAsync } from '@onekeyhq/core/src/secret';

import { KeyringHd } from './KeyringHd';
import { zcashUserOperationsActive } from './vaultUtils';

const TEST_SEED = mnemonicToSeedSync(
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
);

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
jest.mock('./transactionReview', () => ({
  parseZcashTransaction: (encodedTx: unknown) => encodedTx,
}));
jest.mock('./signTransparentTransaction', () => ({
  signTransparentTransaction: ({ sign }: { sign: () => Promise<unknown> }) =>
    sign(),
}));

describe('Zcash KeyringHd transparent signing', () => {
  it('tracks the shield build as a user operation and passes only the account xprv', async () => {
    jest
      .mocked(seedFromHdCredentialAsync)
      .mockImplementation(async () => Buffer.from(TEST_SEED));
    const request = {
      accountIndex: 0,
      network: 'main',
      selectedOutpoints: [],
      targetHeight: 2_000_000,
      expiryHeight: 2_000_040,
      recipients: [{ address: 'u1-own', value: '90000' }],
      sendMax: true,
    };
    const expected = deriveZcashAccountSecrets({
      seed: TEST_SEED,
      accountIndex: 0,
    });
    expected.orchardSk.fill(0);
    const result = { txid: 'aa'.repeat(32), rawTx: 'raw' };
    let activeDuringBuild: boolean | undefined;
    const buildTransparentTxWithAccountXprv = jest.fn(async () => {
      activeDuringBuild = zcashUserOperationsActive();
      return result;
    });
    const keyring = Object.assign(Object.create(KeyringHd.prototype), {
      vault: {
        accountId: 'hd-1--acc',
        zcashPrepareFreshTransparentRequest: jest.fn(async () => request),
        zcashGetApi: jest.fn(async () => ({
          buildTransparentTxWithAccountXprv,
        })),
      },
      backgroundApi: {
        simpleDb: { zcash: {} },
        serviceAccount: {
          getDBAccount: jest.fn(async () => ({ xpub: expected.accountXpub })),
        },
      },
      baseGetCredentialsInfo: jest.fn(async () => ({ hd: 'hd-credential' })),
    }) as KeyringHd;

    await expect(
      keyring.signTransaction({
        unsignedTx: { encodedTx: { zcashMode: 'transparent' } },
        password: 'pw',
      } as never),
    ).resolves.toBe(result);

    expect(buildTransparentTxWithAccountXprv).toHaveBeenCalledWith({
      ...request,
      accountXprvHex: expected.accountXprvHex,
    });
    expect(
      JSON.stringify(buildTransparentTxWithAccountXprv.mock.calls),
    ).not.toContain(TEST_SEED.toString('hex'));
    expect(activeDuringBuild).toBe(true);
    expect(zcashUserOperationsActive()).toBe(false);
  });
});
