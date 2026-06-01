import ServiceKeylessCloudSync from './ServiceKeylessCloudSync';

jest.mock('../../dbs/local/localDb', () => ({
  __esModule: true,
  default: {},
}));

jest.mock('../../states/jotai/atoms', () => ({
  primeCloudSyncPersistAtom: {
    get: jest.fn(),
    set: jest.fn(),
  },
}));

jest.mock('@onekeyhq/shared/src/background/backgroundDecorators', () => {
  const passthroughDecorator =
    () =>
    (...args: unknown[]) =>
      args.length === 1 ? args[0] : args[2];

  return {
    backgroundClass: passthroughDecorator,
    backgroundMethod: passthroughDecorator,
    backgroundMethodForDev: passthroughDecorator,
    toastIfError: passthroughDecorator,
  };
});

describe('ServiceKeylessCloudSync', () => {
  test('silent keyless sync enable replays scene sync items', async () => {
    const startServerSyncFlow = jest.fn(async () => undefined);
    const service = new ServiceKeylessCloudSync({
      backgroundApi: {
        servicePrimeCloudSync: {
          startServerSyncFlow,
        },
        servicePrime: {
          apiFetchPrimeUserInfo: jest.fn(),
        },
      },
    });

    jest
      .spyOn(service, 'prepareCloudSyncKeyless')
      .mockResolvedValue({ success: true });
    jest.spyOn(service, 'setCloudSyncEnabledKeyless').mockResolvedValue(true);

    await service.toggleCloudSyncKeyless({
      enabled: true,
      silentEnable: true,
    });

    expect(startServerSyncFlow).toHaveBeenCalledWith({
      setUndefinedTimeToNow: true,
      callerName: 'Enable Keyless Cloud Sync',
      forceSync: true,
    });
  });
});
