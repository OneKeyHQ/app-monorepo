/** @jest-environment jsdom */

import type { ReactNode, Ref } from 'react';

import { act, fireEvent, render, screen } from '@testing-library/react';

import { toAssetId } from '@onekeyhq/shared/src/utils/perpsDexUtils';
import type {
  IPerpsAssetCtx,
  IPerpsUniverse,
  ISpotUniverse,
} from '@onekeyhq/shared/types/hyperliquid';

import {
  PerpChartTokenSelector,
  getPerpChartTokenItems,
} from './PerpChartTokenSelector';

import type { IPerpChartTokenUniverse } from './PerpChartTokenSelector';

type IMockStackProps = {
  children?: ReactNode;
  ref?: Ref<HTMLDivElement>;
  testID?: string;
  role?: string;
  'aria-selected'?: boolean;
};
let mockPopover: { onOpenChange: (open: boolean) => void } | undefined;
const mockScrollTo = jest.fn();
const mockSelectToken = jest.fn();
// T0 to T59 on the main dex, T0 trading the most.
const mockPickerUniverse = {
  perpsByDex: [
    Array.from({ length: 60 }, (_, index) => ({
      name: `T${index}`,
      assetId: index,
    })),
  ],
  spot: [],
};
const mockPickerCtxs = [
  Array.from({ length: 60 }, (_, index) => ({ dayNtlVlm: String(60 - index) })),
];

jest.mock('@onekeyhq/components', () => {
  const { useImperativeHandle } =
    jest.requireActual<typeof import('react')>('react');
  const Stack = ({
    children,
    ref,
    testID,
    role,
    'aria-selected': selected,
  }: IMockStackProps) => (
    <div ref={ref} data-testid={testID} role={role} aria-selected={selected}>
      {children}
    </div>
  );
  return {
    Divider: () => null,
    Icon: () => null,
    Spinner: () => null,
    SizableText: ({ children }: { children?: ReactNode }) => children,
    XStack: Stack,
    YStack: Stack,
    ScrollView: ({
      children,
      ref,
    }: {
      children?: ReactNode;
      ref?: Ref<{ scrollTo: typeof mockScrollTo }>;
    }) => {
      useImperativeHandle(ref, () => ({ scrollTo: mockScrollTo }));
      return <div>{children}</div>;
    },
    SearchBar: ({
      value,
      onSearchTextChange,
      onKeyPress,
      onSubmitEditing,
    }: {
      value: string;
      onSearchTextChange: (text: string) => void;
      onKeyPress: (event: unknown) => void;
      onSubmitEditing: () => void;
    }) => (
      <input
        data-testid="search"
        value={value}
        onChange={(event) => onSearchTextChange(event.target.value)}
        onKeyDown={(event) =>
          event.key === 'Enter' ? onSubmitEditing() : onKeyPress(event)
        }
      />
    ),
    Popover: (props: {
      open: boolean;
      onOpenChange: (open: boolean) => void;
      renderTrigger: ReactNode;
      renderContent: ReactNode;
    }) => {
      mockPopover = props;
      return (
        <>
          {props.renderTrigger}
          {props.open ? props.renderContent : null}
        </>
      );
    },
  };
});
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {},
}));
jest.mock('@onekeyhq/kit/src/components/Token', () => ({ Token: () => null }));
jest.mock('@onekeyhq/kit/src/hooks/useListenTabFocusState', () => ({
  __esModule: true,
  default: () => undefined,
}));
jest.mock('@onekeyhq/kit/src/hooks/usePromiseResult', () => ({
  usePromiseResult: () => ({ result: mockPickerUniverse }),
}));
jest.mock('@onekeyhq/kit/src/states/jotai/contexts/hyperliquid/atoms', () => ({
  usePerpsAllAssetCtxsAtom: () => [{ assetCtxsByDex: mockPickerCtxs }],
}));
jest.mock('@onekeyhq/kit/src/views/Market/components/PerpsBadges', () => ({
  PerpDexBadge: () => null,
}));
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  usePerpTokenFavoritesPersistAtom: () => [{ favorites: [] }],
  useSpotTokenFavoritesPersistAtom: () => [{ favorites: [] }],
  usePerpsFavoritesOrderPersistAtom: () => [{ sequence: [] }],
}));
jest.mock('@react-navigation/native', () => ({ useIsFocused: () => true }));
jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
jest.mock('./PerpTokenSelectorRow', () => ({ TradingModeBadge: () => null }));

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

describe('picker', () => {
  // The panel is on T30, far down the default list.
  function openPicker() {
    render(
      <PerpChartTokenSelector
        coin="T30"
        display={{ label: 'T30USDC', tokenImageUris: [] }}
        onSelectToken={mockSelectToken}
        testID="picker"
      />,
    );
    act(() => mockPopover?.onOpenChange(true));
  }

  function activeRow() {
    return screen
      .getAllByRole('option')
      .findIndex((row) => row.getAttribute('aria-selected') === 'true');
  }

  function search(text: string) {
    fireEvent.change(screen.getByTestId('search'), {
      target: { value: text },
    });
  }

  beforeAll(() => {
    // jsdom has no scrolling; the keyboard path scrolls rows into view.
    Element.prototype.scrollIntoView = jest.fn();
  });

  beforeEach(() => {
    mockScrollTo.mockClear();
    mockSelectToken.mockClear();
  });

  it('shows the first result of a query, not the scroll it opened with', () => {
    openPicker();
    // Opens on the panel's token, mid-list.
    expect(activeRow()).toBe(30);
    expect(mockScrollTo).toHaveBeenLastCalledWith({ y: 832, animated: false });

    // A query keeping the same rows in the same order: the list must go back
    // to the top, or Enter picks a row out of view.
    search('usdc');
    expect(activeRow()).toBe(0);
    expect(mockScrollTo).toHaveBeenLastCalledWith({ y: 0, animated: false });

    fireEvent.keyDown(screen.getByTestId('search'), { key: 'Enter' });
    expect(mockSelectToken).toHaveBeenCalledWith({ mode: 'perp', coin: 'T0' });
  });

  it('starts every edit of the query from its first result', () => {
    openPicker();
    search('t1');
    for (let i = 0; i < 3; i += 1) {
      fireEvent.keyDown(screen.getByTestId('search'), { key: 'ArrowDown' });
    }
    expect(activeRow()).toBe(3);

    // Back to the earlier query: its old row must not come back.
    search('t');
    search('t1');
    expect(activeRow()).toBe(0);
  });
});
