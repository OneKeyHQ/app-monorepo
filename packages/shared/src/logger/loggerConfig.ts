import { debounce, merge } from 'lodash';
import natsort from 'natsort';

import appGlobals from '../appGlobals';
import platformEnv from '../platformEnv';
import appStorage from '../storage/appStorage';

import type { BaseScene } from './base/baseScene';
import type { BaseScope } from './base/baseScope';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ILoggerConfig = {
  highlightDurationGt?: string;
  colorfulLog?: boolean;
  enabled: {
    [scope: string]: {
      [scene: string]: boolean;
    };
  };
};

// ---------------------------------------------------------------------------
// LoggerConfigManager — single source of truth for logger configuration
//
// Responsibilities:
//   1. Load/save the developer debug-panel config from appStorage
//   2. Decide whether a given scope/scene should output to console
//   3. Queue log entries emitted before config is ready, drain on init
//   4. In production / webEmbed, skip scope scanning to preserve lazy loading
// ---------------------------------------------------------------------------

const STORAGE_KEY = '$$OneKeyV5LoggerConfig';

class LoggerConfigManager {
  private _config: ILoggerConfig | undefined;

  private _pendingEntries: Array<{
    entry: unknown;
    processor: (entry: unknown) => void;
  }> = [];

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  /** Whether config has been loaded and is ready for use. */
  get isReady(): boolean {
    return !!this._config;
  }

  /** Current config snapshot (undefined before init). */
  get config(): ILoggerConfig | undefined {
    return this._config;
  }

  /**
   * Whether a scope/scene should output to console.
   *
   * - Production: always true (config.enabled is irrelevant)
   * - Dev: true only if explicitly enabled in the debug panel
   */
  shouldLog(scopeName: string, sceneName: string): boolean {
    if (!platformEnv.isDev) return true;
    return !!this._config?.enabled?.[scopeName]?.[sceneName];
  }

  /** Whether colorful log output is enabled (dev only). */
  get colorfulLog(): boolean {
    return !!this._config?.colorfulLog;
  }

  /** Duration threshold (ms) above which logs are highlighted red. */
  get highlightDurationGt(): string {
    return this._config?.highlightDurationGt || '100';
  }

  /**
   * If config is ready, run processor immediately.
   * Otherwise queue the entry and drain when init completes.
   */
  enqueueOrProcess<T>(entry: T, processor: (e: T) => void): void {
    if (this.isReady) {
      processor(entry);
    } else {
      this._pendingEntries.push({
        entry,
        processor: processor as (e: unknown) => void,
      });
    }
  }

  /**
   * Load config from storage. Called once at startup.
   * In production / webEmbed, uses a minimal config to avoid
   * triggering lazy scope loaders via buildLoggerConfig().
   */
  async init(): Promise<void> {
    if (platformEnv.isWebEmbed || platformEnv.isProduction) {
      this._config = {
        highlightDurationGt: '100',
        colorfulLog: false,
        enabled: {},
      };
    } else {
      this._config = await this._loadFromStorage();
    }
    this._drainPendingEntries();
  }

  // -----------------------------------------------------------------------
  // Debug panel API (dev only)
  // -----------------------------------------------------------------------

  /** Get the full config for the debug panel UI. */
  async getSavedLoggerConfig(): Promise<ILoggerConfig> {
    if (this._config) return this._config;
    this._config = await this._loadFromStorage();
    return this._config;
  }

  /** Save updated config from the debug panel. */
  saveLoggerConfig = debounce(
    async (config: ILoggerConfig) => {
      await appStorage.setItem(STORAGE_KEY, JSON.stringify(config));
      if (this._config) {
        Object.assign(this._config, config);
      }
    },
    300,
    { leading: false, trailing: true },
  );

  /**
   * Build the full scope/scene config map by scanning all scopes.
   * Only used by the dev debug panel — triggers all lazy scope loaders.
   */
  buildLoggerConfig(): ILoggerConfig {
    const config: ILoggerConfig = {
      highlightDurationGt: '100',
      colorfulLog: true,
      enabled: {},
    };
    const defaultLoggerInstance =
      (appGlobals.$defaultLogger as unknown as Record<string, BaseScope>) || {};
    // Enumerate lazy getter names from prototype (Object.keys only finds own properties)
    const scopeKeys = Object.getOwnPropertyNames(
      Object.getPrototypeOf(defaultLoggerInstance),
    ).filter((key) => key !== 'constructor' && !key.startsWith('_'));
    scopeKeys
      .toSorted((a, b) => natsort({ insensitive: true })(a, b))
      .forEach((scope) => {
        config.enabled[scope] = config.enabled[scope] || {};
        Object.keys(
          (defaultLoggerInstance as unknown as Record<string, BaseScope>)[
            scope
          ] || {},
        )
          .toSorted((a, b) => natsort({ insensitive: true })(a, b))
          .forEach((scene) => {
            if (defaultLoggerInstance[scope]) {
              const sceneInstance = (
                defaultLoggerInstance[scope] as unknown as Record<
                  string,
                  BaseScene
                >
              )[scene];
              try {
                // Duck-type check: real scene instances have _emitLog
                const isScene =
                  sceneInstance && typeof sceneInstance._emitLog === 'function';
                if (isScene) {
                  config.enabled[scope][scene] = false;
                }
              } catch (_error) {
                //
              }
            }
          });
      });
    return config;
  }

  // -----------------------------------------------------------------------
  // Private
  // -----------------------------------------------------------------------

  private async _loadFromStorage(): Promise<ILoggerConfig> {
    const stored = await appStorage.getItem(STORAGE_KEY);
    return stored
      ? merge(
          this.buildLoggerConfig(),
          (JSON.parse(stored) as ILoggerConfig) || {},
        )
      : this.buildLoggerConfig();
  }

  private _drainPendingEntries(): void {
    const queued = this._pendingEntries;
    this._pendingEntries = [];
    for (const { entry, processor } of queued) {
      processor(entry);
    }
  }
}

// Singleton instance
const loggerConfig = new LoggerConfigManager();

// Kick off init immediately (async, non-blocking)
void loggerConfig.init();

export { loggerConfig };

// Backward-compatible alias for existing consumers (debug panel)
export const defaultLoggerConfig = {
  buildLoggerConfig: () => loggerConfig.buildLoggerConfig(),
  getSavedLoggerConfig: () => loggerConfig.getSavedLoggerConfig(),
  saveLoggerConfig: loggerConfig.saveLoggerConfig,
};
