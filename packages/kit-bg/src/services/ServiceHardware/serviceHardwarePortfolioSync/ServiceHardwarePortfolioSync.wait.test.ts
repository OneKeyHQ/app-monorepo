import ServiceHardwarePortfolioSync from './ServiceHardwarePortfolioSync';

import type { IBackgroundApi } from '../../../apis/IBackgroundApi';

jest.mock('@onekeyhq/shared/src/background/backgroundDecorators', () => ({
  backgroundClass: () => (target: unknown) => target,
  backgroundMethod:
    () => (_target: unknown, _key: string, descriptor: PropertyDescriptor) =>
      descriptor,
  backgroundMethodForDev:
    () => (_target: unknown, _key: string, descriptor: PropertyDescriptor) =>
      descriptor,
}));

jest.mock('@onekeyhq/shared/src/eventBus/appEventBus', () => ({
  EAppEventBusNames: {
    AllNetworksTokenListSettled: 'AllNetworksTokenListSettled',
  },
  appEventBus: { on: jest.fn(), off: jest.fn() },
}));

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isDev: false, isJest: true },
}));

jest.mock('@onekeyhq/shared/src/utils/accountUtils', () => ({
  __esModule: true,
  default: {},
}));

jest.mock('../../../states/jotai/atoms', () => ({
  currencyPersistAtom: {},
  settingsPersistAtom: {},
}));

jest.mock('../../../states/jotai/atoms/devSettings', () => ({
  devSettingsPersistAtom: {},
}));

describe('ServiceHardwarePortfolioSync.waitForActivePortfolioSync', () => {
  test('waits for the active upload instead of cancelling it', async () => {
    const service = new ServiceHardwarePortfolioSync({
      backgroundApi: {} as IBackgroundApi,
    });
    let resolveUpload:
      | ((value: { portfolioUpdated: boolean }) => void)
      | undefined;
    const uploadPromise = new Promise<{ portfolioUpdated: boolean }>(
      (resolve) => {
        resolveUpload = resolve;
      },
    );
    const activeUploads = new Map([['PRO2_CONNECT_ID', uploadPromise]]);
    (
      service as unknown as {
        activeUploadByConnectId: Map<
          string,
          Promise<{ portfolioUpdated: boolean }>
        >;
      }
    ).activeUploadByConnectId = activeUploads;

    let completed = false;
    const waiting = service
      .waitForActivePortfolioSync({ connectId: 'PRO2_CONNECT_ID' })
      .then((result) => {
        completed = true;
        return result;
      });

    await Promise.resolve();
    expect(completed).toBe(false);

    resolveUpload?.({ portfolioUpdated: true });
    await expect(waiting).resolves.toBe(true);
  });

  test('returns immediately when the device has no active upload', async () => {
    const service = new ServiceHardwarePortfolioSync({
      backgroundApi: {} as IBackgroundApi,
    });

    await expect(
      service.waitForActivePortfolioSync({ connectId: 'PRO2_CONNECT_ID' }),
    ).resolves.toBe(false);
  });
});
