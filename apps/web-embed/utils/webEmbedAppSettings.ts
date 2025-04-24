export type IWebEmbedOnekeyAppSettings = {
  isDev: boolean;
  enableTestEndpoint: boolean;
  themeVariant: string;
  localeVariant: string;
  revenuecatApiKey: string;
  instanceId: string;
  platform: string;
  appBuildNumber: string;
  appVersion: string;
};

function getSettings(): IWebEmbedOnekeyAppSettings | undefined {
  const settings = globalThis.WEB_EMBED_ONEKEY_APP_SETTINGS;
  return settings;
}

export default {
  getSettings,
};
