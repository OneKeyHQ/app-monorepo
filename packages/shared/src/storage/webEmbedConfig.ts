import { EAppSettingKey } from '@onekeyhq/shared/src/storage/appSetting';
import appStorage from '@onekeyhq/shared/src/storage/appStorage';

export type IWebEmbedConfig = {
  debug: boolean | undefined;
  url: string | undefined;
};

function getWebEmbedConfig(): IWebEmbedConfig | undefined {
  // **** start webembed server:
  // yarn app:web-embed
  // **** build webembed html file:
  // yarn app:web-embed:build

  const text =
    appStorage.getSettingString(EAppSettingKey.onekey_webembed_config) || '';
  if (!text) {
    return undefined;
  }
  return JSON.parse(text) as IWebEmbedConfig;
  // return {
  //   debug: true,
  //   url: undefined,
  //   // url: 'http://localhost:3008/?aaa',
  // };
}

function setWebEmbedConfig(config: IWebEmbedConfig) {
  appStorage.setSetting(
    EAppSettingKey.onekey_webembed_config,
    JSON.stringify(config),
  );
}

export default {
  getWebEmbedConfig,
  setWebEmbedConfig,
};
