import type {
  IEarnAssetClass,
  IEarnAssetPick,
  IEarnAssetSelectPurpose,
  IEarnAssetSelectToken,
} from '@onekeyhq/shared/types/earn/earnAssetSelect';

import { getLoanAssetType } from '../../components/desktopHome/earnDesktopHome.utils';

import type { IEarnDesktopLoanAssetType } from '../../components/desktopHome/earnDesktopHome.utils';

export type {
  IEarnAssetClass,
  IEarnAssetPick,
  IEarnAssetSelectNetwork,
  IEarnAssetSelectPurpose,
  IEarnAssetSelectToken,
} from '@onekeyhq/shared/types/earn/earnAssetSelect';

export type IEarnAssetSelectClassRow = {
  assetClass: IEarnAssetClass;
  tokens: IEarnAssetSelectToken[];
  // Earn's best rate across them, or the lowest loan rate
  rate?: number;
  // What the wallet holds of them, in the currency
  fiatValue?: number;
};

export type IEarnAssetSelectGroup = {
  key: IEarnDesktopLoanAssetType;
  // Two tokens or more of a kind are headed by a row that picks them all;
  // Others never is: "every other token" isn't something to compare
  classRow?: IEarnAssetSelectClassRow;
  tokens: IEarnAssetSelectToken[];
};

export const EARN_ASSET_CLASS_ORDER: IEarnDesktopLoanAssetType[] = [
  'stable',
  'eth',
  'btc',
  'sol',
  'other',
];

export const isEarnAssetClass = (
  type: IEarnDesktopLoanAssetType,
): type is IEarnAssetClass => type !== 'other';

export const getEarnAssetType = (symbol: string, stableSymbols: Set<string>) =>
  getLoanAssetType(symbol, stableSymbols);

const isSameSymbol = (a: string, b: string) =>
  a.toUpperCase() === b.toUpperCase();

export const isSameAssetPick = (a: IEarnAssetPick, b: IEarnAssetPick) =>
  a.kind === 'class'
    ? b.kind === 'class' && a.assetClass === b.assetClass
    : b.kind === 'token' && isSameSymbol(a.symbol, b.symbol);

/** A token the pick takes in: the token itself, or one of the kind */
export const isInAssetPick = ({
  symbol,
  pick,
  stableSymbols,
}: {
  symbol: string;
  pick: IEarnAssetPick;
  stableSymbols: Set<string>;
}) =>
  pick.kind === 'token'
    ? isSameSymbol(symbol, pick.symbol)
    : getEarnAssetType(symbol, stableSymbols) === pick.assetClass;

const held = (token: IEarnAssetSelectToken) => token.fiatValue ?? 0;

// Held first, the most valuable first; then Earn by its best rate, a loan by
// its lowest, and collateral by name
function compareTokens(purpose: IEarnAssetSelectPurpose) {
  return (a: IEarnAssetSelectToken, b: IEarnAssetSelectToken) => {
    if (purpose !== 'loanBorrow') {
      const byHeld = held(b) - held(a);
      if (byHeld !== 0) {
        return byHeld;
      }
    }
    if (purpose === 'earn') {
      const byRate = (b.rate ?? -1) - (a.rate ?? -1);
      if (byRate !== 0) {
        return byRate;
      }
    }
    if (purpose === 'loanBorrow') {
      const aRate = a.rate ?? Number.POSITIVE_INFINITY;
      const bRate = b.rate ?? Number.POSITIVE_INFINITY;
      if (aRate !== bRate) {
        return aRate < bRate ? -1 : 1;
      }
    }
    return a.symbol.localeCompare(b.symbol);
  };
}

export const sortAssetSelectTokens = (
  tokens: IEarnAssetSelectToken[],
  purpose: IEarnAssetSelectPurpose,
) => tokens.toSorted(compareTokens(purpose));

function buildClassRow({
  assetClass,
  tokens,
  purpose,
}: {
  assetClass: IEarnAssetClass;
  tokens: IEarnAssetSelectToken[];
  purpose: IEarnAssetSelectPurpose;
}): IEarnAssetSelectClassRow {
  const rates = tokens
    .map((token) => token.rate)
    .filter((rate): rate is number => rate !== undefined);
  let rate: number | undefined;
  if (rates.length && purpose === 'earn') {
    rate = Math.max(...rates);
  } else if (rates.length && purpose === 'loanBorrow') {
    rate = Math.min(...rates);
  }
  const fiatValue = tokens.reduce((sum, token) => sum + held(token), 0);
  return {
    assetClass,
    tokens,
    rate,
    fiatValue: fiatValue > 0 ? fiatValue : undefined,
  };
}

