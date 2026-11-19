/* cspell:ignore Ufvks */
import type { IZcashWalletAccount } from '../types/sdk';

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: jest.requireActual('@onekeyhq/shared/src/buildTimeEnv'),
}));
jest.mock('./carrier', () => ({
  ...jest.requireActual<typeof import('./carrier')>('./carrier'),
  withWallet: jest.fn(),
}));

const account: IZcashWalletAccount = {
  network: 'main',
  lightwalletdUrl: 'https://example.invalid',
  ufvk: 'test-ufvk',
  seedFingerprintHex: 'test-fingerprint',
  hdIndex: 0,
  birthdayHeight: 1,
  label: 'test-fp',
};

describe('scan limits in carrier builds', () => {
  it.each([
    ['app', 50],
    ['web-embed', 50],
    ['desktop', 500],
    ['web', 500],
    ['ext', 500],
  ])(
    'passes the %s build limit to every scan lane',
    async (platform, limit) => {
      const previousPlatform = process.env.ONEKEY_PLATFORM;
      process.env.ONEKEY_PLATFORM = String(platform);
      try {
        await jest.isolateModulesAsync(async () => {
          const { withWallet } = await import('./carrier');
          const { syncWallet } = await import('./wallet');
          const rt = {
            listAccounts: () => JSON.stringify(['uuid']),
            accountBalance: jest.fn(),
            accountSyncStatus: () => JSON.stringify({ isComplete: false }),
            syncPeek: jest.fn(() =>
              JSON.stringify({
                totalBlocks: 1,
                ranges: [],
                chainTip: 10,
                fullyScannedHeight: 9,
              }),
            ),
            syncPrepare: jest.fn().mockResolvedValue(undefined),
            syncStep: jest
              .fn()
              .mockResolvedValue(
                JSON.stringify({ blocksScanned: 0, done: true }),
              ),
          };
          jest.mocked(withWallet).mockResolvedValue({
            rt,
            accountUuid: 'uuid',
          } as unknown as Awaited<ReturnType<typeof withWallet>>);

          await syncWallet(account, {
            activeUfvks: [account.ufvk],
            chainTip: 10,
          });

          expect(rt.syncStep).toHaveBeenCalledTimes(5);
          for (const lane of [
            'verify',
            'chainTip',
            'foundNote',
            'openAdjacent',
            'historic',
          ]) {
            expect(rt.syncStep).toHaveBeenCalledWith(
              limit,
              1,
              lane,
              JSON.stringify([account.ufvk]),
            );
          }
          expect(rt.accountBalance).not.toHaveBeenCalled();

          rt.syncPeek.mockReturnValue(
            JSON.stringify({
              totalBlocks: 0,
              ranges: [],
              chainTip: 10,
              fullyScannedHeight: 10,
            }),
          );
          rt.syncStep.mockClear();
          await expect(
            syncWallet(account, {
              activeUfvks: [account.ufvk],
              chainTip: 10,
            }),
          ).resolves.toMatchObject({
            stateChanged: false,
            backfillRemaining: false,
          });
          expect(rt.syncStep).not.toHaveBeenCalled();
          expect(rt.accountBalance).not.toHaveBeenCalled();
        });
      } finally {
        if (previousPlatform === undefined) {
          delete process.env.ONEKEY_PLATFORM;
        } else {
          process.env.ONEKEY_PLATFORM = previousPlatform;
        }
      }
    },
  );
});
