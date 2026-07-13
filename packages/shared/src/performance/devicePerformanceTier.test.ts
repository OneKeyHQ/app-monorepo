const storage = new Map<string, string>();
const getDeviceCpuTierMatchMock = jest.fn();
const getDeviceMemoryGBSyncMock = jest.fn();

jest.mock('../storage/instance/syncStorageInstance', () => ({
  syncStorage: {
    getString: (key: string) => storage.get(key),
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

describe('devicePerformanceTier web capabilities', () => {
  beforeEach(() => {
    jest.resetModules();
    storage.clear();
    getDeviceCpuTierMatchMock.mockReset();
    getDeviceMemoryGBSyncMock.mockReset();
    getDeviceCpuTierMatchMock.mockReturnValue({
      tier: 'high',
      source: 'browserHardwareConcurrency',
      confidence: 'medium',
    });
    getDeviceMemoryGBSyncMock.mockReturnValue(8);
  });

  it('builds independent CPU and memory capabilities without calibration', () => {
    const { EDeviceCpuTier, EDeviceMemoryClass, getDevicePerformanceProfile } =
      require('./devicePerformanceTier') as typeof import('./devicePerformanceTier');

    const profile = getDevicePerformanceProfile();

    expect(profile.cpu.tier).toBe(EDeviceCpuTier.high);
    expect(profile.memory.class).toBe(EDeviceMemoryClass.large);
    expect(profile.dataVersion).toBe('non-native-capabilities-v1');
  });

  it('ignores the legacy runtime-calibrated tier', () => {
    storage.set('onekey_device_performance_tier', 'low');

    const { EDeviceCpuTier, getDeviceCpuTier } =
      require('./devicePerformanceTier') as typeof import('./devicePerformanceTier');

    expect(getDeviceCpuTier()).toBe(EDeviceCpuTier.high);
  });

  it('persists the CPU developer override independently from memory', () => {
    const {
      EDeviceCpuTier,
      EDeviceMemoryClass,
      getDevicePerformanceProfile,
      setDeviceCpuTier,
    } =
      require('./devicePerformanceTier') as typeof import('./devicePerformanceTier');

    setDeviceCpuTier(EDeviceCpuTier.low);

    const profile = getDevicePerformanceProfile();
    expect(storage.get('onekey_device_cpu_tier_override_v2')).toBe('low');
    expect(profile.cpu.source).toBe('developerOverride');
    expect(profile.memory.class).toBe(EDeviceMemoryClass.large);
  });
});
