import { LoggerConfigManager } from './loggerConfigManager';

import type { ILoggerConfig } from './loggerConfigShared';

describe('LoggerConfigManager', () => {
  it('reads stored config once during init and merges with defaults', async () => {
    const storedConfig: ILoggerConfig = {
      highlightDurationGt: '200',
      colorfulLog: true,
      enabled: { app: { boot: true } },
    };
    const store = {
      readStoredConfig: jest.fn().mockResolvedValue(storedConfig),
      loadRuntimeConfig: jest.fn(),
      saveConfig: jest.fn(),
    };
    const catalog = {
      buildConfig: jest.fn(),
      expandConfig: jest.fn(),
    };
    const runtime = { drain: jest.fn() };
    const manager = new LoggerConfigManager({
      env: { isDev: true, isProduction: false, isWebEmbed: false },
      store,
      catalog,
      runtime,
    });

    await manager.init();

    expect(store.readStoredConfig).toHaveBeenCalledTimes(1);
    expect(store.loadRuntimeConfig).not.toHaveBeenCalled();
    expect(catalog.expandConfig).not.toHaveBeenCalled();
    expect(runtime.drain).toHaveBeenCalledTimes(1);
    expect(manager.config?.enabled?.app?.boot).toBe(true);
  });

  it('reuses cached stored config on first getSavedLoggerConfig without re-reading storage', async () => {
    const storedConfig: ILoggerConfig = {
      highlightDurationGt: '250',
      colorfulLog: true,
      enabled: { app: { boot: true } },
    };
    const expandedConfig: ILoggerConfig = {
      highlightDurationGt: '250',
      colorfulLog: true,
      enabled: { app: { boot: true, ready: false } },
    };
    const store = {
      readStoredConfig: jest.fn().mockResolvedValue(storedConfig),
      loadRuntimeConfig: jest.fn(),
      saveConfig: jest.fn(),
    };
    const catalog = {
      buildConfig: jest.fn(),
      expandConfig: jest.fn().mockReturnValue(expandedConfig),
    };
    const manager = new LoggerConfigManager({
      env: { isDev: true, isProduction: false, isWebEmbed: false },
      store,
      catalog,
      runtime: { drain: jest.fn() },
    });

    await manager.init();
    const firstConfig = await manager.getSavedLoggerConfig();
    const secondConfig = await manager.getSavedLoggerConfig();

    // readStoredConfig called once (init), not again for getSavedLoggerConfig
    expect(store.readStoredConfig).toHaveBeenCalledTimes(1);
    expect(catalog.expandConfig).toHaveBeenCalledTimes(1);
    expect(catalog.expandConfig).toHaveBeenCalledWith(storedConfig);
    expect(firstConfig).toBe(expandedConfig);
    expect(secondConfig).toBe(expandedConfig);
  });

  it('updates runtime state before persisting a saved config', () => {
    const store = {
      readStoredConfig: jest.fn<Promise<ILoggerConfig | undefined>, []>(),
      loadRuntimeConfig: jest.fn(),
      saveConfig: jest.fn(),
    };
    const manager = new LoggerConfigManager({
      env: { isDev: true, isProduction: false, isWebEmbed: false },
      store,
      catalog: { buildConfig: jest.fn(), expandConfig: jest.fn() },
      runtime: { drain: jest.fn() },
    });
    const nextConfig: ILoggerConfig = {
      highlightDurationGt: '300',
      colorfulLog: true,
      enabled: { setting: { device: true } },
    };

    manager.saveLoggerConfig(nextConfig);

    expect(store.saveConfig).toHaveBeenCalledWith(nextConfig);
    expect(manager.config).toBe(nextConfig);
    expect(manager.shouldLog('setting', 'device')).toBe(true);
  });

  it('falls back to default config when readStoredConfig rejects', async () => {
    const store = {
      readStoredConfig: jest
        .fn()
        .mockRejectedValue(new Error('storage corrupt')),
      loadRuntimeConfig: jest.fn(),
      saveConfig: jest.fn(),
    };
    const runtime = { drain: jest.fn() };
    const manager = new LoggerConfigManager({
      env: { isDev: true, isProduction: false, isWebEmbed: false },
      store,
      catalog: { buildConfig: jest.fn(), expandConfig: jest.fn() },
      runtime,
    });

    await manager.init();

    expect(manager.isReady).toBe(true);
    expect(manager.config).toBeDefined();
    expect(runtime.drain).toHaveBeenCalledTimes(1);
  });
});
