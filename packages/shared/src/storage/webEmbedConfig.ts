import appStorage from '@onekeyhq/shared/src/storage/appStorage';
import { EAppSyncStorageKeys } from '@onekeyhq/shared/src/storage/syncStorage';

export type IWebEmbedConfig = {
  debug: boolean | undefined;
  url: string | undefined;
};

function getWebEmbedConfig(): IWebEmbedConfig | undefined {
  // **** start webembed server:
  // yarn app:web-embed
  // **** build webembed html file:
  // yarn app:web-embed:build

  const config = appStorage.syncStorage.getObject<IWebEmbedConfig>(
    EAppSyncStorageKeys.onekey_webembed_config,
  );
  if (!config) {
    return undefined;
  }
  return config;
  // return {
  //   debug: true,
  //   url: undefined,
  //   // url: 'http://localhost:3008/?aaa',
  // };
}

function setWebEmbedConfig(config: IWebEmbedConfig) {
  appStorage.syncStorage.setObject(
    EAppSyncStorageKeys.onekey_webembed_config,
    config,
  );
}

export default {
  getWebEmbedConfig,
  setWebEmbedConfig,
};
