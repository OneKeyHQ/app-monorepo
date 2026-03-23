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

  it('returns default values for default_slippage and auto_security_check', async () => {
    const manager = new ConfigManager('/nonexistent/path/config.yaml');
    const config = await manager.getConfig();
    expect(config.default_slippage).toBe(0.5);
    expect(config.auto_security_check).toBe(true);
  });

  it('env var ONEKEY_DEFAULT_SLIPPAGE overrides default_slippage with type conversion', () => {
    const manager = new ConfigManager('/nonexistent/path/config.yaml');
    process.env.ONEKEY_DEFAULT_SLIPPAGE = '1.5';
    const envConfig = manager.loadEnvVars();
    expect(envConfig.default_slippage).toBe(1.5);
    delete process.env.ONEKEY_DEFAULT_SLIPPAGE;
  });

  it('env var ONEKEY_DEFAULT_SLIPPAGE ignores out-of-range values', () => {
    const manager = new ConfigManager('/nonexistent/path/config.yaml');
    process.env.ONEKEY_DEFAULT_SLIPPAGE = '100';
    const envConfig = manager.loadEnvVars();
    expect(envConfig.default_slippage).toBeUndefined();
    delete process.env.ONEKEY_DEFAULT_SLIPPAGE;
  });

  it('env var ONEKEY_AUTO_SECURITY_CHECK overrides auto_security_check with boolean conversion', () => {
    const manager = new ConfigManager('/nonexistent/path/config.yaml');
    process.env.ONEKEY_AUTO_SECURITY_CHECK = 'false';
    const envConfig = manager.loadEnvVars();
    expect(envConfig.auto_security_check).toBe(false);
    delete process.env.ONEKEY_AUTO_SECURITY_CHECK;

    process.env.ONEKEY_AUTO_SECURITY_CHECK = 'true';
    const envConfig2 = manager.loadEnvVars();
    expect(envConfig2.auto_security_check).toBe(true);
    delete process.env.ONEKEY_AUTO_SECURITY_CHECK;
  });

  it('CLI overrides for new config fields take highest priority', async () => {
    const manager = new ConfigManager('/nonexistent/path/config.yaml');
    const config = await manager.getConfig({
      default_slippage: 3.0,
      auto_security_check: false,
    });
    expect(config.default_slippage).toBe(3.0);
    expect(config.auto_security_check).toBe(false);
  });
});
