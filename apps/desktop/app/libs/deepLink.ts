import {
  ONEKEY_APP_DEEP_LINK_NAME,
  WALLET_CONNECT_DEEP_LINK_NAME,
} from '@onekeyhq/shared/src/consts/deeplinkConsts';

const ALLOWED_DEEP_LINK_SCHEMES = [
  `${ONEKEY_APP_DEEP_LINK_NAME}:`,
  `${WALLET_CONNECT_DEEP_LINK_NAME}:`,
  'ethereum:',
] as const;

export function isAllowedDeepLinkUrl(url: string): boolean {
  return ALLOWED_DEEP_LINK_SCHEMES.some((scheme) => url.startsWith(scheme));
}

export function findAllowedDeepLinkArg(
  argv: readonly string[],
): string | undefined {
  return argv.find((arg) => isAllowedDeepLinkUrl(arg));
}
