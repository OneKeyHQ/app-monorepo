import {
  BINANCE_DEPOSIT_RETURN_HOST,
  BINANCE_DEPOSIT_RETURN_SCHEME,
} from '@onekeyhq/shared/src/consts/binanceDepositConsts';

// Kept apart from binanceDepositReturn.ts on purpose. The generic deep link
// entry imports this check statically on every platform, so this file may
// depend on nothing but the two constants: the handler itself, with the URL
// parser and the background call, is only loaded on native once a return
// actually arrives.

const RETURN_SCHEME_PREFIX = `${BINANCE_DEPOSIT_RETURN_SCHEME}:`;

// True for any onekey-wallet deep link addressed to the binance-connect host,
// whatever its path or query. Deliberately wider than the exact return URL: a
// return that came back with an altered path still carries the nonce, so the
// whole host is kept out of the generic deep link pipeline (which logs the URL
// and forwards it to bg) and is consumed by the OS entry only.
//
// String comparison only: it must stay synchronous and must not hand the URL
// to anything that could print or report it.
export function isBinanceConnectDeepLink(url?: string | null): boolean {
  if (
    typeof url !== 'string' ||
    url.slice(0, RETURN_SCHEME_PREFIX.length).toLowerCase() !==
      RETURN_SCHEME_PREFIX
  ) {
    return false;
  }
  const afterScheme = url
    .slice(RETURN_SCHEME_PREFIX.length)
    .replace(/^\/+/, '');
  const hostEnd = afterScheme.search(/[/?#]/);
  const host = hostEnd >= 0 ? afterScheme.slice(0, hostEnd) : afterScheme;
  return host.toLowerCase() === BINANCE_DEPOSIT_RETURN_HOST;
}
