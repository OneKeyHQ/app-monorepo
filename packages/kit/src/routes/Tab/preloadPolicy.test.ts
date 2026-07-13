const deviceCapabilityDetectedMock = jest.fn();
const getDevicePerformanceProfileMock = jest.fn();
const getTabPreloadEntryMock = jest.fn();

jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    app: {
      perf: {
        deviceCapabilityDetected: deviceCapabilityDetectedMock,
      },
    },
  },
}));

jest.mock('@onekeyhq/shared/src/performance/devicePerformanceTier', () => ({
  getDevicePerformanceProfile: getDevicePerformanceProfileMock,
}));

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    isExtensionUiPopup: false,
    isWebMobile: false,
  },
}));

jest.mock('./preloadConfig', () => ({
  getTabPreloadEntry: getTabPreloadEntryMock,
}));

describe('getTabPreloadPolicy for web capabilities', () => {
  beforeEach(() => {
    jest.resetModules();
    deviceCapabilityDetectedMock.mockReset();
    getDevicePerformanceProfileMock.mockReset();
    getTabPreloadEntryMock.mockReset();
    getDevicePerformanceProfileMock.mockReturnValue({
      cpu: {
        tier: 'medium',
        source: 'browserHardwareConcurrency',
        confidence: 'medium',
      },
      memory: {
        class: 'standard',
        totalGB: 4,
      },
      dataVersion: 'non-native-capabilities-v1',
    });
    getTabPreloadEntryMock.mockReturnValue({
      queue: [],
      intervalMs: 2500,
    });
  });

  it('uses the capability profile and logs the decision once per JS runtime', () => {
    const { getTabPreloadPolicy } =
      require('./preloadPolicy') as typeof import('./preloadPolicy');

    getTabPreloadPolicy();
    getTabPreloadPolicy();

    expect(getTabPreloadEntryMock).toHaveBeenCalledWith('light');
    expect(deviceCapabilityDetectedMock).toHaveBeenCalledTimes(1);
    expect(deviceCapabilityDetectedMock).toHaveBeenCalledWith({
      cpuTier: 'medium',
      cpuSource: 'browserHardwareConcurrency',
      cpuConfidence: 'medium',
      memoryClass: 'standard',
      tabPreloadMode: 'light',
      tabPreloadReason: 'cpu-medium',
      dataVersion: 'non-native-capabilities-v1',
    });
  });
});
