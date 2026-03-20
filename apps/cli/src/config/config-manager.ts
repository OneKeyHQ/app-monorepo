import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { parse as parseYaml } from 'yaml';
import { AppError } from '../errors';
import { type AppConfig, configSchema } from './config-schema';
import { DEFAULT_CONFIG } from './defaults';

const ENV_MAP: Record<string, keyof AppConfig> = {
  ONEKEY_DEFAULT_CHAIN: 'default_chain',
  ONEKEY_RPC_ENDPOINT: 'rpc_endpoint',
  ONEKEY_OUTPUT_FORMAT: 'output_format',
  ONEKEY_CACHE_TTL: 'cache_ttl',
};

export class ConfigManager {
  private configPath: string;

  constructor(configPath?: string) {
    this.configPath =
      configPath ?? path.join(os.homedir(), '.onekey', 'config.yaml');
  }

  async getConfig(cliOverrides?: Partial<AppConfig>): Promise<AppConfig> {
    const fileConfig = await this.loadConfigFile();
    const envConfig = this.loadEnvVars();
    return this.mergeConfig(fileConfig, envConfig, cliOverrides);
  }

  async loadConfigFile(): Promise<Partial<AppConfig>> {
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
        throw new Error('Config file must be a YAML mapping');
      }
      return parsed as Partial<AppConfig>;
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

  loadEnvVars(): Partial<AppConfig> {
    const envConfig: Partial<AppConfig> = {};
    for (const [envKey, configKey] of Object.entries(ENV_MAP)) {
      const value = process.env[envKey];
      if (value !== undefined) {
        if (configKey === 'cache_ttl') {
          const num = Number(value);
          if (!Number.isNaN(num) && Number.isInteger(num) && num > 0) {
            envConfig.cache_ttl = num;
          }
        } else {
          (envConfig as Record<string, unknown>)[configKey] = value;
        }
      }
    }
    return envConfig;
  }

  mergeConfig(
    fileConfig: Partial<AppConfig>,
    envConfig: Partial<AppConfig>,
    cliOverrides?: Partial<AppConfig>,
  ): AppConfig {
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

function isEnoent(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === 'ENOENT'
  );
}

function stripUndefined(obj: Partial<AppConfig>): Partial<AppConfig> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) result[key] = value;
  }
  return result as Partial<AppConfig>;
}
