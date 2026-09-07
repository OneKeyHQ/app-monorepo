const mockNativeConstructor = jest.fn();
let mockNativeModuleLoadCount = 0;

jest.mock('./TravelModeManager', () => {
  mockNativeModuleLoadCount += 1;
  return {
    TravelModeManager: function NativeTravelModeManager(...args: unknown[]) {
      mockNativeConstructor(...args);
    },
  };
});

describe('Travel Mode platform loading', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    mockNativeModuleLoadCount = 0;
  });

  it('keeps non-native runtimes standard without loading the mobile manager', async () => {
    const platform = (await import('../platformEnv')).default;
    platform.isNative = false;
    const { travelModeManager } = await import('./index');
    const environment = await travelModeManager.getRuntimeEnvironment();
    const operation = jest.fn(async () => 'allowed');

    expect(mockNativeModuleLoadCount).toBe(0);
    expect(mockNativeConstructor).not.toHaveBeenCalled();
    expect(environment.profile.kind).toBe('standard');
    expect(travelModeManager.getRuntimeEnvironmentSync()).toBe(environment);
    await expect(environment.commands.run(operation)).resolves.toBe('allowed');
    await expect(travelModeManager.isActive()).resolves.toBe(false);
    await expect(
      travelModeManager.transition({ enabled: true }),
    ).rejects.toThrow('only supported on mobile');
    travelModeManager.markRestartFailed();
    await expect(travelModeManager.getRuntimeState()).resolves.toBe('inactive');
  });

  it('loads the supported manager in a native runtime', async () => {
    const platform = (await import('../platformEnv')).default;
    platform.isNative = true;
    const storage = (await import('./controlStorage')).default;
    await import('./index');

    expect(mockNativeModuleLoadCount).toBe(1);
    expect(mockNativeConstructor).toHaveBeenCalledWith(storage, true);
  });
});
