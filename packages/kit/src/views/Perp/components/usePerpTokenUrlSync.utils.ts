import { getSpotTokenDisplayName } from '@onekeyhq/shared/src/utils/perpsUtils';
import type { ISpotUniverse } from '@onekeyhq/shared/types/hyperliquid';
import {
  DEX_PREFIXES,
  DEX_SEPARATOR,
  MAIN_DEX_SHADOWED_DEX_PREFIXES,
} from '@onekeyhq/shared/types/hyperliquid/perp.constants';
import type { IPerpDexPrefix } from '@onekeyhq/shared/types/hyperliquid/perp.constants';

export const SPOT_PAIR_SEPARATOR = '_';

// Longest prefix first so a shorter one cannot shadow it. Bare-prefix matching
// has to stay: legacy links omit the separator (`xyzNVDA`).
function findDexPrefix(token: string): IPerpDexPrefix | null {
  const lowerToken = token.toLowerCase();
  return (
    [...DEX_PREFIXES]
      .toSorted((a, b) => b.length - a.length)
      .find((prefix) => lowerToken.startsWith(prefix)) ?? null
  );
}

export function encodeCoinForUrl(params: {
  coin: string;
  mode: 'perp' | 'spot';
  spotUniverse?: ISpotUniverse;
}): string {
  const { coin, mode, spotUniverse } = params;
  if (!coin) return '';

  // Spot raw forms (`@149`, `PURR/USDC`, `UETH`) URL-encode to `%40149` /
  // `PURR%2FUSDC` — unreadable. Use BASE_QUOTE with the normalized base name
  // when the universe is available; perp falls through to the upper-cased coin.
  if (mode === 'spot' && spotUniverse) {
    const base = getSpotTokenDisplayName(spotUniverse.baseName);
    return `${base}${SPOT_PAIR_SEPARATOR}${spotUniverse.quoteName}`;
  }

  const dexPrefix = findDexPrefix(coin);
  if (dexPrefix && coin.includes(DEX_SEPARATOR)) {
    const symbol = coin.slice(dexPrefix.length + DEX_SEPARATOR.length);
    // Without the separator a main-dex symbol starting with a registered prefix
    // is indistinguishable from a sub-DEX token on decode.
    return `${dexPrefix}${DEX_SEPARATOR}${symbol.toUpperCase()}`;
  }

  return coin.toUpperCase();
}

export function decodeCoinFromUrl(urlToken: string): {
  coin: string;
  // Separator-free legacy links are ambiguous; the caller must confirm the
  // guess against the universe.
  isAmbiguousLegacyGuess: boolean;
  // What to use when the universe cannot confirm the guess: whichever reading
  // could name a real market. Only a prefix shadowed by a main-DEX symbol has a
  // literal reading worth keeping (`IOTA` over `io:TA`); elsewhere the literal
  // form is no market at all, so the split guess stays.
  unverifiedFallbackCoin: string;
} {
  if (!urlToken)
    return {
      coin: '',
      isAmbiguousLegacyGuess: false,
      unverifiedFallbackCoin: '',
    };

  const literalCoin = urlToken.toUpperCase();
  const dexPrefix = findDexPrefix(urlToken);
  if (dexPrefix && urlToken.length > dexPrefix.length) {
    const hasNoSeparator = !urlToken.includes(DEX_SEPARATOR);
    const symbolStartIndex = hasNoSeparator
      ? dexPrefix.length
      : dexPrefix.length + DEX_SEPARATOR.length;
    const symbol = urlToken.slice(symbolStartIndex);
    const coin = `${dexPrefix}${DEX_SEPARATOR}${symbol.toUpperCase()}`;
    const isTrustedWithoutUniverse =
      !hasNoSeparator || !MAIN_DEX_SHADOWED_DEX_PREFIXES.includes(dexPrefix);
    return {
      coin,
      isAmbiguousLegacyGuess: hasNoSeparator,
      unverifiedFallbackCoin: isTrustedWithoutUniverse ? coin : literalCoin,
    };
  }

  return {
    coin: literalCoin,
    isAmbiguousLegacyGuess: false,
    unverifiedFallbackCoin: literalCoin,
  };
}
