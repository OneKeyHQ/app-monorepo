import { debounce, merge } from 'lodash';

import appStorage from '../../storage/appStorage';

import {
  LOGGER_CONFIG_STORAGE_KEY,
  createDefaultLoggerConfig,
} from './loggerConfigShared';

import type { ILoggerConfig } from './loggerConfigShared';

export class LoggerConfigStore {
  async readStoredConfig(): Promise<ILoggerConfig | undefined> {
    const stored = await appStorage.getItem(LOGGER_CONFIG_STORAGE_KEY);
    if (!stored) return undefined;
    const parsed = JSON.parse(stored) as ILoggerConfig | null;
    if (!parsed || typeof parsed !== 'object') return undefined;
    return parsed;
  }

  async loadRuntimeConfig({
    colorfulLog,
  }: {
    colorfulLog: boolean;
  }): Promise<ILoggerConfig> {
    const stored = await this.readStoredConfig();
    return merge(createDefaultLoggerConfig({ colorfulLog }), stored || {});
  }

  saveConfig = debounce(
    async (config: ILoggerConfig) => {
      await appStorage.setItem(
        LOGGER_CONFIG_STORAGE_KEY,
        JSON.stringify(config),
      );
    },
    300,
    {
      leading: false,
      trailing: true,
    },
  );
}
