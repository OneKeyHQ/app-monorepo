export type IWebEmbedOnekeyAppSettings = {
  themeVariant: string;
  localeVariant: string;
  revenuecatApiKey: string;
};

function getSettings(): IWebEmbedOnekeyAppSettings | undefined {
  const settings = globalThis.WEB_EMBED_ONEKEY_APP_SETTINGS;
  return settings;
}

export default {
  getSettings,
};
