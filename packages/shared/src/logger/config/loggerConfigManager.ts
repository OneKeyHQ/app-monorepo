import { merge } from 'lodash';

import platformEnv from '../../platformEnv';
import { loggerRuntime } from '../runtime/loggerRuntime';

import { createDefaultLoggerConfig } from './loggerConfigShared';
import { LoggerConfigStore } from './loggerConfigStore';
import { LoggerDebugCatalog } from './loggerDebugCatalog';

import type { ILoggerConfig } from './loggerConfigShared';
import type { LoggerRuntime } from '../runtime/loggerRuntime';

type ILoggerConfigEnv = Pick<
  typeof platformEnv,
  'isDev' | 'isProduction' | 'isWebEmbed'
>;

type ILoggerConfigStoreLike = {
  readStoredConfig: LoggerConfigStore['readStoredConfig'];
  loadRuntimeConfig: LoggerConfigStore['loadRuntimeConfig'];
  saveConfig: (config: ILoggerConfig) => void | Promise<void>;
};

type ILoggerDebugCatalogLike = Pick<
  LoggerDebugCatalog,
  'buildConfig' | 'expandConfig'
>;

type ILoggerRuntimeLike = Pick<LoggerRuntime, 'drain'>;

type ILoggerConfigManagerParams = {
  env?: ILoggerConfigEnv;
  store?: ILoggerConfigStoreLike;
  catalog?: ILoggerDebugCatalogLike;
  runtime?: ILoggerRuntimeLike;
};

export class LoggerConfigManager {
  private _config: ILoggerConfig | undefined;

  private _hasExpandedConfig = false;

  // Cache stored config from init's loadRuntimeConfig to avoid re-reading
  // storage on first getSavedLoggerConfig() call.
  private _cachedStoredConfig?: ILoggerConfig;

  private readonly _env: ILoggerConfigEnv;

  private readonly _store: ILoggerConfigStoreLike;

  private readonly _catalog: ILoggerDebugCatalogLike;

  private readonly _runtime: ILoggerRuntimeLike;

  constructor({
    env = platformEnv,
    store = new LoggerConfigStore(),
    catalog = new LoggerDebugCatalog(),
    runtime = loggerRuntime,
  }: ILoggerConfigManagerParams = {}) {
    this._env = env;
    this._store = store;
    this._catalog = catalog;
    this._runtime = runtime;
  }

  get isReady(): boolean {
    return !!this._config;
  }

  get config(): ILoggerConfig | undefined {
    return this._config;
  }

  shouldLog(scopeName: string, sceneName: string): boolean {
    if (!this._env.isDev) {
      return true;
    }
    return !!this._config?.enabled?.[scopeName]?.[sceneName];
  }

  get colorfulLog(): boolean {
    return !!this._config?.colorfulLog;
  }

  get highlightDurationGt(): string {
    return this._config?.highlightDurationGt || '100';
  }

  async init(): Promise<void> {
    try {
      if (this._env.isWebEmbed || this._env.isProduction) {
        this._config = createDefaultLoggerConfig({ colorfulLog: false });
      } else {
        // Cache stored config so getSavedLoggerConfig() can reuse it
        // instead of re-reading storage.
        this._cachedStoredConfig = await this._store.readStoredConfig();
        this._config = merge(
          createDefaultLoggerConfig({ colorfulLog: true }),
          this._cachedStoredConfig || {},
        );
      }
    } catch {
      this._config = createDefaultLoggerConfig({ colorfulLog: false });
    }
    this._hasExpandedConfig = false;
    this._runtime.drain();
  }

  async getSavedLoggerConfig(): Promise<ILoggerConfig> {
    if (this._config && this._hasExpandedConfig) {
      return this._config;
    }

    // Reuse cached stored config from init() if available,
    // avoiding a duplicate storage read + JSON parse.
    const storedConfig =
      this._cachedStoredConfig ?? (await this._store.readStoredConfig());
    this._cachedStoredConfig = undefined;
    this._config = this._catalog.expandConfig(storedConfig);
    this._hasExpandedConfig = true;
    return this._config;
  }

  saveLoggerConfig(config: ILoggerConfig): void {
    this.updateRuntimeConfig(config);
    void this._store.saveConfig(config);
  }

  buildLoggerConfig(): ILoggerConfig {
    return this._catalog.buildConfig();
  }

  updateRuntimeConfig(config: ILoggerConfig): void {
    if (this._config) {
      Object.assign(this._config, config);
    } else {
      this._config = config;
    }
    this._hasExpandedConfig = true;
  }
}

export function createLoggerConfigFacade(manager: LoggerConfigManager) {
  return {
    buildLoggerConfig: () => manager.buildLoggerConfig(),
    getSavedLoggerConfig: () => manager.getSavedLoggerConfig(),
    saveLoggerConfig: (config: ILoggerConfig) =>
      manager.saveLoggerConfig(config),
  };
}
