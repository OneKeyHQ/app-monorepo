import path from 'path';

import {
  ONEKEY_APP_DEEP_LINK_NAME,
  WALLET_CONNECT_DEEP_LINK_NAME,
} from '@onekeyhq/shared/src/consts/deeplinkConsts';

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

// Reject ASCII control characters (<= 0x20, 0x7f), raw whitespace, and raw double quotes (`"`, 0x22).
// On Windows, unencoded quotes in `%1` can break out of `"%1"` command templates.
function hasUnsafeDeepLinkChars(value: string): boolean {
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    if (code <= 0x20 || code === 0x22 || code === 0x7f) {
      return true;
    }
  }
  return false;
}

export function isAllowedDeepLinkUrl(url: string): boolean {
  if (!url || typeof url !== 'string' || hasUnsafeDeepLinkChars(url)) {
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
  return matches.length === 1 ? matches[0] : undefined;
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
  const isDevServer = !isPackaged && isDev && !isPerfCiMode;
  const isLocalUnpacked = !isPackaged && (isDev || isPerfCiMode);

  return {
    isDev,
    isPerfCiMode,
    isDevServer,
    isLocalUnpacked,
  };
}
