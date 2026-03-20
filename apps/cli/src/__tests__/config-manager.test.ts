import { ConfigManager } from '../config/config-manager';
import { DEFAULT_CONFIG } from '../config/defaults';

describe('ConfigManager', () => {
  it('returns defaults when no config file exists', async () => {
    const manager = new ConfigManager('/nonexistent/path/config.yaml');
    const config = await manager.getConfig();
    expect(config.default_chain).toBe(DEFAULT_CONFIG.default_chain);
  });

  it('env vars override file config', () => {
    const manager = new ConfigManager('/nonexistent/path/config.yaml');
    process.env.ONEKEY_DEFAULT_CHAIN = 'polygon';
    const envConfig = manager.loadEnvVars();
    expect(envConfig.default_chain).toBe('polygon');
    delete process.env.ONEKEY_DEFAULT_CHAIN;
  });

  it('CLI overrides take highest priority', async () => {
    const manager = new ConfigManager('/nonexistent/path/config.yaml');
    const config = await manager.getConfig({ default_chain: 'arbitrum' });
    expect(config.default_chain).toBe('arbitrum');
  });
});