/** The kinds in a fixed order, each headed by its row where it has two tokens or more */
export function buildAssetSelectGroups({
  tokens,
  purpose,
}: {
  tokens: IEarnAssetSelectToken[];
  purpose: IEarnAssetSelectPurpose;
}): IEarnAssetSelectGroup[] {
  return EARN_ASSET_CLASS_ORDER.flatMap((type) => {
    const members = sortAssetSelectTokens(
      tokens.filter((token) => token.type === type),
      purpose,
    );
    if (!members.length) {
      return [];
    }
    return [
      {
        key: type,
        classRow:
          isEarnAssetClass(type) && members.length > 1
            ? buildClassRow({ assetClass: type, tokens: members, purpose })
            : undefined,
        tokens: members,
      },
    ];
  });
}

/** The kinds that have a row of their own: two tokens or more */
export const listPickableClasses = (groups: IEarnAssetSelectGroup[]) =>
  groups.flatMap((group) =>
    group.classRow ? [group.classRow.assetClass] : [],
  );

// ---------- Search ----------

// What a kind is searched by, besides its name
const CLASS_KEYWORDS: Record<IEarnAssetClass, string[]> = {
  stable: ['stable tokens', 'stablecoins', 'stables', 'usd'],
  eth: ['eth', 'ether', 'ethereum'],
  btc: ['btc', 'bitcoin'],
  sol: ['sol', 'solana'],
};

const EVM_ADDRESS = /^0x[0-9a-f]{40}$/i;
const BASE58_ADDRESS = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export const isAddressKeyword = (keyword: string) => {
  const value = keyword.trim();
  return EVM_ADDRESS.test(value) || BASE58_ADDRESS.test(value);
};

export type IEarnAssetSearchToken = {
  token: IEarnAssetSelectToken;
  // The contract the pasted address matched, shown under the name
  matchedAddress?: string;
};

export type IEarnAssetSearchResult = {
  classRows: IEarnAssetSelectClassRow[];
  tokens: IEarnAssetSearchToken[];
};

/**
 * A search by name, symbol or a pasted contract address. A kind comes first
 * when the words name it ("stable", "btc"); tokens follow, the closest match
 * first: the symbol itself, then a symbol it starts, then one it is in, then
 * the name
 */
export function searchAssetSelect({
  groups,
  keyword,
  purpose,
}: {
  groups: IEarnAssetSelectGroup[];
  keyword: string;
  purpose: IEarnAssetSelectPurpose;
}): IEarnAssetSearchResult {
  const query = keyword.trim().toLowerCase();
  const tokens = groups.flatMap((group) => group.tokens);
  if (!query) {
    return { classRows: [], tokens: [] };
  }
  if (isAddressKeyword(keyword)) {
    return {
      classRows: [],
      tokens: tokens.flatMap((token) => {
        const matched = token.addresses.find(
          (item) => item.address.toLowerCase() === query,
        );
        return matched ? [{ token, matchedAddress: matched.address }] : [];
      }),
    };
  }
  const classRows = groups.flatMap((group) => {
    const row = group.classRow;
    if (!row) {
      return [];
    }
    const words = CLASS_KEYWORDS[row.assetClass];
    return words.some((word) => word.startsWith(query)) ? [row] : [];
  });
  const rank = (token: IEarnAssetSelectToken) => {
    const symbol = token.symbol.toLowerCase();
    if (symbol === query) {
      return 0;
    }
    if (symbol.startsWith(query)) {
      return 1;
    }
    if (symbol.includes(query)) {
      return 2;
    }
    if (token.name.toLowerCase().includes(query)) {
      return 3;
    }
    return -1;
  };
  const compare = compareTokens(purpose);
  const matches = tokens
    .map((token) => ({ token, rank: rank(token) }))
    .filter((item) => item.rank >= 0)
    .toSorted((a, b) => a.rank - b.rank || compare(a.token, b.token))
    .map(({ token }) => ({ token }));
  return { classRows, tokens: matches };
}

// ---------- Words ----------

/** The kind's tokens by symbol, the first three and how many more */
export const splitClassMembers = (tokens: IEarnAssetSelectToken[]) => ({
  shown: tokens.slice(0, 3).map((token) => token.symbol),
  rest: Math.max(0, tokens.length - 3),
});
