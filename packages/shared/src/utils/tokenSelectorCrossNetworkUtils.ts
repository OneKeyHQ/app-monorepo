import type { IServerNetwork } from '../../types';
import type { IAccountToken } from '../../types/token';

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
// extracts when exactly one keyword matches exactly one network and at least
// one keyword remains.
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

  const matchedNetworkIds = new Set<string>();
  const networkWords = new Set<string>();
  for (const word of words) {
    for (const network of networks) {
      if (network.isAllNetworks) {
        // eslint-disable-next-line no-continue
        continue;
      }
      if (
        network.name?.toLowerCase() === word ||
        network.code?.toLowerCase() === word ||
        network.shortcode?.toLowerCase() === word ||
        network.shortname?.toLowerCase() === word
      ) {
        matchedNetworkIds.add(network.id);
        networkWords.add(word);
      }
    }
  }

  const remainingWords = words.filter((word) => !networkWords.has(word));
  if (
    matchedNetworkIds.size !== 1 ||
    networkWords.size !== 1 ||
    remainingWords.length === 0
  ) {
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
