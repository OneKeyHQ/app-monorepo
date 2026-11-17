import path from 'path';

import {
  ONEKEY_APP_DEEP_LINK_NAME,
  WALLET_CONNECT_DEEP_LINK_NAME,
  hasUnsafeUrlChars,
} from '@onekeyhq/shared/src/consts/deeplinkConsts';

export { hasUnsafeUrlChars };

export const ETHEREUM_DEEP_LINK_NAME = 'ethereum';

export const DESKTOP_DEEP_LINK_PROTOCOLS = [
  ONEKEY_APP_DEEP_LINK_NAME,
  WALLET_CONNECT_DEEP_LINK_NAME,
  ETHEREUM_DEEP_LINK_NAME,
] as const;

const ALLOWED_DEEP_LINK_SCHEMES = [
  `${ONEKEY_APP_DEEP_LINK_NAME}:`,
  `${WALLET_CONNECT_DEEP_LINK_NAME}:`,
  `${ETHEREUM_DEEP_LINK_NAME}:`,
] as const;

export const MAX_DESKTOP_DEEP_LINK_URL_LENGTH = 4096;

export function isAllowedDeepLinkUrl(url: string): boolean {
  if (
    !url ||
    typeof url !== 'string' ||
    url.length > MAX_DESKTOP_DEEP_LINK_URL_LENGTH ||
    hasUnsafeUrlChars(url)
  ) {
    return false;
  }
  if (!ALLOWED_DEEP_LINK_SCHEMES.some((scheme) => url.startsWith(scheme))) {
    return false;
  }
  try {
    const parsed = new URL(url);
    return ALLOWED_DEEP_LINK_SCHEMES.includes(
      parsed.protocol as (typeof ALLOWED_DEEP_LINK_SCHEMES)[number],
    );
  } catch {
    return false;
  }
}

export function findAllowedDeepLinkArg(
  argv: readonly string[],
): string | undefined {
  const separatorIndex = argv.indexOf('--');
  if (separatorIndex !== -1) {
    const postSeparatorArgs = argv.slice(separatorIndex + 1);
    // Protocol registration appends `"--"` before `"%1"`, so a legitimate launch
    // produces a single argument after `--`. Multiple post-separator arguments
    // indicate quote-splitting injection and must be rejected.
    if (postSeparatorArgs.length !== 1) {
      return undefined;
    }
    return isAllowedDeepLinkUrl(postSeparatorArgs[0])
      ? postSeparatorArgs[0]
      : undefined;
  }

  const matches = argv.slice(1).filter((arg) => isAllowedDeepLinkUrl(arg));
  if (matches.length !== 1) {
    return undefined;
  }
  const candidate = matches[0];
  // Even when `--` is absent (e.g. Linux `.desktop` `%U` launches), `%U`/`%1` is
  // placed at the end of the command template, so any trailing argument after
  // the deep link URL indicates multi-argument injection and must be rejected.
  return argv[argv.length - 1] === candidate ? candidate : undefined;
}

export function getDesktopProtocolClientArgs(
  defaultApp = Boolean(process.defaultApp),
  argv: readonly string[] = process.argv,
): string[] {
  if (defaultApp && argv.length >= 2 && argv[1]) {
    return [path.resolve(argv[1]), '--'];
  }
  return ['--'];
}

export interface IDesktopRuntimeFlagsInput {
  isPackaged: boolean;
  electronIsDev?: boolean;
  env?: Readonly<Record<string, string | undefined>>;
}

export interface IDesktopRuntimeFlags {
  isDev: boolean;
  isPerfCiMode: boolean;
  isDevServer: boolean;
  isLocalUnpacked: boolean;
  isDesktopE2EMode: boolean;
}

export function resolveDesktopRuntimeFlags({
  isPackaged,
  electronIsDev,
  env = process.env,
}: IDesktopRuntimeFlagsInput): IDesktopRuntimeFlags {
  let rawIsDev: boolean;
  if (typeof electronIsDev === 'boolean') {
    rawIsDev = electronIsDev;
  } else if ('ELECTRON_IS_DEV' in env) {
    rawIsDev = Number.parseInt(env.ELECTRON_IS_DEV ?? '', 10) === 1;
  } else {
    rawIsDev = !isPackaged;
  }
  const isDev = !isPackaged && rawIsDev;
  const isPerfCiMode = !isPackaged && env.PERF_CI_MODE === '1';
  const isDesktopE2EMode = !isPackaged && env.DESKTOP_E2E_MODE === 'true';
  const isDevServer = !isPackaged && isDev && !isPerfCiMode;
  const isLocalUnpacked = !isPackaged && (isDev || isPerfCiMode);

  return {
    isDev,
    isPerfCiMode,
    isDevServer,
    isLocalUnpacked,
    isDesktopE2EMode,
  };
}
