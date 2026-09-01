const deviceCapabilityDetectedMock = jest.fn();
const getDevicePerformanceProfileMock = jest.fn();
const getTabPreloadEntryMock = jest.fn();
const platformEnvMock = {
  isExtensionUiPopup: false,
  isExtensionUiSidePanel: false,
  isWebMobile: false,
};

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
  default: platformEnvMock,
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
    platformEnvMock.isExtensionUiPopup = false;
    platformEnvMock.isExtensionUiSidePanel = false;
    platformEnvMock.isWebMobile = false;
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

  it('keeps preloading light when memory capacity is unknown', () => {
    getDevicePerformanceProfileMock.mockReturnValue({
      cpu: {
        tier: 'high',
        source: 'browserHardwareConcurrency',
        confidence: 'medium',
      },
      memory: {
        class: 'unknown',
        totalGB: null,
      },
      dataVersion: 'non-native-capabilities-v1',
    });
    const { getTabPreloadPolicy } =
      require('./preloadPolicy') as typeof import('./preloadPolicy');

    getTabPreloadPolicy();

    expect(getTabPreloadEntryMock).toHaveBeenCalledWith('light');
    expect(deviceCapabilityDetectedMock).toHaveBeenCalledWith(
      expect.objectContaining({
        memoryClass: 'unknown',
        tabPreloadMode: 'light',
        tabPreloadReason: 'memory-unknown',
      }),
    );
  });

  it('caps side panel preloading at light on high-tier devices', () => {
    platformEnvMock.isExtensionUiSidePanel = true;
    getDevicePerformanceProfileMock.mockReturnValue({
      cpu: {
        tier: 'high',
        source: 'browserHardwareConcurrency',
        confidence: 'medium',
      },
      memory: {
        class: 'standard',
        totalGB: 8,
      },
      dataVersion: 'non-native-capabilities-v1',
    });
    const { getTabPreloadPolicy } =
      require('./preloadPolicy') as typeof import('./preloadPolicy');

    getTabPreloadPolicy();

    expect(getTabPreloadEntryMock).toHaveBeenCalledWith('light');
    expect(deviceCapabilityDetectedMock).toHaveBeenCalledWith(
      expect.objectContaining({
        tabPreloadMode: 'light',
        tabPreloadReason: 'surface-limited',
      }),
    );
  });
});
