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

jest.mock('./preloadConfig', () => ({
  getTabPreloadEntry: getTabPreloadEntryMock,
}));

describe('getTabPreloadPolicy', () => {
  beforeEach(() => {
    jest.resetModules();
    deviceCapabilityDetectedMock.mockReset();
    getDevicePerformanceProfileMock.mockReset();
    getTabPreloadEntryMock.mockReset();
    getDevicePerformanceProfileMock.mockReturnValue({
      cpu: {
        tier: 'high',
        source: 'iosModelId',
        confidence: 'high',
      },
      memory: {
        class: 'standard',
        totalGB: 6,
      },
      dataVersion: 'native-cpu-v1',
    });
    getTabPreloadEntryMock.mockReturnValue({
      queue: [],
      intervalMs: 2000,
    });
  });

  it('logs a sanitized capability decision only once per JS runtime', () => {
    const { getTabPreloadPolicy } =
      require('./preloadPolicy.native') as typeof import('./preloadPolicy.native');

    getTabPreloadPolicy();
    getTabPreloadPolicy();

    expect(deviceCapabilityDetectedMock).toHaveBeenCalledTimes(1);
    expect(deviceCapabilityDetectedMock).toHaveBeenCalledWith({
      cpuTier: 'high',
      cpuSource: 'iosModelId',
      cpuConfidence: 'high',
      memoryClass: 'standard',
      tabPreloadMode: 'full',
      tabPreloadReason: 'cpu-high',
      dataVersion: 'native-cpu-v1',
    });
  });
});
