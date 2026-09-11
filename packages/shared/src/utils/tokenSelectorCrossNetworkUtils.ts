import { getNetworkIdsMap } from '../config/networkIds';

import { memoFn } from './cacheUtils';

import type { IServerNetwork } from '../../types';
import type { IAccountToken } from '../../types/token';

// Longest preset network name is 3 words ("Ethereum Sepolia Testnet"); 4 keeps
// headroom while bounding the span scan.
const MAX_NETWORK_NAME_WORDS = 4;

const SEPARATOR_CHARS = new Set(['-', '_', '/', '+']);

// CJK detection is a hand-rolled range check: Hermes lacks reliable
// \p{Script} support, and regex lookbehind is unavailable there too.
function isCjkCodePoint(codePoint: number): boolean {
  return (
    (codePoint >= 0x2e_80 && codePoint <= 0x2f_ff) || // CJK radicals
    (codePoint >= 0x30_40 && codePoint <= 0x30_ff) || // Hiragana / Katakana
    (codePoint >= 0x34_00 && codePoint <= 0x4d_bf) || // CJK ext A
    (codePoint >= 0x4e_00 && codePoint <= 0x9f_ff) || // CJK unified
    (codePoint >= 0xac_00 && codePoint <= 0xd7_af) || // Hangul syllables
    (codePoint >= 0xf9_00 && codePoint <= 0xfa_ff) || // CJK compatibility
    (codePoint >= 0x2_00_00 && codePoint <= 0x3_ff_ff) // CJK ext B and beyond
  );
}

// Splits a raw search string into lowercase words on whitespace, common
// symbol-network separators (- _ / +), and ASCII↔CJK boundaries, so grassroots
// spellings like "USDT-Trc20" or "usdt波场" become ['usdt', 'trc20'-like]
// pairs. Anything else (dots, colons, 0x…) stays inside the word, keeping
// separator-free contract addresses verbatim.
export function tokenizeTokenSearchKeywords(raw: string): string[] {
  const text = raw.toLowerCase();
  const tokens: string[] = [];
  let current = '';
  let currentIsCjk = false;
  const flush = () => {
    if (current) {
      tokens.push(current);
      current = '';
    }
  };
  for (const char of text) {
    if (SEPARATOR_CHARS.has(char) || /\s/.test(char)) {
      flush();
    } else {
      const isCjk = isCjkCodePoint(char.codePointAt(0) ?? 0);
      if (current && isCjk !== currentIsCjk) {
        flush();
      }
      current += char;
      currentIsCjk = isCjk;
    }
  }
  flush();
  return tokens;
}

// First batch of user-facing network aliases, sourced from support-ticket
// vocabulary. Matched with exact equality only — never includes — so "trc"
// or "c20" cannot accidentally scope a search. Extend per new complaint data.
export const getTokenNetworkAliasMap = memoFn((): Record<string, string[]> => {
  const networkIds = getNetworkIdsMap();
  return {
    [networkIds.trx]: ['trc20', '波场', '波場'],
    [networkIds.eth]: ['erc20'],
    [networkIds.bsc]: ['bep20'],
  };
});

function normalizePhrase(value: string): string {
  return tokenizeTokenSearchKeywords(value).join(' ');
}

export enum ETokenSelectorSyntheticRowType {
  CurrentNetworkHeader = 'currentNetworkHeader',
  OtherNetworksHeader = 'otherNetworksHeader',
  CurrentNetworkNoMatch = 'currentNetworkNoMatch',
  OtherNetworksSearchError = 'otherNetworksSearchError',
}

export type ITokenSelectorSyntheticRow = {
  $key: string;
  syntheticRowType: ETokenSelectorSyntheticRowType;
};

export type ITokenSelectorListRow = IAccountToken | ITokenSelectorSyntheticRow;

const SYNTHETIC_ROW_KEY_PREFIX = 'cross-network-search__';

function buildSyntheticRow(
  syntheticRowType: ETokenSelectorSyntheticRowType,
): ITokenSelectorSyntheticRow {
  return {
    $key: `${SYNTHETIC_ROW_KEY_PREFIX}${syntheticRowType}`,
    syntheticRowType,
  };
}

export function isTokenSelectorSyntheticRow(
  row: ITokenSelectorListRow,
): row is ITokenSelectorSyntheticRow {
  return 'syntheticRowType' in row;
}

