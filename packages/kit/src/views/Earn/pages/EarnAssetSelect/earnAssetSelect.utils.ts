import type {
  IEarnAssetClass,
  IEarnAssetPick,
  IEarnAssetSelectNetwork,
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
  IEarnAssetSelectTokenNetwork,
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

/** The same token or kind, whatever the networks */
export const isSameAssetPickAsset = (a: IEarnAssetPick, b: IEarnAssetPick) =>
  a.kind === 'class'
    ? b.kind === 'class' && a.assetClass === b.assetClass
    : b.kind === 'token' && isSameSymbol(a.symbol, b.symbol);

/** The same token or kind on the same network, or both on every network */
export const isSameAssetPick = (a: IEarnAssetPick, b: IEarnAssetPick) =>
  isSameAssetPickAsset(a, b) && (a.networkId ?? '') === (b.networkId ?? '');

/** Whether a network is in the pick: its own, or any where it has none */
export const isNetworkInPick = (pick: IEarnAssetPick, networkId: string) =>
  !pick.networkId || pick.networkId === networkId;

/**
 * The token as the pick's networks see it: its figures on that network, or
 * as they stand across every network. Undefined where it isn't offered there
 */
export function scopeAssetSelectToken(
  token: IEarnAssetSelectToken,
  networkId?: string,
): IEarnAssetSelectToken | undefined {
  if (!networkId) {
    return token;
  }
  const network = token.networks.find((item) => item.id === networkId);
  if (!network) {
    return undefined;
  }
  return {
    ...token,
    networks: [network],
    addresses: token.addresses.filter((item) => item.networkId === networkId),
    rate: network.rate,
    balance: network.balance,
    fiatValue: network.fiatValue,
  };
}

/** Every token offered on the network (all of them, without one), with its figures there */
export const scopeAssetSelectTokens = (
  tokens: IEarnAssetSelectToken[],
  networkId?: string,
) =>
  networkId
    ? tokens.flatMap((token) => {
        const scoped = scopeAssetSelectToken(token, networkId);
        return scoped ? [scoped] : [];
      })
    : tokens;

/**
 * The networks the tokens are on, those where the wallet holds any of them
 * first (the most valuable first), then by name: the network column's order
 */
export function listAssetSelectNetworks(
  tokens: IEarnAssetSelectToken[],
): IEarnAssetSelectNetwork[] {
  const byId = new Map<string, IEarnAssetSelectNetwork & { held: number }>();
  tokens.forEach((token) => {
    token.networks.forEach((network) => {
      const kept = byId.get(network.id);
      byId.set(network.id, {
        id: network.id,
        name: network.name,
        logoURI: network.logoURI,
        held: (kept?.held ?? 0) + (network.fiatValue ?? 0),
      });
    });
  });
  return [...byId.values()]
    .toSorted((a, b) => b.held - a.held || a.name.localeCompare(b.name))
    .map(({ held: _held, ...network }) => network);
}

/**
 * A token the pick takes in: the token itself, or one of the kind. Given the
 * token's network, also only on the pick's network where it has one
 */
export const isInAssetPick = ({
  symbol,
  networkId,
  pick,
  stableSymbols,
}: {
  symbol: string;
  networkId?: string;
  pick: IEarnAssetPick;
  stableSymbols: Set<string>;
}) =>
  (networkId === undefined || isNetworkInPick(pick, networkId)) &&
  (pick.kind === 'token'
    ? isSameSymbol(symbol, pick.symbol)
    : getEarnAssetType(symbol, stableSymbols) === pick.assetClass);

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

/**
 * The kind's tokens by symbol, the first three (or as many as the line has
 * room for) and how many more
 */
export const splitClassMembers = (
  tokens: IEarnAssetSelectToken[],
  count = 3,
) => ({
  shown: tokens.slice(0, count).map((token) => token.symbol),
  rest: Math.max(0, tokens.length - count),
});

// ---------- Networks and tabs (11-05) ----------

/** The selector's tabs: every token, or one kind of token */
export type IEarnAssetSelectCategory = 'all' | IEarnDesktopLoanAssetType;

export type IEarnAssetSelectRow =
  | { type: 'class'; row: IEarnAssetSelectClassRow }
  | {
      type: 'token';
      token: IEarnAssetSelectToken;
      // The contract a pasted address matched
      matchedAddress?: string;
    };

export type IEarnAssetSelectView = {
  // All, then each kind that has tokens in view, in the kinds' order
  categories: IEarnAssetSelectCategory[];
  // The tab shown: the one asked for, or All where it has nothing in view
  category: IEarnAssetSelectCategory;
  rows: IEarnAssetSelectRow[];
};

const isInCategory = (
  category: IEarnAssetSelectCategory,
  type: IEarnDesktopLoanAssetType,
) => category === 'all' || category === type;

/**
 * What the list shows on the network chosen (every network without one).
 * All lists each token once, held first, with no kind rows. A kind's tab
 * starts with the row that picks the whole kind (two tokens or more; Others
 * never has one), then its tokens. A search looks through every kind there:
 * the tabs become the kinds it found, the tab asked for narrows the matches
 * while it has any, and a kind its words name ("stable", "btc") comes first
 */
export function buildAssetSelectView({
  tokens,
  purpose,
  networkId,
  category,
  keyword,
}: {
  tokens: IEarnAssetSelectToken[];
  purpose: IEarnAssetSelectPurpose;
  networkId?: string;
  category: IEarnAssetSelectCategory;
  keyword: string;
}): IEarnAssetSelectView {
  const scoped = scopeAssetSelectTokens(tokens, networkId);
  const groups = buildAssetSelectGroups({ tokens: scoped, purpose });
  const tabsOf = (kinds: Set<IEarnDesktopLoanAssetType>) => {
    const categories: IEarnAssetSelectCategory[] = [
      'all',
      ...EARN_ASSET_CLASS_ORDER.filter((type) => kinds.has(type)),
    ];
    return {
      categories,
      category: categories.includes(category) ? category : 'all',
    };
  };
  if (!keyword.trim()) {
    const tabs = tabsOf(new Set(groups.map((group) => group.key)));
    const group =
      tabs.category === 'all'
        ? undefined
        : groups.find((item) => item.key === tabs.category);
    if (!group) {
      return {
        ...tabs,
        rows: sortAssetSelectTokens(scoped, purpose).map((token) => ({
          type: 'token' as const,
          token,
        })),
      };
    }
    return {
      ...tabs,
      rows: [
        ...(group.classRow
          ? [{ type: 'class' as const, row: group.classRow }]
          : []),
        ...group.tokens.map((token) => ({ type: 'token' as const, token })),
      ],
    };
  }
  const search = searchAssetSelect({ groups, keyword, purpose });
  const tabs = tabsOf(
    new Set<IEarnDesktopLoanAssetType>([
      ...search.classRows.map((row) => row.assetClass),
      ...search.tokens.map((item) => item.token.type),
    ]),
  );
  return {
    ...tabs,
    rows: [
      ...search.classRows
        .filter((row) => isInCategory(tabs.category, row.assetClass))
        .map((row) => ({ type: 'class' as const, row })),
      ...search.tokens
        .filter((item) => isInCategory(tabs.category, item.token.type))
        .map((item) => ({ type: 'token' as const, ...item })),
    ],
  };
}

/**
 * The networks where the wallet holds any of the tokens, with what it holds
 * there in USD, the most first: the network column's networks with assets
 */
export function listAssetSelectHeldNetworks({
  tokens,
  networks,
}: {
  tokens: IEarnAssetSelectToken[];
  networks: IEarnAssetSelectNetwork[];
}): { network: IEarnAssetSelectNetwork; fiatValue: number }[] {
  const heldById = new Map<string, number>();
  tokens.forEach((token) => {
    token.networks.forEach((network) => {
      if (network.fiatValue && network.fiatValue > 0) {
        heldById.set(
          network.id,
          (heldById.get(network.id) ?? 0) + network.fiatValue,
        );
      }
    });
  });
  return networks
    .flatMap((network) => {
      const fiatValue = heldById.get(network.id);
      return fiatValue ? [{ network, fiatValue }] : [];
    })
    .toSorted(
      (a, b) =>
        b.fiatValue - a.fiatValue ||
        a.network.name.localeCompare(b.network.name),
    );
}

/**
 * Where the selector opens: the pick's network where the column lists it
 * (else every network), on a kind's own tab for a kind and on All for a token
 */
export function getAssetSelectOpening({
  selected,
  networks,
}: {
  selected?: IEarnAssetPick;
  networks: IEarnAssetSelectNetwork[];
}): { networkId?: string; category: IEarnAssetSelectCategory } {
  const networkId = networks.some((item) => item.id === selected?.networkId)
    ? selected?.networkId
    : undefined;
  return {
    networkId,
    category: selected?.kind === 'class' ? selected.assetClass : 'all',
  };
}

/** The phone's row of networks: one picked from the full list moves up front */
export const orderAssetSelectPhoneNetworks = (
  networks: IEarnAssetSelectNetwork[],
  leadNetworkId?: string,
) => {
  const lead = networks.find((item) => item.id === leadNetworkId);
  return lead
    ? [lead, ...networks.filter((item) => item.id !== leadNetworkId)]
    : networks;
};
