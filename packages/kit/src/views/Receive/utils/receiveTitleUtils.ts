// A title that carries its token's logo: the logo, and the localized sentence
// as the two blocks a renderer lays out, the words and the logo with the
// symbol.
export type IReceiveTitleLogo = {
  uri: string;
  symbol: string;
  // The words of the sentence on either side of the symbol, without the
  // space that sets them apart from it.
  before: string;
  after: string;
  // Whether the sentence has that space ("Receive USDT", but "USDTを受け取る").
  hasGap: boolean;
};

// Stands in for the token while the sentence is formatted, so the place the
// translation gives the token can be read back. U+FFFC is Unicode's own
// placeholder for an object embedded in text.
const TOKEN_PLACEHOLDER = '￼';

// Splits the localized "Receive {token}" sentence around the token, so the
// logo can sit right before the symbol whichever side the locale puts it on
// (ja, ko, hi and bn lead with the token). Undefined means a plain title:
// there is no logo, or the sentence has no single place for one.
export function buildReceiveTitleLogo({
  uri,
  symbol,
  formatTitle,
}: {
  uri: string | undefined;
  symbol: string;
  formatTitle: (token: string) => string;
}): IReceiveTitleLogo | undefined {
  if (!uri || !symbol) return undefined;
  const pieces = formatTitle(TOKEN_PLACEHOLDER).split(TOKEN_PLACEHOLDER);
  if (pieces.length !== 2) return undefined;
  const [rawBefore, rawAfter] = pieces;
  const before = rawBefore.trim();
  const after = rawAfter.trim();
  return {
    uri,
    symbol,
    before,
    after,
    hasGap:
      (Boolean(before) && /\s$/.test(rawBefore)) ||
      (Boolean(after) && /^\s/.test(rawAfter)),
  };
}

// The logo shown before the symbol in the title, or undefined for none.
export function resolveReceiveTitleIconURI({
  isNetworkEntry,
  tokenLogoURI,
  groupLogoURI,
}: {
  // Entered by network: the title names no token.
  isNetworkEntry: boolean;
  // Logo of the token the page was opened with. A page opened without one
  // titles itself with the network's own coin, which the user never picked,
  // and gets no logo.
  tokenLogoURI?: string;
  // Logo of the multi-chain group, passed only while the title shows the
  // group's common symbol, so icon and symbol come from the same level. A
  // group with no logo of its own falls back to the token's: the member on
  // screen is the same asset, and the title should not lose its icon on a
  // network switch.
  groupLogoURI?: string;
}): string | undefined {
  if (isNetworkEntry) return undefined;
  return groupLogoURI || tokenLogoURI || undefined;
}
