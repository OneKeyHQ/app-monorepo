let mockDeviceUtils: Record<string, unknown> = {};

jest.mock('@onekeyfe/react-native-device-utils', () => ({
  get ReactNativeDeviceUtils() {
    return mockDeviceUtils;
  },
}));

type IModule = typeof import('./index.ios');

function loadModule(): IModule {
  let loaded: IModule | undefined;
  jest.isolateModules(() => {
    loaded = jest.requireActual<IModule>('./index.ios');
  });
  return loaded as IModule;
}

describe('SkanConversion (iOS)', () => {
  let markNative: jest.Mock;

  beforeEach(() => {
    markNative = jest.fn(() => Promise.resolve(undefined));
    mockDeviceUtils = { markSkanMilestones: markNative };
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('ORs milestones and passes the coarse rule', async () => {
    const { ESkanMilestone, SKAN_COARSE_RULE, markSkanMilestones } =
      loadModule();
    await markSkanMilestones(
      ESkanMilestone.WalletActivated,
      ESkanMilestone.HardwareWalletConnected,
    );
    expect(markNative).toHaveBeenCalledWith(34, SKAN_COARSE_RULE);
    expect(SKAN_COARSE_RULE).toEqual({ highMask: 24, mediumMask: 6 });
  });

  it('never rejects when the native update fails', async () => {
    markNative.mockRejectedValueOnce(new Error('window closed'));
    const { ESkanMilestone, markSkanMilestones } = loadModule();
    await expect(
      markSkanMilestones(ESkanMilestone.BackupCompleted),
    ).resolves.toBeUndefined();
    expect(console.warn).toHaveBeenCalledWith(
      '[SkanConversion] Conversion value update failed',
      'window closed',
    );
  });

  it('skips a native shell without the SKAN API', async () => {
    mockDeviceUtils = {};
    const { ESkanMilestone, markSkanMilestones } = loadModule();
    await expect(
      markSkanMilestones(ESkanMilestone.AppOpened),
    ).resolves.toBeUndefined();
  });

  it('throttles app opens to one per hour', async () => {
    jest.useFakeTimers({ now: 1_000_000 });
    const { markSkanAppOpened } = loadModule();
    await markSkanAppOpened();
    await markSkanAppOpened();
    expect(markNative).toHaveBeenCalledTimes(1);
    expect(markNative).toHaveBeenLastCalledWith(1, expect.any(Object));

    jest.setSystemTime(1_000_000 + 60 * 60 * 1000);
    await markSkanAppOpened();
    expect(markNative).toHaveBeenCalledTimes(2);
  });
});
