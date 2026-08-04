import type { IDBAccount } from '@onekeyhq/kit-bg/src/dbs/local/types';

import accountUtils from './accountUtils';

import type { IServerNetwork } from '../../types';
import type { IAccountToken } from '../../types/token';

// Longest preset network name is 3 words ("Ethereum Sepolia Testnet"); 4 keeps
// headroom while bounding the span scan.
const MAX_NETWORK_NAME_WORDS = 4;

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
// keyword names a network exactly (name/code/shortcode/shortname), strip it
// and scope the backend request to that network instead — the local AND filter
// still applies the full query afterwards. Conservative by design: only
// extracts when the network is unambiguous and at least one keyword remains.
export function extractCrossNetworkSearchQuery({
  keywords,
  networks,
}: {
  keywords: string;
  networks: IServerNetwork[];
}): { networkId?: string; keywords: string } {
  const words = keywords.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length < 2) {
    return { keywords };
  }

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
      const matched = networks.filter(
        (network) =>
          !network.isAllNetworks &&
          (network.name?.toLowerCase() === phrase ||
            network.code?.toLowerCase() === phrase ||
            network.shortcode?.toLowerCase() === phrase ||
            network.shortname?.toLowerCase() === phrase),
      );
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

// Others (imported / watch-only / external) accounts are one credential on one
// impl: they can never produce an address on an incompatible network, and the
// cross-network press path would fall through to the HD/HW batch createAddress
// with no indexedAccountId. Drop those rows so they are never offered. An
// imported EVM key still keeps every EVM network, which is the point.
export function filterTokensByAccountNetworkCompatibility({
  tokens,
  account,
}: {
  tokens: IAccountToken[];
  account: IDBAccount;
}): IAccountToken[] {
  return tokens.filter(
    (token) =>
      !token.networkId ||
      accountUtils.isAccountCompatibleWithNetwork({
        account,
        networkId: token.networkId,
      }),
  );
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