// The token-search backend matches the keyword string as a whole, so a
// combined query like "usdt trx" returns nothing from any networkId. When one
// keyword names a network exactly (name/code/shortcode/shortname or a curated
// alias like "trc20"), strip it and scope the backend request to that network
// instead — the local AND filter still applies the full query afterwards.
// Conservative by design: only extracts when the network is unambiguous and at
// least one keyword remains.
export function extractCrossNetworkSearchQuery({
  keywords,
  networks,
}: {
  keywords: string;
  networks: IServerNetwork[];
}): { networkId?: string; keywords: string } {
  const words = tokenizeTokenSearchKeywords(keywords);
  if (words.length < 2) {
    return { keywords };
  }

  // Compare tokenizer-normalized phrases on both sides: preset fields may
  // themselves contain separators ("dot-bifrost"), which the tokenizer splits
  // in the query. Custom networks are excluded — their token lookup goes
  // through raw RPC contract calls, so scoping a symbol query to one would
  // turn an empty result into an error state.
  const aliasMap = getTokenNetworkAliasMap();
  const networkMatchers = networks
    .filter((network) => !network.isAllNetworks && !network.isCustomNetwork)
    .map((network) => ({
      network,
      phrases: new Set(
        [
          network.name,
          network.code,
          network.shortcode,
          network.shortname,
          ...(aliasMap[network.id] ?? []),
        ]
          .filter(Boolean)
          .map((value) => normalizePhrase(value)),
      ),
    }));

  // Network names are often several words ("Bitcoin Cash", "BNB Chain"), so
  // match every contiguous run of words rather than single words only.
  const spans: {
    start: number;
    end: number;
    phrase: string;
    networks: IServerNetwork[];
  }[] = [];
  for (let start = 0; start < words.length; start += 1) {
    const maxEnd = Math.min(words.length, start + MAX_NETWORK_NAME_WORDS);
    for (let end = start + 1; end <= maxEnd; end += 1) {
      const phrase = words.slice(start, end).join(' ');
      const matched = networkMatchers
        .filter((matcher) => matcher.phrases.has(phrase))
        .map((matcher) => matcher.network);
      if (matched.length > 0) {
        spans.push({ start, end, phrase, networks: matched });
      }
    }
  }

  // Longest match wins, so "bitcoin cash" beats the "bitcoin" inside it.
  let candidates = spans.filter(
    (span) =>
      !spans.some(
        (other) =>
          other !== span &&
          other.start <= span.start &&
          other.end >= span.end &&
          other.end - other.start > span.end - span.start,
      ),
  );

  if (candidates.length > 1) {
    // Several phrases look like networks. One that is also its own network's
    // gas-token symbol ("eth" -> Ethereum, symbol ETH) is really the TOKEN
    // term: in "eth base" the user wants the ETH token on Base. Drop those and
    // keep the phrase that can only be a network. If that leaves zero or
    // several (e.g. "eth sol", both token-like), the query is genuinely
    // ambiguous and is passed through untouched.
    candidates = candidates.filter(
      (span) =>
        !span.networks.some(
          (network) => network.symbol?.toLowerCase() === span.phrase,
        ),
    );
  }
  if (candidates.length !== 1) {
    return { keywords };
  }

  const [candidate] = candidates;
  const matchedNetworkIds = new Set(
    candidate.networks.map((network) => network.id),
  );
  const remainingWords = words.filter(
    (_, index) => index < candidate.start || index >= candidate.end,
  );
  if (matchedNetworkIds.size !== 1 || remainingWords.length === 0) {
    return { keywords };
  }

  return {
    networkId: Array.from(matchedNetworkIds)[0],
    keywords: remainingWords.join(' '),
  };
}

// Splits a filtered & sorted flat token list into a current-network section and
// an other-networks section, expressed as one flat array with synthetic rows
// (TokenListView renders a plain ListView, not a SectionList). Input order is
// preserved within each section — strength/fiat sorting already happened in
// getFilteredTokenBySearchKey.
export function buildCrossNetworkSearchListData({
  tokens,
  currentNetworkId,
  hasSearchError,
}: {
  tokens: IAccountToken[];
  currentNetworkId: string;
  hasSearchError?: boolean;
}): ITokenSelectorListRow[] {
  const currentNetworkTokens: IAccountToken[] = [];
  const otherNetworkTokens: IAccountToken[] = [];
  for (const token of tokens) {
    if (token.networkId === currentNetworkId) {
      currentNetworkTokens.push(token);
    } else {
      otherNetworkTokens.push(token);
    }
  }

  // Both sections empty: return [] so ListEmptyComponent owns the state
  // (skeleton while searching, error view on failure, not-found view otherwise).
  if (currentNetworkTokens.length === 0 && otherNetworkTokens.length === 0) {
    return [];
  }

  const rows: ITokenSelectorListRow[] = [];

  if (currentNetworkTokens.length > 0) {
    rows.push(
      buildSyntheticRow(ETokenSelectorSyntheticRowType.CurrentNetworkHeader),
      ...currentNetworkTokens,
    );
  } else {
    rows.push(
      buildSyntheticRow(ETokenSelectorSyntheticRowType.CurrentNetworkNoMatch),
    );
  }

  if (otherNetworkTokens.length > 0) {
    rows.push(
      buildSyntheticRow(ETokenSelectorSyntheticRowType.OtherNetworksHeader),
      ...otherNetworkTokens,
    );
  } else if (hasSearchError) {
    // Local results exist but the backend cross-network search failed: surface
    // an inline error row instead of silently pretending there are no
    // cross-network matches.
    rows.push(
      buildSyntheticRow(ETokenSelectorSyntheticRowType.OtherNetworksHeader),
      buildSyntheticRow(
        ETokenSelectorSyntheticRowType.OtherNetworksSearchError,
      ),
    );
  }

  return rows;
}
