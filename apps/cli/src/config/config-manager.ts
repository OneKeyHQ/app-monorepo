import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { parse as parseYaml } from 'yaml';

import { AppError } from '../errors';

import { type IAppConfig, configSchema } from './config-schema';
import { DEFAULT_CONFIG } from './defaults';

const ENV_MAP: Record<string, keyof IAppConfig> = {
  ONEKEY_DEFAULT_CHAIN: 'default_chain',
  ONEKEY_RPC_ENDPOINT: 'rpc_endpoint',
  ONEKEY_OUTPUT_FORMAT: 'output_format',
  ONEKEY_CACHE_TTL: 'cache_ttl',
  ONEKEY_DEFAULT_SLIPPAGE: 'default_slippage',
  ONEKEY_AUTO_SECURITY_CHECK: 'auto_security_check',
};

function isEnoent(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === 'ENOENT'
  );
}

function stripUndefined(obj: Partial<IAppConfig>): Partial<IAppConfig> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) result[key] = value;
  }
  return result as Partial<IAppConfig>;
}

export class ConfigManager {
  private configPath: string;

  constructor(configPath?: string) {
    this.configPath =
      configPath ?? path.join(os.homedir(), '.onekey', 'config.yaml');
  }

  async getConfig(cliOverrides?: Partial<IAppConfig>): Promise<IAppConfig> {
    const fileConfig = await this.loadConfigFile();
    const envConfig = this.loadEnvVars();
    return this.mergeConfig(fileConfig, envConfig, cliOverrides);
  }

  async loadConfigFile(): Promise<Partial<IAppConfig>> {
    let content: string;
    try {
      content = await fs.readFile(this.configPath, 'utf-8');
    } catch (error: unknown) {
      if (isEnoent(error)) {
        return {};
      }
      throw new AppError(
        'PARAM_INVALID_CONFIG',
        `Failed to read config: ${this.configPath}`,
        'Check file permissions for ~/.onekey/config.yaml',
        { cause: error },
      );
    }

    try {
      const parsed: unknown = parseYaml(content);
      if (parsed === null || parsed === undefined) return {};
      if (typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new AppError(
          'PARAM_INVALID_CONFIG',
          'Config file must be a YAML mapping',
          'Check ~/.onekey/config.yaml syntax',
        );
      }
      return parsed as Partial<IAppConfig>;
    } catch (error: unknown) {
      if (error instanceof AppError) throw error;
      throw new AppError(
        'PARAM_INVALID_CONFIG',
        `Invalid YAML: ${error instanceof Error ? error.message : String(error)}`,
        'Check ~/.onekey/config.yaml syntax',
        { cause: error },
      );
    }
  }

  loadEnvVars(): Partial<IAppConfig> {
    const envConfig: Partial<IAppConfig> = {};
    for (const [envKey, configKey] of Object.entries(ENV_MAP)) {
      const value = process.env[envKey];
      if (value !== undefined) {
        if (configKey === 'cache_ttl') {
          const num = Number(value);
          if (!Number.isNaN(num) && Number.isInteger(num) && num > 0) {
            envConfig.cache_ttl = num;
          }
        } else if (configKey === 'default_slippage') {
          const num = Number(value);
          if (!Number.isNaN(num) && num >= 0.05 && num <= 50) {
            envConfig.default_slippage = num;
          }
        } else if (configKey === 'auto_security_check') {
          envConfig.auto_security_check = value === 'true';
        } else {
          (envConfig as Record<string, unknown>)[configKey] = value;
        }
      }
    }
    return envConfig;
  }

  mergeConfig(
    fileConfig: Partial<IAppConfig>,
    envConfig: Partial<IAppConfig>,
    cliOverrides?: Partial<IAppConfig>,
  ): IAppConfig {
    const merged = {
      ...DEFAULT_CONFIG,
      ...stripUndefined(fileConfig),
      ...stripUndefined(envConfig),
      ...stripUndefined(cliOverrides ?? {}),
    };
    const result = configSchema.safeParse(merged);
    if (!result.success) {
      throw new AppError(
        'PARAM_INVALID_CONFIG',
        `Config validation failed: ${result.error.message}`,
        'Run "onekey --help" for valid options',
      );
    }
    return result.data;
  }
}
