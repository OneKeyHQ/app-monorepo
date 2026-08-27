import type { IDevSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/devSettings';
import {
  TRADING_VIEW_URL,
  TRADING_VIEW_URL_TEST,
} from '@onekeyhq/shared/src/config/appConfig';

const TRUSTED_TRADING_VIEW_ORIGINS = new Set([
  new URL(TRADING_VIEW_URL).origin,
  new URL(TRADING_VIEW_URL_TEST).origin,
]);
const TRADING_VIEW_EMBED_MANIFEST_FILE = 'embed-manifest.json';
const TRADING_VIEW_EMBED_DIRECTORY = 'embed';
const TRADING_VIEW_EMBED_VERSION_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/;

export interface IPinnedTradingViewEmbedManifestUrl {
  manifestUrl: string;
  runtimeBaseUrl: string;
  version: string;
}

export function parsePinnedTradingViewEmbedManifestUrl(
  value: string | undefined,
): IPinnedTradingViewEmbedManifestUrl | undefined {
  if (!value?.trim()) {
    return undefined;
  }

  try {
    const url = new URL(value);
    const pathParts = url.pathname.split('/').filter(Boolean);
    const version = pathParts[0] ?? '';
    const embedDirectory = pathParts[1];
    const manifestFile = pathParts[2];
    if (
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      !TRUSTED_TRADING_VIEW_ORIGINS.has(url.origin) ||
      pathParts.length !== 3 ||
      !TRADING_VIEW_EMBED_VERSION_PATTERN.test(version) ||
      embedDirectory !== TRADING_VIEW_EMBED_DIRECTORY ||
      manifestFile !== TRADING_VIEW_EMBED_MANIFEST_FILE
    ) {
      return undefined;
    }

    return {
      manifestUrl: url.toString(),
      runtimeBaseUrl: url.origin,
      version,
    };
  } catch {
    return undefined;
  }
}

export function getTradingViewBaseUrl({
  devSettings,
  localTradingViewUrl,
}: {
  devSettings: IDevSettingsPersistAtom;
  localTradingViewUrl: string;
}) {
  if (devSettings.enabled && devSettings.settings?.useLocalTradingViewUrl) {
    return localTradingViewUrl;
  }

  if (devSettings.enabled) {
    return TRADING_VIEW_URL_TEST;
  }

  return TRADING_VIEW_URL;
}
