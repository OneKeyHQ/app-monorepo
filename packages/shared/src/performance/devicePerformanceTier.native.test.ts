const storage = new Map<string, string>();
const getDeviceCpuTierMatchMock = jest.fn();
const getDeviceMemoryGBSyncMock = jest.fn();
const getStoredValueMock = jest.fn((key: string) => storage.get(key));

jest.mock('../storage/instance/syncStorageInstance', () => ({
  syncStorage: {
    getString: getStoredValueMock,
    set: (key: string, value: string) => storage.set(key, value),
    delete: (key: string) => storage.delete(key),
  },
}));

jest.mock('./deviceCpuTier', () => ({
  getDeviceCpuTierMatch: getDeviceCpuTierMatchMock,
}));

jest.mock('./deviceMemory', () => ({
  getDeviceMemoryGBSync: getDeviceMemoryGBSyncMock,
  isLowEndMemory: (memoryGB: number) => memoryGB > 0 && memoryGB <= 3.5,
}));

describe('devicePerformanceTier.native', () => {
  beforeEach(() => {
    jest.resetModules();
    storage.clear();
    getDeviceCpuTierMatchMock.mockReset();
    getDeviceMemoryGBSyncMock.mockReset();
    getStoredValueMock.mockClear();
    getDeviceMemoryGBSyncMock.mockReturnValue(8);
  });

  it('caches native-backed capability reads within each JS runtime', () => {
    getDeviceCpuTierMatchMock.mockReturnValue({
      tier: 'high',
      source: 'iosModelId',
      confidence: 'high',
    });

    const { getDevicePerformanceProfile } =
      require('./devicePerformanceTier.native') as typeof import('./devicePerformanceTier.native');

    const firstProfile = getDevicePerformanceProfile();
    const secondProfile = getDevicePerformanceProfile();

    expect(secondProfile).toBe(firstProfile);
    expect(getDeviceCpuTierMatchMock).toHaveBeenCalledTimes(1);
    expect(getDeviceMemoryGBSyncMock).toHaveBeenCalledTimes(1);
    expect(getStoredValueMock).toHaveBeenCalledTimes(1);
  });

  it('ignores the unversioned V1 tier', () => {
    storage.set('onekey_device_performance_tier', 'medium');
    getDeviceCpuTierMatchMock.mockReturnValue({
      tier: 'high',
      source: 'iosModelId',
      confidence: 'high',
    });

    const { EDeviceCpuTier, getDeviceCpuTier } =
      require('./devicePerformanceTier.native') as typeof import('./devicePerformanceTier.native');

    expect(getDeviceCpuTier()).toBe(EDeviceCpuTier.high);
  });

  it('persists a V2 CPU developer override separately', () => {
    getDeviceCpuTierMatchMock.mockReturnValue(null);

    const { EDeviceCpuTier, getDevicePerformanceProfile, setDeviceCpuTier } =
      require('./devicePerformanceTier.native') as typeof import('./devicePerformanceTier.native');

    setDeviceCpuTier(EDeviceCpuTier.low);

    expect(storage.get('onekey_device_cpu_tier_override_v2')).toBe(
      EDeviceCpuTier.low,
    );
    expect(getDevicePerformanceProfile().cpu.source).toBe('developerOverride');
  });
});
