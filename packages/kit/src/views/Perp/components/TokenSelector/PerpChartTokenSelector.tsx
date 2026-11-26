import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { useIsFocused } from '@react-navigation/native';
import { useIntl } from 'react-intl';

import {
  Divider,
  Icon,
  Popover,
  ScrollView,
  SearchBar,
  SizableText,
  Spinner,
  XStack,
  YStack,
} from '@onekeyhq/components';
import type {
  IElement,
  IInputProps,
  IScrollViewRef,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { Token } from '@onekeyhq/kit/src/components/Token';
import useListenTabFocusState from '@onekeyhq/kit/src/hooks/useListenTabFocusState';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { usePerpsAllAssetCtxsAtom } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid/atoms';
import { PerpDexBadge } from '@onekeyhq/kit/src/views/Market/components/PerpsBadges';
import {
  usePerpTokenFavoritesPersistAtom,
  usePerpsFavoritesOrderPersistAtom,
  useSpotTokenFavoritesPersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { ETabRoutes } from '@onekeyhq/shared/src/routes';
import {
  getKeyboardEventKey,
  isImeComposingKeyboardEvent,
} from '@onekeyhq/shared/src/utils/imeUtils';
import { toCtxIndex } from '@onekeyhq/shared/src/utils/perpsDexUtils';
import { sortTokenSelectorFavoritesBySequence } from '@onekeyhq/shared/src/utils/perpsTokenSelectorFavorites';
import type { ITokenSelectorFavoriteOrderEntry } from '@onekeyhq/shared/src/utils/perpsTokenSelectorFavorites';
import {
  findTokensByAlias,
  formatSpotPairDisplayName,
  getHyperliquidTokenImageUris,
  getHyperliquidTokenImageUrl,
  isSpotInstrument,
  parseDexCoin,
} from '@onekeyhq/shared/src/utils/perpsUtils';
import type { ITokenSearchAliases } from '@onekeyhq/shared/src/utils/perpsUtils';
import type {
  IPerpsAssetCtx,
  IPerpsUniverse,
  ISpotUniverse,
} from '@onekeyhq/shared/types/hyperliquid';

import { filterPerpTokenSelectorSpotItemsBySearch } from '../../utils/tokenSelectorTabs';

import { TradingModeBadge } from './PerpTokenSelectorRow';

import type { IPerpTokenSelection } from './PerpTokenSelector';
import type { IPerpsChartInstrumentDisplay } from '../../hooks/usePerpsChartInstrument';

// The trigger's height. The search field, 2px taller with its border, opens
// over it, with its top this far below the trigger's.
const TRIGGER_HEIGHT = 28;
const SEARCH_FIELD_HEIGHT = TRIGGER_HEIGHT + 2;
const SEARCH_FIELD_TOP = 4;
// Next to the list: the search field and the divider.
const SEARCH_ROW_HEIGHT = SEARCH_FIELD_HEIGHT + 1;
// Wide enough for a sub-DEX pair with its dex and mode badges.
const PANEL_WIDTH = 240;
const ROW_HEIGHT = 32;
const LIST_PADDING = 4;
const MAX_LIST_HEIGHT = ROW_HEIGHT * 9 + LIST_PADDING * 2;
const MIN_LIST_HEIGHT = ROW_HEIGHT * 3 + LIST_PADDING * 2;
// The popover's gap to the window's bottom edge.
const VIEWPORT_PADDING = 8;
// A query narrows the list quickly; past this it would only be scrolled.
const MAX_ITEMS = 50;

export type IPerpChartTokenItem = IPerpTokenSelection & {
  label: string;
  dexLabel?: string;
  tokenImageUris: string[];
};

export interface IPerpChartTokenUniverse {
  perpsByDex: IPerpsUniverse[][];
  spot: ISpotUniverse[];
  aliases?: ITokenSearchAliases;
}

// Labels as the panel's own header shows them.
function toPerpItem(coin: string): IPerpChartTokenItem {
  const { displayName, dexLabel } = parseDexCoin(coin);
  return {
    mode: 'perp',
    coin,
    label: `${displayName}USDC`,
    dexLabel,
    tokenImageUris: getHyperliquidTokenImageUris(coin),
  };
}

function toSpotItem(universe: ISpotUniverse): IPerpChartTokenItem {
  return {
    mode: 'spot',
    coin: universe.name,
    label: formatSpotPairDisplayName(universe.baseName, universe.quoteName),
    tokenImageUris: [getHyperliquidTokenImageUrl(universe.baseName)],
  };
}

/**
 * Without a query: the favorites in the favorites bar's order, then the perps
 * by 24h volume, as the token selector lists them. With one: the perps and
 * spot pairs it matches, those whose label starts with it first.
 */
export function getPerpChartTokenItems({
  universe,
  assetCtxsByDex,
  query,
  perpFavorites,
  spotFavorites,
  favoritesOrder,
}: {
  universe: IPerpChartTokenUniverse;
  /** The volumes to rank the perps by. */
  assetCtxsByDex: IPerpsAssetCtx[][];
  query: string;
  perpFavorites: string[];
  spotFavorites: string[];
  favoritesOrder: ITokenSelectorFavoriteOrderEntry[];
}): IPerpChartTokenItem[] {
  const perps = universe.perpsByDex
    .flatMap((assets, dexIndex) =>
      assets
        .filter((asset) => !asset.isDelisted)
        .map((asset) => ({
          item: toPerpItem(asset.name),
          volume:
            Number(
              assetCtxsByDex[dexIndex]?.[toCtxIndex(asset.assetId, dexIndex)]
                ?.dayNtlVlm,
            ) || 0,
        })),
    )
    .toSorted((a, b) => b.volume - a.volume)
    .map(({ item }) => item);
  const search = query.trim().toLowerCase();
  if (search) {
    const aliasMatches = new Set(findTokensByAlias(search, universe.aliases));
    const spot = filterPerpTokenSelectorSpotItemsBySearch({
      items: universe.spot.map((spotUniverse) => ({ spotUniverse })),
      searchQuery: search,
      tokenSearchAliases: universe.aliases,
    }).map(({ spotUniverse }) => toSpotItem(spotUniverse));
    const rank = (item: IPerpChartTokenItem) =>
      item.label.toLowerCase().startsWith(search) ? 0 : 1;
    return [
      ...perps.filter(
        (item) =>
          item.coin.toLowerCase().includes(search) ||
          item.label.toLowerCase().includes(search) ||
          aliasMatches.has(item.coin),
      ),
      ...spot,
    ]
      .toSorted((a, b) => rank(a) - rank(b))
      .slice(0, MAX_ITEMS);
  }
  const perpByCoin = new Map(perps.map((item) => [item.coin, item]));
  const spotByCoin = new Map(universe.spot.map((pair) => [pair.name, pair]));
  const toEntries = (mode: IPerpChartTokenItem['mode'], coins: string[]) =>
    coins.map((coinName) => ({ mode, coinName }));
  const favorites = sortTokenSelectorFavoritesBySequence(
    [...toEntries('perp', perpFavorites), ...toEntries('spot', spotFavorites)],
    favoritesOrder,
  ).flatMap(({ mode, coinName }) => {
    const pair = spotByCoin.get(coinName);
    const item =
      mode === 'perp' ? perpByCoin.get(coinName) : pair && toSpotItem(pair);
    return item ? [item] : [];
  });
  const favoritePerps = new Set(perpFavorites);
  return [
    ...favorites,
    ...perps.filter((item) => !favoritePerps.has(item.coin)),
  ].slice(0, MAX_ITEMS);
}

// Already cached by the Perps page, so this resolves at once.
async function loadPerpChartTokenUniverse(): Promise<IPerpChartTokenUniverse> {
  const { serviceHyperliquid } = backgroundApiProxy;
  const [{ universesByDex }, { universes }, aliases] = await Promise.all([
    serviceHyperliquid.getTradingUniverse(),
    serviceHyperliquid.getSpotMeta(),
    serviceHyperliquid.getTokenSearchAliases(),
  ]);
  return { perpsByDex: universesByDex, spot: universes, aliases };
}

const PerpChartTokenRow = memo(
  ({
    index,
    isActive,
    item,
    onActivate,
    onSelect,
    registerRow,
    testID,
  }: {
    index: number;
    isActive: boolean;
    item: IPerpChartTokenItem;
    onActivate: (index: number) => void;
    onSelect: (item: IPerpChartTokenItem) => void;
    registerRow: (index: number, node: unknown) => void;
    testID?: string;
  }) => {
    const setRef = useCallback(
      (node: unknown) => registerRow(index, node),
      [index, registerRow],
    );
    const handleHoverIn = useCallback(
      () => onActivate(index),
      [index, onActivate],
    );
    const handlePress = useCallback(() => onSelect(item), [item, onSelect]);
    return (
      <XStack
        ref={setRef}
        testID={testID}
        role="option"
        aria-selected={isActive}
        h={ROW_HEIGHT}
        px="$3"
        gap="$1.5"
        alignItems="center"
        cursor="default"
        userSelect="none"
        bg={isActive ? '$bgHover' : undefined}
        onHoverIn={handleHoverIn}
        onPress={handlePress}
      >
        <Token
          size="xs"
          borderRadius="$full"
          tokenImageUris={item.tokenImageUris}
          fallbackIcon="CryptoCoinOutline"
        />
        <SizableText size="$bodyMdMedium" numberOfLines={1} flexShrink={1}>
          {item.label}
        </SizableText>
        <PerpDexBadge dexLabel={item.dexLabel} interactive={false} />
        <TradingModeBadge
          isSpot={item.mode === 'spot'}
          px="$1.5"
          bg="$bgStrong"
        />
      </XStack>
    );
  },
);
PerpChartTokenRow.displayName = 'PerpChartTokenRow';

// The search field over the trigger and the list under it, or above it when
// the popover opens upwards.
function PerpChartTokenSearch({
  coin,
  display,
  listMaxHeight,
  openUp,
  onSelect,
  testID,
}: {
  coin: string;
  display: IPerpsChartInstrumentDisplay;
  listMaxHeight: number;
  openUp: boolean;
  onSelect: (item: IPerpChartTokenItem) => void;
  testID?: string;
}) {
  const intl = useIntl();
  const [query, setQuery] = useState('');
  const { result: universe } = usePromiseResult(
    loadPerpChartTokenUniverse,
    [],
    { checkIsFocused: false },
  );
  const [perpFavorites] = usePerpTokenFavoritesPersistAtom();
  const [spotFavorites] = useSpotTokenFavoritesPersistAtom();
  const [favoritesOrder] = usePerpsFavoritesOrderPersistAtom();
  const [{ assetCtxsByDex }] = usePerpsAllAssetCtxsAtom();
  // The volumes the list opened with, so its rows hold still as they tick.
  const [rankingCtxs] = useState(assetCtxsByDex);
  const items = useMemo(
    () =>
      universe
        ? getPerpChartTokenItems({
            universe,
            assetCtxsByDex: rankingCtxs,
            query,
            perpFavorites: perpFavorites.favorites,
            spotFavorites: spotFavorites.favorites,
            favoritesOrder: favoritesOrder.sequence,
          })
        : undefined,
    [
      favoritesOrder.sequence,
      perpFavorites.favorites,
      query,
      rankingCtxs,
      spotFavorites.favorites,
      universe,
    ],
  );
  // The row the keyboard and the pointer act on: the panel's own token until
  // a query or a move picks another.
  const [cursor, setCursor] = useState<{ query: string; index: number }>();
  let activeIndex = query
    ? 0
    : (items?.findIndex((item) => item.coin === coin) ?? -1);
  if (cursor?.query === query) activeIndex = cursor.index;
  const activate = useCallback(
    (index: number) => setCursor({ query, index }),
    [query],
  );
  // The panel's own token mid-list when the list first shows, before it
  // paints, so a token further down is in view without a scroll after.
  const scrollRef = useRef<IScrollViewRef>(null);
  const didScroll = useRef(false);
  useLayoutEffect(() => {
    if (didScroll.current || !items?.length) return;
    didScroll.current = true;
    if (query || activeIndex < 1) return;
    const viewport = listMaxHeight - LIST_PADDING * 2;
    scrollRef.current?.scrollTo({
      y: Math.max(0, (activeIndex + 0.5) * ROW_HEIGHT - viewport / 2),
      animated: false,
    });
  }, [activeIndex, items, listMaxHeight, query]);
  const rows = useRef(new Map<number, HTMLElement>());
  const registerRow = useCallback((index: number, node: unknown) => {
    if (typeof HTMLElement !== 'undefined' && node instanceof HTMLElement) {
      rows.current.set(index, node);
    } else {
      rows.current.delete(index);
    }
  }, []);
  const handleKeyPress = useCallback<NonNullable<IInputProps['onKeyPress']>>(
    (event) => {
      const key = getKeyboardEventKey(event);
      if (
        (key !== 'ArrowDown' && key !== 'ArrowUp') ||
        isImeComposingKeyboardEvent(event) ||
        !items?.length
      ) {
        return;
      }
      event.preventDefault();
      const step = key === 'ArrowDown' ? 1 : -1;
      let index = activeIndex + step;
      if (activeIndex < 0) index = step > 0 ? 0 : items.length - 1;
      index = Math.min(items.length - 1, Math.max(0, index));
      setCursor({ query, index });
      rows.current.get(index)?.scrollIntoView({ block: 'nearest' });
    },
    [activeIndex, items, query],
  );
  const handleSubmit = useCallback(() => {
    const item = items?.[activeIndex];
    if (item) onSelect(item);
  }, [activeIndex, items, onSelect]);
  const modeBadge = useMemo(
    () => [
      {
        renderContent: (
          <XStack h="100%" pr="$2" alignItems="center">
            <TradingModeBadge
              isSpot={isSpotInstrument(coin)}
              px="$1.5"
              bg="$bgStrong"
            />
          </XStack>
        ),
      },
    ],
    [coin],
  );
  // The default list keeps its height while it loads; results fit the query.
  const listHeight =
    query && items
      ? Math.min(
          listMaxHeight,
          Math.max(1, items.length) * ROW_HEIGHT + LIST_PADDING * 2,
        )
      : listMaxHeight;
  let list = (
    <YStack flex={1} alignItems="center" justifyContent="center">
      <Spinner size="small" />
    </YStack>
  );
  if (items?.length === 0) {
    list = (
      <XStack h={ROW_HEIGHT} px="$3" alignItems="center">
        <SizableText size="$bodySm" color="$textSubdued">
          {intl.formatMessage({ id: ETranslations.perp_token_selector_empty })}
        </SizableText>
      </XStack>
    );
  } else if (items) {
    list = (
      <ScrollView ref={scrollRef} flex={1}>
        {items.map((item, index) => (
          <PerpChartTokenRow
            key={`${item.mode}:${item.coin}`}
            index={index}
            isActive={index === activeIndex}
            item={item}
            onActivate={activate}
            onSelect={onSelect}
            registerRow={registerRow}
            testID={testID ? `${testID}-option-${item.coin}` : undefined}
          />
        ))}
      </ScrollView>
    );
  }
  return (
    <YStack flexDirection={openUp ? 'column-reverse' : 'column'}>
      <SearchBar
        testID={testID ? `${testID}-search` : undefined}
        size="small"
        value={query}
        onSearchTextChange={setQuery}
        placeholder={display.label}
        onKeyPress={handleKeyPress}
        onSubmitEditing={handleSubmit}
        addOns={modeBadge}
        containerProps={{ borderRadius: 0, bg: '$transparent' }}
      />
      <Divider />
      <YStack h={listHeight} py={LIST_PADDING}>
        {list}
      </YStack>
    </YStack>
  );
}

/**
 * Token picker in a split-view panel's header, a short searchable list as on
 * Binance. A press on it selects the panel, like any press in the panel, and
 * turns the token into a search field in place: the popover opens over the
 * trigger with its side and size set as it opens, so nothing on the page
 * moves. A pick goes to `onSelectToken`, which selects the panel with that
 * token.
 */
export const PerpChartTokenSelector = memo(
  ({
    coin,
    display,
    onSelectToken,
    testID,
  }: {
    coin: string;
    display: IPerpsChartInstrumentDisplay;
    onSelectToken: (selection: IPerpTokenSelection) => void;
    testID?: string;
  }) => {
    const intl = useIntl();
    const triggerRef = useRef<IElement>(null);
    const [isOpen, setIsOpen] = useState(false);
    const [generation, setGeneration] = useState(0);
    const [layout, setLayout] = useState({
      openUp: false,
      listMaxHeight: MAX_LIST_HEIGHT,
    });
    const handleOpenChange = useCallback((open: boolean) => {
      if (open) {
        // The split view is web only, where the trigger is an element. The
        // list opens downwards unless the room below is too short for a
        // few rows and above has more; it gets the room of that side.
        const trigger = triggerRef.current as unknown as Element | null;
        const rect = trigger?.getBoundingClientRect();
        const fieldTop = (rect?.top ?? 0) + SEARCH_FIELD_TOP;
        const chrome = SEARCH_ROW_HEIGHT + VIEWPORT_PADDING;
        const below = window.innerHeight - fieldTop - chrome;
        const above = fieldTop + SEARCH_FIELD_HEIGHT - chrome;
        const openUp = below < MIN_LIST_HEIGHT && above > below;
        setLayout({
          openUp,
          listMaxHeight: Math.min(
            MAX_LIST_HEIGHT,
            Math.max(MIN_LIST_HEIGHT, openUp ? above : below),
          ),
        });
        // A fresh search each time, even when reopened mid-exit.
        setGeneration((value) => value + 1);
      }
      setIsOpen(open);
    }, []);
    const close = useCallback(() => setIsOpen(false), []);
    const handleSelect = useCallback(
      (item: IPerpChartTokenItem) => {
        setIsOpen(false);
        onSelectToken({ mode: item.mode, coin: item.coin });
      },
      [onSelectToken],
    );
    const pageFocused = useIsFocused();
    useEffect(() => {
      if (!pageFocused) close();
    }, [close, pageFocused]);
    useListenTabFocusState(ETabRoutes.Perp, (focused, hiddenByModal) => {
      if (!focused || hiddenByModal) close();
    });
    return (
      <Popover
        title={intl.formatMessage({
          id: ETranslations.dexmarket_select_token,
        })}
        floatingPanelProps={{ width: PANEL_WIDTH }}
        open={isOpen}
        onOpenChange={handleOpenChange}
        placement={layout.openUp ? 'top-start' : 'bottom-start'}
        // From the trigger's bottom when opening down, its top when opening
        // up; either way the field lands at the same place over the trigger.
        offset={
          layout.openUp
            ? -(SEARCH_FIELD_TOP + SEARCH_FIELD_HEIGHT)
            : SEARCH_FIELD_TOP - TRIGGER_HEIGHT
        }
        allowFlip={false}
        renderTrigger={
          <XStack
            ref={triggerRef}
            testID={testID}
            role="button"
            h={TRIGGER_HEIGHT}
            pl="$1"
            pr="$0.5"
            gap="$1.5"
            flexShrink={0}
            alignItems="center"
            borderRadius="$2"
            cursor="pointer"
            userSelect="none"
            hoverStyle={{ bg: '$bgHover' }}
          >
            <Token
              size="xs"
              borderRadius="$full"
              {...(display.tokenImageUris
                ? { tokenImageUris: display.tokenImageUris }
                : { tokenImageUri: display.tokenImageUri })}
              fallbackIcon="CryptoCoinOutline"
            />
            <SizableText size="$bodyMdMedium" numberOfLines={1}>
              {display.label}
            </SizableText>
            <Icon
              name="ChevronDownSmallOutline"
              size="$4"
              color="$iconSubdued"
            />
          </XStack>
        }
        renderContent={
          <PerpChartTokenSearch
            key={generation}
            coin={coin}
            display={display}
            listMaxHeight={layout.listMaxHeight}
            openUp={layout.openUp}
            onSelect={handleSelect}
            testID={testID}
          />
        }
      />
    );
  },
);

PerpChartTokenSelector.displayName = 'PerpChartTokenSelector';
