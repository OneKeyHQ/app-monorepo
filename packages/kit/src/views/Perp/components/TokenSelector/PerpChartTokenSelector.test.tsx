import { toAssetId } from '@onekeyhq/shared/src/utils/perpsDexUtils';
import type {
  IPerpsAssetCtx,
  IPerpsUniverse,
  ISpotUniverse,
} from '@onekeyhq/shared/types/hyperliquid';

import { getPerpChartTokenItems } from './PerpChartTokenSelector';

import type { IPerpChartTokenUniverse } from './PerpChartTokenSelector';

// The picker's view code is not under test here.
jest.mock('@onekeyhq/components', () => ({}));
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {},
}));
jest.mock('@onekeyhq/kit/src/components/Token', () => ({}));
jest.mock('@onekeyhq/kit/src/hooks/useListenTabFocusState', () => ({
  __esModule: true,
  default: () => undefined,
}));
jest.mock('@onekeyhq/kit/src/hooks/usePromiseResult', () => ({}));
jest.mock(
  '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid/atoms',
  () => ({}),
);
jest.mock('@onekeyhq/kit/src/views/Market/components/PerpsBadges', () => ({}));
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({}));
jest.mock('@react-navigation/native', () => ({}));
jest.mock('./PerpTokenSelectorRow', () => ({}));

function perp(name: string, assetId: number, isDelisted?: boolean) {
  return { name, assetId, isDelisted } as IPerpsUniverse;
}

function spot(name: string, baseName: string) {
  return { name, baseName, quoteName: 'USDC' } as ISpotUniverse;
}

function volumes(...values: number[]) {
  return values.map((dayNtlVlm) => ({
    dayNtlVlm: String(dayNtlVlm),
  })) as IPerpsAssetCtx[];
}

const universe: IPerpChartTokenUniverse = {
  perpsByDex: [
    [
      perp('BTC', 0),
      perp('ETH', 1),
      perp('SOL', 2),
      perp('OLD', 3, true),
      perp('SOPH', 4),
      perp('THE', 5),
    ],
    [
      perp('xyz:SOXL', toAssetId({ dexIndex: 1, index: 0 })),
      perp('xyz:NVDA', toAssetId({ dexIndex: 1, index: 1 })),
    ],
  ],
  spot: [spot('@1', 'SOLV'), spot('PURR/USDC', 'PURR')],
  aliases: { BTC: { aliases: ['bitcoin'] } },
};

// The delisted OLD trades the most, so it would lead if it were listed.
const assetCtxsByDex = [volumes(100, 80, 10, 1000, 1, 2), volumes(50, 60)];

function labels({
  query = '',
  perpFavorites = [],
  spotFavorites = [],
  ctxs = assetCtxsByDex,
  favoritesOrder = [],
}: {
  query?: string;
  perpFavorites?: string[];
  spotFavorites?: string[];
  ctxs?: IPerpsAssetCtx[][];
  favoritesOrder?: { mode: 'perp' | 'spot'; coinName: string }[];
}) {
  return getPerpChartTokenItems({
    universe,
    assetCtxsByDex: ctxs,
    query,
    perpFavorites,
    spotFavorites,
    favoritesOrder,
  }).map((item) => item.label);
}

it('lists the favorites in the favorites bar order, then the perps by 24h volume', () => {
  expect(
    labels({
      // GONE is no longer listed, and a favorite is not listed twice.
      perpFavorites: ['SOL', 'GONE'],
      spotFavorites: ['PURR/USDC'],
      favoritesOrder: [
        { mode: 'spot', coinName: 'PURR/USDC' },
        { mode: 'perp', coinName: 'SOL' },
      ],
    }),
  ).toEqual([
    'PURR/USDC',
    'SOLUSDC',
    'BTCUSDC',
    'ETHUSDC',
    'NVDAUSDC',
    'SOXLUSDC',
    'THEUSDC',
    'SOPHUSDC',
  ]);
});

it('keeps the listing order while no volumes have arrived', () => {
  expect(labels({ ctxs: [] })).toEqual([
    'BTCUSDC',
    'ETHUSDC',
    'SOLUSDC',
    'SOPHUSDC',
    'THEUSDC',
    'SOXLUSDC',
    'NVDAUSDC',
  ]);
});

it('carries what a pick and its row need', () => {
  const [nvda] = getPerpChartTokenItems({
    universe,
    assetCtxsByDex,
    query: 'nvda',
    perpFavorites: [],
    spotFavorites: [],
    favoritesOrder: [],
  });
  expect(nvda).toMatchObject({
    mode: 'perp',
    coin: 'xyz:NVDA',
    label: 'NVDAUSDC',
    dexLabel: 'xyz',
  });
  const [pair] = getPerpChartTokenItems({
    universe,
    assetCtxsByDex,
    query: 'SOLV',
    perpFavorites: [],
    spotFavorites: [],
    favoritesOrder: [],
  });
  expect(pair).toMatchObject({ mode: 'spot', coin: '@1', label: 'SOLV/USDC' });
});

it.each([
  // Prefix matches first; perps by volume, then spot pairs.
  ['so', ['SOXLUSDC', 'SOLUSDC', 'SOPHUSDC', 'SOLV/USDC']],
  ['th', ['THEUSDC', 'ETHUSDC']],
  // The pair as the header shows it.
  [' ETHUSDC ', ['ETHUSDC']],
  // A server alias.
  ['bitcoin', ['BTCUSDC']],
  // A sub-DEX by its prefix.
  ['xyz', ['NVDAUSDC', 'SOXLUSDC']],
  // Neither favorites nor delisted perps join a search on their own.
  ['old', []],
])('matches %j', (query, expected) => {
  expect(labels({ query, perpFavorites: ['SOL'] })).toEqual(expected);
});

it('stops at 50 rows', () => {
  const many: IPerpChartTokenUniverse = {
    ...universe,
    perpsByDex: [
      Array.from({ length: 80 }, (_, index) => perp(`T${index}`, index)),
    ],
  };
  const items = getPerpChartTokenItems({
    universe: many,
    assetCtxsByDex: [],
    query: 't',
    perpFavorites: [],
    spotFavorites: [],
    favoritesOrder: [],
  });
  expect(items).toHaveLength(50);
  expect(items[0].label).toBe('T0USDC');
});
