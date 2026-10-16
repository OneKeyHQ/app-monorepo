import { KeyringHd } from './KeyringHd';
import { zcashUserOperationsActive } from './vaultUtils';

jest.mock('@onekeyhq/core/src/instance/coreChainApi', () => ({
  __esModule: true,
  default: { zec: { hd: {} } },
}));
jest.mock('@onekeyhq/core/src/secret', () => ({
  seedFromHdCredentialAsync: jest.fn(async () => Buffer.from('0102', 'hex')),
}));
jest.mock('../btc/KeyringHd', () => ({
  KeyringHd: class {},
}));
jest.mock('./hardwareRequestPreview', () => ({
  ZCASH_HW_PREVIEW_STOP_MESSAGE: 'stop',
  isZcashHardwarePreviewEnabled: jest.fn(async () => false),
}));
jest.mock('./transactionReview', () => ({
  parseZcashTransaction: (encodedTx: unknown) => encodedTx,
}));
jest.mock('./signTransparentTransaction', () => ({
  signTransparentTransaction: ({ sign }: { sign: () => Promise<unknown> }) =>
    sign(),
}));

describe('Zcash KeyringHd transparent signing', () => {
  it('tracks the shield build as a user operation', async () => {
    const request = {
      accountIndex: 0,
      network: 'main',
      selectedOutpoints: [],
      targetHeight: 2_000_000,
      expiryHeight: 2_000_040,
      recipients: [{ address: 'u1-own', value: '90000' }],
      sendMax: true,
    };
    const result = { txid: 'aa'.repeat(32), rawTx: 'raw' };
    let activeDuringBuild: boolean | undefined;
    const buildTransparentTxWithSeed = jest.fn(async () => {
      activeDuringBuild = zcashUserOperationsActive();
      return result;
    });
    const keyring = Object.assign(Object.create(KeyringHd.prototype), {
      vault: {
        accountId: 'hd-1--acc',
        zcashPrepareFreshTransparentRequest: jest.fn(async () => request),
        zcashGetApi: jest.fn(async () => ({ buildTransparentTxWithSeed })),
      },
      backgroundApi: { simpleDb: { zcash: {} } },
      baseGetCredentialsInfo: jest.fn(async () => ({ hd: 'hd-credential' })),
    }) as KeyringHd;

    await expect(
      keyring.signTransaction({
        unsignedTx: { encodedTx: { zcashMode: 'transparent' } },
        password: 'pw',
      } as never),
    ).resolves.toBe(result);

    expect(buildTransparentTxWithSeed).toHaveBeenCalledWith({
      ...request,
      seedHex: '0102',
    });
    expect(activeDuringBuild).toBe(true);
    expect(zcashUserOperationsActive()).toBe(false);
  });
});
