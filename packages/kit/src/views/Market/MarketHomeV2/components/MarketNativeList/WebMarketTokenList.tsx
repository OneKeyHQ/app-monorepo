// cspell:ignore reorderable
import {
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ReactNode } from 'react';

import { NativeList } from '@onekeyfe/react-native-native-list';
import { useIntl } from 'react-intl';

import {
  SizableText,
  Stack,
  getTokenValue,
  useClipboard,
  useTheme,
} from '@onekeyhq/components';
import type { ITableColumn } from '@onekeyhq/components';
import { LazyTooltip } from '@onekeyhq/components/src/actions/LazyTooltip';
import { useScrollContentRegistration } from '@onekeyhq/components/src/composite/ScrollContentRegistration';
import type { IDragEndParamsWithItem } from '@onekeyhq/components/src/layouts/SortableListView/types';
import { useWebPagerPage } from '@onekeyhq/kit/src/components/WebCollapsiblePagerContext';
import { useThemeVariant } from '@onekeyhq/kit/src/hooks/useThemeVariant';
import { useMarketWatchListV2Atom } from '@onekeyhq/kit/src/states/jotai/contexts/marketV2';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import {
  ECopyFrom,
  EWatchlistFrom,
} from '@onekeyhq/shared/src/logger/scopes/dex';
import { travelModeManager } from '@onekeyhq/shared/src/travelMode';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { getMarketWatchlistKey } from '@onekeyhq/shared/src/utils/marketWatchlistIdentity';
import { numberFormatAsRenderText } from '@onekeyhq/shared/src/utils/numberUtils';
import { parseDexCoin } from '@onekeyhq/shared/src/utils/perpsUtils';
import type { IMarketAssetListItem } from '@onekeyhq/shared/types/market';
import type { IMarketStockPublicItem } from '@onekeyhq/shared/types/marketV2';

import { useWatchListV2Action } from '../../../components/watchListHooksV2';
import { MarketTestIDs } from '../../../testIDs';
import { DesktopStickyHeaderContext } from '../../layouts/DesktopStickyHeaderContext';
import {
  downsampleStockSparkline,
  parseMarketStockNumber,
} from '../MarketStockList/utils';
import { getTokenAgeLabel } from '../MarketTokenList/hooks/useMarketTokenColumns/tokenAgeLabel';
import { getMarketWatchlistRowKind } from '../MarketTokenList/utils/marketWatchlistRowKind';

import { buildMarketNativeRowPatches } from './marketNativeListRows';

import type { IMarketPerpsToken } from '../MarketPerpsList/hooks/useMarketPerpsTokenList';
import type { IMarketToken } from '../MarketTokenList/MarketTokenData';
import type {
  ImageSource,
  MarketRow,
  NativeListActionAnchor,
  NativeListRef,
  NativeListSnapshot,
  NativeListTheme,
  RowActionEvent,
  ValueTextSegment,
  WebMarketTableCell,
  WebMarketTableColumn,
  WebMarketTableText,
} from '@onekeyfe/react-native-native-list';

type IWebColumn = Pick<
  ITableColumn<unknown>,
  'dataIndex' | 'columnProps' | 'columnWidth' | 'align'
>;

const ROW_STYLE = { container: { cornerRadius: 12 } } as const;
function formatted(
  value: number | string,
  formatter: 'marketCap' | 'price' | 'priceChangeCapped',
  currency = false,
  showPlusMinusSigns = false,
  capAtMaxT = true,
): WebMarketTableText {
  const formatterOptions: {
    currency?: string;
    capAtMaxT?: boolean;
    showPlusMinusSigns?: boolean;
  } = {};
  if (currency) {
    formatterOptions.currency = '$';
    if (capAtMaxT) formatterOptions.capAtMaxT = true;
  } else if (formatter === 'price') formatterOptions.currency = '';
  if (showPlusMinusSigns) formatterOptions.showPlusMinusSigns = true;
  const rendered = numberFormatAsRenderText(String(value), {
    formatter,
    formatterOptions,
  });
  if (typeof rendered === 'string') return { text: rendered };
  const segments = rendered?.map<ValueTextSegment>((segment) =>
    typeof segment === 'string'
      ? { text: segment }
      : {
          text: String(segment.value),
          ...(segment.type === 'sub' ? { style: 'subscript' as const } : {}),
        },
  );
  return {
    text: segments?.map((segment) => segment.text).join('') ?? '--',
    segments,
  };
}
function webImage(
  uri: string | undefined,
  size: number,
  sources?: readonly string[],
): ImageSource | undefined {
  const first = sources?.length ? sources[0] : uri;
  if (!first) return undefined;
  return {
    uri: first,
    width: size,
    height: size,
    loadingStrategy: 'static',
    retryTimes: 1,
    fallbackUris: sources?.slice(1) ?? [],
  };
}
function changeTone(change: number): WebMarketTableText['tone'] {
  if (change === 0) return 'primary';
  return change > 0 ? 'positive' : 'negative';
}
function metric(value: number, currency = false) {
  return !Number.isFinite(value) || value === 0
    ? { text: '--' }
    : formatted(value, 'marketCap', currency);
}
function spacing(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string')
    return (
      Number(
        getTokenValue(value as Parameters<typeof getTokenValue>[0], 'space'),
      ) || 0
    );
  return 0;
}

export function WebMarketTokenList({
  data,
  columns,
  onRow,
  footer,
  empty,
  networkId,
  contentPaddingBottom = 0,
  stockRows,
  assetRows,
  perpRows,
  watchlistFrom = EWatchlistFrom.Homepage,
  copyFrom = ECopyFrom.Homepage,
  watchlistMode = false,
  draggable = false,
  onDragEnd,
  onScrollBegin,
}: {
  data: IMarketToken[];
  columns: readonly IWebColumn[];
  stockRows?: ReadonlyMap<string, IMarketStockPublicItem>;
  assetRows?: ReadonlyMap<string, IMarketAssetListItem>;
  perpRows?: ReadonlyMap<string, IMarketPerpsToken>;
  onRow: (
    item: IMarketToken,
    index: number,
  ) => {
    onPress?: () => void;
    onLongPress?: () => void;
    onContextMenu?: (point?: { x: number; y: number }) => void;
  };
  watchlistMode?: boolean;
  draggable?: boolean;
  onDragEnd?: (params: IDragEndParamsWithItem<IMarketToken>) => void;
  onScrollBegin?: () => void;
  footer?: ReactNode;
  empty?: ReactNode;
  networkId?: string;
  contentPaddingBottom?: number;
  watchlistFrom?: EWatchlistFrom;
  copyFrom?: ECopyFrom;
}) {
  const intl = useIntl();
  const theme = useTheme();
  const themeVariant = useThemeVariant();
  const { owner: scrollElement, isFocused: isFocusedTab } = useWebPagerPage();
  const registerContent = useScrollContentRegistration();
  const rootRef = useRef<HTMLElement | null>(null);
  const setRootRef = useCallback((node: unknown) => {
    rootRef.current =
      typeof HTMLElement !== 'undefined' && node instanceof HTMLElement
        ? node
        : null;
  }, []);
  const registeredHeight = Math.max(
    400,
    data.length * 72 +
      contentPaddingBottom +
      (footer ? 132 : 0) +
      (!data.length && empty ? 60 : 0),
  );
  useEffect(() => {
    const element = rootRef.current;
    if (!element) return undefined;
    return registerContent?.(element, registeredHeight);
  }, [registerContent, registeredHeight]);
  const sticky = useContext(DesktopStickyHeaderContext);
  const [stickyInset, setStickyInset] = useState(0);
  useEffect(() => {
    const element = sticky?.portalTarget?.parentElement;
    if (!element) return undefined;
    const update = () =>
      setStickyInset((previous) => {
        const height = element.getBoundingClientRect().height;
        return previous === height ? previous : height;
      });
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, [sticky?.portalTarget]);
  const [{ data: watchlist, isMounted }] = useMarketWatchListV2Atom();
  const watched = useMemo(
    () => new Set(watchlist.map(getMarketWatchlistKey)),
    [watchlist],
  );
  const actions = useWatchListV2Action();
  const { copyText } = useClipboard();
  const busyRef = useRef(new Set<string>());
  const [busy, setBusy] = useState<ReadonlySet<string>>(new Set());
  const listRef = useRef<NativeListRef>(null);
  const [tooltip, setTooltip] = useState<{
    anchor: NativeListActionAnchor;
    actionKey: string;
    rowKey: string;
  }>();
  const stockPresentation = stockRows !== undefined;
  const webColumns = useMemo<WebMarketTableColumn[]>(
    () =>
      columns.flatMap((column): WebMarketTableColumn[] => {
        const props = column.columnProps;
        let flex: number | undefined;
        if (typeof props?.flex === 'number') flex = props.flex;
        else if (typeof props?.flexGrow === 'number' && props.flexGrow > 0)
          flex = props.flexGrow;
        let alignment: WebMarketTableColumn['alignment'] = 'start';
        if (column.align === 'right') alignment = 'end';
        else if (column.align === 'center') alignment = 'center';
        let width =
          typeof column.columnWidth === 'number' ? column.columnWidth : 40;
        if (props?.flexBasis === 0) width = 0;
        const mapped: WebMarketTableColumn = {
          key: String(column.dataIndex),
          width,
          ...(flex === undefined ? {} : { flex }),
          minWidth: typeof props?.minWidth === 'number' ? props.minWidth : 0,
          alignment,
          paddingStart: spacing(props?.pl ?? props?.paddingLeft ?? props?.px),
          paddingEnd: spacing(props?.pr ?? props?.paddingRight ?? props?.px),
        };
        if (stockPresentation && column.dataIndex === 'company')
          return [
            { key: 'star', width: 38, paddingStart: 8 },
            {
              ...mapped,
              width: Math.max(0, (mapped.width ?? 320) - 38),
              paddingStart: 0,
            },
          ];
        return [mapped];
      }),
    [columns, stockPresentation],
  );
  const nativeTheme = useMemo<NativeListTheme>(
    () => ({
      background: theme.bgApp.val,
      rowBackground: theme.bgApp.val,
      rowSelectedBackground: theme.bgActive.val,
      rowPressedBackground: theme.bgHover.val,
      subduedBackground: theme.bgSubdued.val,
      strongBackground: theme.bgStrong.val,
      imageFallbackBackground: theme.gray5.val,
      primaryText: theme.text.val,
      secondaryText: theme.textSubdued.val,
      disabledText: theme.textDisabled.val,
      icon: theme.icon.val,
      iconSubdued: theme.iconSubdued.val,
      separator: theme.borderSubdued.val,
      accent: theme.iconActive.val,
      positive: theme.textSuccess.val,
      negative: theme.textCritical.val,
      criticalBackground: theme.bgCritical.val,
      inverseBackground: theme.bgInverse.val,
      inverseText: theme.textInverse.val,
      info: theme.textInfo.val,
      caution: theme.textCaution.val,
    }),
    [theme],
  );
  const profileKind =
    travelModeManager.getRuntimeEnvironmentSync().profile.kind;
  const rowCache = useMemo(
    () => ({
      rows: new WeakMap<
        IMarketToken,
        {
          row: MarketRow;
          stock?: IMarketStockPublicItem;
          asset?: IMarketAssetListItem;
          perp?: IMarketPerpsToken;
          ageLabel?: string;
        }
      >(),
      // Presentation inputs define the cache namespace and its invalidation.
      presentation: [
        draggable,
        watchlistMode,
        webColumns,
        nativeTheme,
        networkId,
        isMounted,
        watched,
        busy,
        intl,
        watchlist,
        profileKind,
        theme.bgInfo.val,
        theme.textInfo.val,
        themeVariant,
        theme.iconSuccess.val,
        theme.iconSubdued.val,
        theme.bgApp.val,
        theme.neutral6Dark.val,
        theme.neutral2Dark.val,
      ],
    }),
    [
      draggable,
      watchlistMode,
      webColumns,
      nativeTheme,
      networkId,
      isMounted,
      watched,
      busy,
      intl,
      watchlist,
      profileKind,
      theme.bgInfo.val,
      theme.textInfo.val,
      themeVariant,
      theme.iconSuccess.val,
      theme.iconSubdued.val,
      theme.bgApp.val,
      theme.neutral6Dark.val,
      theme.neutral2Dark.val,
    ],
  );
  const hasTokenAge = webColumns.some(
    (column) => column.key === 'nameTokenAge',
  );
  const rowKeys = JSON.stringify(data.map((item) => item.id));
  const [structure, setStructure] = useState({ keys: rowKeys, generation: 1 });
  if (structure.keys !== rowKeys) {
    setStructure({ keys: rowKeys, generation: structure.generation + 1 });
  }
  const generation = structure.generation;
  const snapshot = useMemo<NativeListSnapshot>(
    () => ({
      schemaVersion: 1,
      generation,
      layout: { kind: 'linear', contentPaddingBottom },
      capabilities: { reorderable: draggable },
      theme: nativeTheme,
      rows: data.map<MarketRow>((item) => {
        const stock = stockRows?.get(item.id);
        const asset = assetRows?.get(item.id);
        const perp = perpRows?.get(item.id);
        const ageLabel = hasTokenAge
          ? getTokenAgeLabel(intl, item.firstTradeTime)
          : undefined;
        const cached = rowCache.rows.get(item);
        if (
          cached &&
          cached.stock === stock &&
          cached.asset === asset &&
          cached.perp === perp &&
          cached.ageLabel === ageLabel
        ) {
          return cached.row;
        }
        let rowTestID = MarketTestIDs.tokenRow(item.symbol);
        let starTestID = MarketTestIDs.tokenStarButton(item.symbol);
        if (stock) {
          rowTestID = MarketTestIDs.stockRow(stock.stockId);
          starTestID = MarketTestIDs.stockStarButton(stock.stockId);
        } else if (asset) {
          rowTestID = `market-top-coins-row-${asset.assetId}`;
          starTestID = MarketTestIDs.topCoinsStarButton(asset.assetId);
        }
        if (item.perpsCoin) starTestID = 'market-intl-icon-btn';
        const identity = {
          chainId: item.chainId || networkId || '',
          contractAddress: item.address,
          assetId: item.assetId,
          stockId: item.stockId,
        };
        const checked =
          isMounted &&
          (item.perpsCoin
            ? watchlist.some((entry) => entry.perpsCoin === item.perpsCoin)
            : watched.has(getMarketWatchlistKey(identity)));
        const cells = webColumns.map<WebMarketTableCell>((column) => {
          const key = column.key;
          if (key === 'star')
            return profileKind === 'travel-mode'
              ? { key, kind: 'text', primary: [{ text: '' }] }
              : {
                  key,
                  kind: 'favorite',
                  active: checked,
                  disabled: item.perpsCoin
                    ? false
                    : !isMounted || busy.has(item.id),
                  actionKey: 'favorite',
                  hoverActionKey: 'favorite-info',
                  accessibilityLabel: intl.formatMessage({
                    id: checked
                      ? ETranslations.market_remove_from_favorites
                      : ETranslations.market_add_to_favorites,
                  }),
                  testID: starTestID,
                };
          if (watchlistMode && key === 'name') {
            const kind = getMarketWatchlistRowKind(item);
            const dex = item.perpsCoin
              ? parseDexCoin(item.perpsCoin).dexLabel
              : undefined;
            const badges: NonNullable<
              Extract<WebMarketTableCell, { kind: 'asset' }>['badges']
            >[number][] = [];
            if (kind === 'perps') {
              if (item.maxLeverage)
                badges.push({
                  key: 'leverage',
                  text: `${item.maxLeverage}x`,
                  backgroundColor: theme.bgInfo.val,
                  textColor: theme.textInfo.val,
                  style: {
                    fontSize: 10,
                    lineHeight: 16,
                    height: 16,
                    horizontalPadding: 6,
                  },
                });
              if (dex && ['xyz', 'para', 'io'].includes(dex))
                badges.push({
                  key: 'dex',
                  text: dex,
                  actionKey: 'dex-info',
                  accessibilityLabel: dex,
                  backgroundColor: theme.bgInfo.val,
                  textColor: theme.textInfo.val,
                  style: {
                    fontSize: 10,
                    lineHeight: 16,
                    height: 16,
                    horizontalPadding: 6,
                  },
                });
            } else if (kind === 'token') {
              if (item.stock?.sourceLogoUri)
                badges.push({
                  key: 'source',
                  icon: {
                    uri: item.stock.sourceLogoUri,
                    width: 14,
                    height: 14,
                  },
                  accessibilityLabel: item.stock.title,
                  actionKey: item.stock.title ? 'source-info' : undefined,
                });
              if (item.communityRecognized)
                badges.push({
                  key: 'verified',
                  iconName: 'verified',
                  textColor: theme.iconSuccess.val,
                  actionKey: 'community-info',
                  accessibilityLabel: intl.formatMessage({
                    id: ETranslations.dexmarket_communityRecognized,
                  }),
                });
            }
            let subtitle: string | undefined = item.name;
            if (kind === 'token') subtitle = item.name?.trim();
            else if (kind === 'perps') subtitle = item.perpsSubtitle;
            const address =
              kind === 'token' && item.address
                ? accountUtils.shortenAddress({
                    address: item.address,
                    leadingLength: 6,
                    trailingLength: 4,
                  })
                : undefined;
            const secondary = subtitle;
            let hoverSecondary: Extract<
              WebMarketTableCell,
              { kind: 'asset' }
            >['hoverSecondary'];
            if (kind === 'stock' && item.stockVariants?.length) {
              hoverSecondary = [
                {
                  text: intl.formatMessage(
                    { id: ETranslations.market_number_tokens },
                    { number: item.stockVariants.length },
                  ),
                  style: { fontSize: 14, lineHeight: 20 },
                },
              ];
            } else if (address) {
              hoverSecondary = [
                { text: address, style: { fontSize: 14, lineHeight: 20 } },
              ];
            }
            return {
              key,
              kind: 'asset',
              leading: {
                kind: 'token',
                backgroundColor:
                  themeVariant === 'dark'
                    ? theme.neutral6Dark.val
                    : theme.bgApp.val,
                borderColor:
                  themeVariant === 'dark' ? theme.neutral2Dark.val : undefined,
                image: webImage(item.tokenImageUri, 40, item.tokenImageUris),
                fallbackIcon: {
                  name: 'CryptoCoinOutline',
                  tintColor: theme.iconSubdued.val,
                },
                overlays:
                  kind === 'token' && item.networkLogoUri
                    ? [
                        {
                          position: 'bottomRight',
                          size: 20,
                          padding: 2,
                          offset: 4,
                          backgroundColor: theme.bgApp.val,
                          image: {
                            uri: item.networkLogoUri,
                            width: 16,
                            height: 16,
                          },
                        },
                      ]
                    : undefined,
              },
              title: {
                text:
                  kind === 'asset' ? item.symbol.toUpperCase() : item.symbol,
              },
              lineGap: kind === 'perps' ? 4 : 0,
              badges,
              secondary: secondary
                ? [{ text: secondary, style: { fontSize: 14, lineHeight: 20 } }]
                : undefined,
              hoverSecondary,
              hoverImages:
                kind === 'stock'
                  ? item.stockVariants
                      ?.slice(0, 4)
                      .map((variant) =>
                        variant.logoUrl
                          ? (webImage(variant.logoUrl, 14) ?? null)
                          : null,
                      )
                  : undefined,
              hoverActionKey: address ? 'copy' : undefined,
              hoverActionLabel: address
                ? intl.formatMessage({ id: ETranslations.global_copy })
                : undefined,
            };
          }
          if (perp && key === 'name') {
            const badges: NonNullable<
              Extract<WebMarketTableCell, { kind: 'asset' }>['badges']
            >[number][] = [
              {
                key: 'leverage',
                text: `${perp.maxLeverage}x`,
                backgroundColor: theme.bgInfo.val,
                textColor: theme.textInfo.val,
                style: {
                  fontSize: 10,
                  fontWeight: 'regular',
                  lineHeight: 16,
                  height: 16,
                  horizontalPadding: 6,
                },
              },
            ];
            const dex = perp.dexLabel?.toLowerCase();
            if (dex === 'xyz' || dex === 'para' || dex === 'io')
              badges.push({
                key: 'dex',
                text: dex,
                backgroundColor: theme.bgInfo.val,
                textColor: theme.textInfo.val,
                actionKey: 'dex-info',
                accessibilityLabel: dex,
                style: {
                  fontSize: 10,
                  fontWeight: 'regular',
                  lineHeight: 16,
                  height: 16,
                  horizontalPadding: 6,
                },
              });
            return {
              key,
              kind: 'asset',
              leading: {
                kind: 'token',
                backgroundColor:
                  themeVariant === 'dark'
                    ? theme.neutral6Dark.val
                    : theme.bgApp.val,
                borderColor:
                  themeVariant === 'dark' ? theme.neutral2Dark.val : undefined,
                image: webImage(perp.tokenImageUrl, 40),
                fallbackIcon: {
                  name: 'CryptoCoinOutline',
                  tintColor: theme.iconSubdued.val,
                },
              },
              title: { text: perp.displayName },
              badges,
              secondary: perp.subtitle
                ? [
                    {
                      text: perp.subtitle,
                      style: { fontSize: 14, lineHeight: 20 },
                    },
                  ]
                : undefined,
            };
          }
          if (perp && key === 'change24h') {
            if (!Number.isFinite(perp.change24hPercent))
              return {
                key,
                kind: 'text',
                primary: [{ text: '--', tone: 'secondary' }],
              };
            const tone = perp.change24hPercent >= 0 ? 'positive' : 'negative';
            return {
              key,
              kind: 'text',
              partGap: 4,
              primary: [
                {
                  ...formatted(
                    Number(perp.markPrice) - Number(perp.prevDayPrice),
                    'price',
                    false,
                    true,
                  ),
                  tone,
                },
                { text: '/', tone },
                {
                  ...formatted(
                    perp.change24hPercent,
                    'priceChangeCapped',
                    false,
                    true,
                  ),
                  tone,
                },
              ],
            };
          }
          if (perp && key === 'fundingRate') {
            if (perp.fundingRate === undefined)
              return {
                key,
                kind: 'text',
                primary: [{ text: '--', tone: 'secondary' }],
              };
            const rate = Number(perp.fundingRate) * 100;
            return {
              key,
              kind: 'text',
              primary: [
                {
                  text: `${rate >= 0 ? '+' : ''}${rate.toFixed(4)}%`,
                  tone: rate >= 0 ? 'positive' : 'negative',
                },
              ],
            };
          }
          if (perp) {
            let value = perp.volume24h;
            if (key === 'price') value = perp.markPrice;
            else if (key === 'openInterest') value = perp.openInterest;
            return {
              key,
              kind: 'text',
              primary: [
                value === undefined
                  ? { text: '--' }
                  : formatted(
                      value,
                      key === 'price' ? 'price' : 'marketCap',
                      true,
                    ),
              ],
            };
          }
          if (asset && key === 'name')
            return {
              key,
              kind: 'asset',
              leading: {
                kind: 'token',
                backgroundColor:
                  themeVariant === 'dark'
                    ? theme.neutral6Dark.val
                    : theme.bgApp.val,
                borderColor:
                  themeVariant === 'dark' ? theme.neutral2Dark.val : undefined,
                image: webImage(asset.logoUrl, 40),
                fallbackIcon: {
                  name: 'CryptoCoinOutline',
                  tintColor: theme.iconSubdued.val,
                },
              },
              title: { text: asset.symbol.toUpperCase() },
              lineGap: 0,
              secondary: asset.name
                ? [
                    {
                      text: asset.name,
                      style: { fontSize: 14, lineHeight: 20 },
                    },
                  ]
                : undefined,
            };
          if (asset && key === 'sparkline24h') {
            if (!asset.sparkline24h || asset.sparkline24h.length < 2)
              return {
                key,
                kind: 'text',
                primary: [
                  {
                    text: '--',
                    tone: 'secondary',
                    style: { fontSize: 14, lineHeight: 20 },
                  },
                ],
              };
            let strokeColor =
              Number(asset.priceChange24hPercent) < 0 ? '#C40006' : '#00713F';
            if (themeVariant === 'dark')
              strokeColor =
                Number(asset.priceChange24hPercent) < 0 ? '#FF9592' : '#46FEA5';
            return {
              key,
              kind: 'sparkline',
              points: asset.sparkline24h.slice(-24),
              width: 132,
              height: 44,
              strokeColor,
              fillColor: `${strokeColor}33`,
            };
          }
          if (asset) {
            const value =
              asset[
                key as
                  | 'price'
                  | 'marketCap'
                  | 'volume24h'
                  | 'priceChange24hPercent'
                  | 'priceChange7dPercent'
              ];
            if (
              key === 'priceChange24hPercent' ||
              key === 'priceChange7dPercent'
            )
              return {
                key,
                kind: 'text',
                primary: [
                  {
                    ...formatted(value, 'priceChangeCapped', false, true),
                    tone: changeTone(Number(value)),
                  },
                ],
              };
            return {
              key,
              kind: 'text',
              primary: [
                value === undefined || !Number.isFinite(Number(value))
                  ? {
                      text: '--',
                      tone: 'secondary',
                      style: { fontSize: 14, lineHeight: 20 },
                    }
                  : formatted(
                      value,
                      key === 'price' ? 'price' : 'marketCap',
                      true,
                    ),
              ],
            };
          }
          if (stock && key === 'company')
            return {
              key,
              kind: 'asset',
              leading: {
                kind: 'token',
                backgroundColor:
                  themeVariant === 'dark'
                    ? theme.neutral6Dark.val
                    : theme.bgApp.val,
                borderColor:
                  themeVariant === 'dark' ? theme.neutral2Dark.val : undefined,
                image: webImage(stock.logoUrl, 40),
                fallbackIcon: {
                  name: 'CryptoCoinOutline',
                  tintColor: theme.iconSubdued.val,
                },
              },
              title: { text: stock.symbol },
              lineGap: 0,
              secondary: [
                { text: stock.name, style: { fontSize: 14, lineHeight: 20 } },
              ],
              secondaryBadges: stock.tags?.filter(Boolean).map((tag) => ({
                key: tag,
                text: tag,
                style: {
                  fontSize: 11,
                  lineHeight: 12,
                  height: 16,
                  horizontalPadding: 4,
                },
              })),
              hoverSecondary: stock.variants?.length
                ? [
                    {
                      text: intl.formatMessage(
                        { id: ETranslations.market_number_tokens },
                        { number: stock.variants.length },
                      ),
                      style: { fontSize: 14, lineHeight: 20 },
                    },
                  ]
                : undefined,
              hoverImages: stock.variants
                ?.slice(0, 4)
                .map((variant) =>
                  variant.logoUrl
                    ? (webImage(variant.logoUrl, 14) ?? null)
                    : null,
                ),
            };
          if (stock && key === 'sparkline') {
            const points = downsampleStockSparkline(stock.sparkline ?? []);
            if (points.length < 2)
              return {
                key,
                kind: 'text',
                primary: [
                  {
                    text: '--',
                    tone: 'secondary',
                    style: { fontSize: 14, lineHeight: 20 },
                  },
                ],
              };
            let strokeColor =
              Number(stock.priceChange24hPercent) < 0 ? '#C40006' : '#00713F';
            if (themeVariant === 'dark')
              strokeColor =
                Number(stock.priceChange24hPercent) < 0 ? '#FF9592' : '#46FEA5';
            return {
              key,
              kind: 'sparkline',
              points,
              width: 132,
              height: 44,
              strokeColor,
              fillColor: `${strokeColor}33`,
            };
          }
          if (stock) {
            const numeric = parseMarketStockNumber(
              stock[
                key as
                  | 'price'
                  | 'marketCap'
                  | 'volume24h'
                  | 'priceChange24hPercent'
              ],
            );
            if (numeric === undefined)
              return {
                key,
                kind: 'text',
                primary: [{ text: '--', tone: 'secondary' }],
              };
            if (key === 'priceChange24hPercent')
              return {
                key,
                kind: 'text',
                primary: [
                  {
                    ...formatted(
                      numeric,
                      'priceChangeCapped',
                      false,
                      numeric > 0,
                    ),
                    tone: changeTone(numeric),
                  },
                ],
              };
            return {
              key,
              kind: 'text',
              primary: [
                formatted(
                  numeric,
                  key === 'price' ? 'price' : 'marketCap',
                  true,
                ),
              ],
            };
          }
          if (key === 'nameTokenAge') {
            let secondary: readonly WebMarketTableText[] | undefined;
            if (ageLabel) {
              secondary = [
                {
                  text: ageLabel,
                  tone: 'primary',
                  style: { fontWeight: 'medium' },
                },
              ];
            } else if (!item.address) {
              secondary = [{ text: '--', tone: 'primary' }];
            }
            return {
              key,
              kind: 'asset',
              leading: {
                kind: 'token',
                backgroundColor:
                  themeVariant === 'dark'
                    ? theme.neutral6Dark.val
                    : theme.bgApp.val,
                borderColor:
                  themeVariant === 'dark' ? theme.neutral2Dark.val : undefined,
                fallbackIcon: {
                  name: 'CryptoCoinOutline',
                  tintColor: theme.iconSubdued.val,
                },
                overlays: item.networkLogoUri
                  ? [
                      {
                        position: 'bottomRight',
                        size: 20,
                        padding: 2,
                        offset: 4,
                        backgroundColor: theme.bgApp.val,
                        image: {
                          uri: item.networkLogoUri,
                          width: 16,
                          height: 16,
                        },
                      },
                    ]
                  : undefined,
                image: webImage(item.tokenImageUri, 40, item.tokenImageUris),
              },
              title: { text: item.symbol },
              secondary,
              hoverSecondary: [
                {
                  text: accountUtils.shortenAddress({
                    address: item.address,
                    leadingLength: 6,
                    trailingLength: 4,
                  }),
                },
              ],
              hoverActionKey: 'copy',
              hoverActionLabel: intl.formatMessage({
                id: ETranslations.global_copy,
              }),
              badges: item.communityRecognized
                ? [
                    {
                      key: 'verified',
                      iconName: 'verified',
                      textColor: theme.iconSuccess.val,
                      actionKey: 'community-info',
                      accessibilityLabel: intl.formatMessage({
                        id: ETranslations.dexmarket_communityRecognized,
                      }),
                    },
                  ]
                : undefined,
            };
          }
          if (key === 'marketCapPrice')
            return {
              key,
              kind: 'text',
              primary: [metric(item.marketCap, true)],
              secondary: [
                Number.isFinite(item.price)
                  ? formatted(
                      item.price,
                      item.price > 1_000_000 ? 'marketCap' : 'price',
                      true,
                    )
                  : { text: '--' },
              ],
            };
          if (watchlistMode && key === 'price')
            return {
              key,
              kind: 'text',
              primary: [
                Number.isFinite(item.price)
                  ? formatted(
                      item.price,
                      item.price > 1_000_000 ? 'marketCap' : 'price',
                      true,
                    )
                  : { text: '--' },
              ],
            };
          if (key === 'change24h')
            return {
              key,
              kind: 'text',
              primary: [
                item.priceChangeRaw === '-'
                  ? { text: '--' }
                  : {
                      ...formatted(
                        item.change24h,
                        'priceChangeCapped',
                        false,
                        item.change24h > 0,
                      ),
                      tone: changeTone(item.change24h),
                    },
              ],
            };
          if (key === 'transactions')
            return {
              key,
              kind: 'text',
              primary: [metric(item.transactions)],
              secondary:
                item.walletInfo && item.transactions > 0
                  ? [
                      {
                        ...formatted(item.walletInfo.buy, 'marketCap'),
                        tone: 'positive',
                      },
                      { text: '/' },
                      {
                        ...formatted(item.walletInfo.sell, 'marketCap'),
                        tone: 'negative',
                      },
                    ]
                  : undefined,
            };
          return {
            key,
            kind: 'text',
            primary: [
              metric(
                key === 'liquidity' ? item.liquidity : item.turnover,
                true,
              ),
            ],
          };
        });
        const row: MarketRow = {
          key: item.id,
          type: 'market',
          variant: 'token',
          leading: {
            kind: 'token',
            backgroundColor:
              themeVariant === 'dark'
                ? theme.neutral6Dark.val
                : theme.bgApp.val,
            borderColor:
              themeVariant === 'dark' ? theme.neutral2Dark.val : undefined,
            image: webImage(item.tokenImageUri, 40, item.tokenImageUris),
          },
          title: item.symbol,
          price: formatted(item.price, 'price', true).text,
          change: {
            text: String(item.change24h),
            tone: item.change24h < 0 ? 'negative' : 'positive',
          },
          height: 72,
          style: ROW_STYLE,
          pressActionKey: 'open',
          longPressActionKey: watchlistMode ? 'long-press' : undefined,
          webTable: {
            draggable,
            contextMenuActionKey: watchlistMode ? 'context-menu' : undefined,
            columns: webColumns,
            cells,
            testID: rowTestID,
          },
        };
        rowCache.rows.set(item, { row, stock, asset, perp, ageLabel });
        return row;
      }),
    }),
    [
      generation,
      draggable,
      watchlistMode,
      data,
      contentPaddingBottom,
      webColumns,
      nativeTheme,
      networkId,
      isMounted,
      watched,
      busy,
      intl,
      stockRows,
      assetRows,
      perpRows,
      watchlist,
      rowCache,
      hasTokenAge,
      profileKind,
      theme.bgInfo.val,
      theme.textInfo.val,
      themeVariant,
      theme.iconSuccess.val,
      theme.iconSubdued.val,
      theme.bgApp.val,
      theme.neutral6Dark.val,
      theme.neutral2Dark.val,
    ],
  );
  const [baseSnapshot, setBaseSnapshot] = useState(snapshot);
  const appliedRef = useRef<
    { base: NativeListSnapshot; latest: NativeListSnapshot } | undefined
  >(undefined);
  const previous =
    appliedRef.current?.base === baseSnapshot
      ? appliedRef.current.latest
      : baseSnapshot;
  const patches = useMemo(
    () => buildMarketNativeRowPatches(previous, snapshot),
    [previous, snapshot],
  );
  if (patches === undefined && baseSnapshot !== snapshot)
    setBaseSnapshot(snapshot);
  useLayoutEffect(() => {
    if (!listRef.current) {
      appliedRef.current = undefined;
      return;
    }
    if (patches?.length) listRef.current.applyPatches(patches);
    appliedRef.current = { base: baseSnapshot, latest: snapshot };
  }, [patches, snapshot, baseSnapshot]);
  const handleAction = useCallback(
    (event: RowActionEvent) => {
      const index = data.findIndex((item) => item.id === event.rowKey);
      const item = data[index];
      if (!item) return;
      if (
        ['community-info', 'favorite-info', 'dex-info', 'source-info'].includes(
          event.actionKey,
        ) &&
        event.anchor
      ) {
        listRef.current?.setActionAnchorState({
          token: event.anchor.token,
          open: true,
        });
        setTooltip({
          anchor: event.anchor,
          actionKey: event.actionKey,
          rowKey: item.id,
        });
        return;
      }
      if (event.actionKey === 'context-menu') {
        if (event.anchor)
          listRef.current?.setActionAnchorState({
            token: event.anchor.token,
            open: true,
          });
        onRow(item, index).onContextMenu?.(event.windowPoint);
        return;
      }
      if (event.actionKey === 'long-press') {
        if (event.anchor)
          listRef.current?.setActionAnchorState({
            token: event.anchor.token,
            open: true,
          });
        onRow(item, index).onLongPress?.();
        return;
      }
      if (event.actionKey === 'open') {
        onRow(item, index).onPress?.();
        return;
      }
      if (event.actionKey === 'copy') {
        copyText(item.address);
        defaultLogger.dex.actions.dexCopyCA({
          copyFrom,
          copiedContent: item.address,
        });
        return;
      }
      if (event.actionKey === 'favorite' && item.perpsCoin) {
        const checked = watchlist.some(
          (entry) => entry.perpsCoin === item.perpsCoin,
        );
        if (checked) actions.removePerpsFromWatchListV2(item.perpsCoin);
        else actions.addPerpsIntoWatchListV2(item.perpsCoin);
        return;
      }
      if (
        event.actionKey !== 'favorite' ||
        !isMounted ||
        busyRef.current.has(item.id)
      )
        return;
      busyRef.current.add(item.id);
      setBusy(new Set(busyRef.current));
      const chainId = item.chainId || networkId || '';
      const checked = watched.has(
        getMarketWatchlistKey({
          chainId,
          contractAddress: item.address,
          assetId: item.assetId,
          stockId: item.stockId,
        }),
      );
      void (async () => {
        try {
          if (checked) {
            const removed = await actions.removeFromWatchListV2(
              chainId,
              item.address,
              { assetId: item.assetId, stockId: item.stockId },
            );
            if (removed)
              defaultLogger.dex.watchlist.dexRemoveFromWatchlist({
                network: chainId,
                tokenSymbol: item.symbol,
                tokenContract: item.address,
                removeFrom: watchlistFrom,
              });
          } else {
            const added = await actions.addIntoWatchListV2([
              {
                chainId: item.assetId || item.stockId ? '' : chainId,
                contractAddress:
                  item.assetId || item.stockId ? '' : item.address,
                isNative: item.isNative,
                assetId: item.assetId,
                stockId: item.stockId,
              },
            ]);
            if (added)
              defaultLogger.dex.watchlist.dexAddToWatchlist({
                network: chainId,
                tokenSymbol: item.symbol,
                tokenContract: item.address,
                addFrom: watchlistFrom,
              });
          }
        } finally {
          busyRef.current.delete(item.id);
          setBusy(new Set(busyRef.current));
        }
      })();
    },
    [
      data,
      onRow,
      copyText,
      copyFrom,
      isMounted,
      networkId,
      watched,
      actions,
      watchlistFrom,
      watchlist,
    ],
  );
  const tooltipItem = tooltip
    ? data.find((item) => item.id === tooltip.rowKey)
    : undefined;
  let tooltipText = intl.formatMessage({
    id: ETranslations.dexmarket_communityRecognized,
  });
  if (tooltip?.actionKey === 'favorite-info' && tooltipItem) {
    const checked = tooltipItem.perpsCoin
      ? watchlist.some((entry) => entry.perpsCoin === tooltipItem.perpsCoin)
      : watched.has(
          getMarketWatchlistKey({
            chainId: tooltipItem.chainId || networkId || '',
            contractAddress: tooltipItem.address,
            assetId: tooltipItem.assetId,
            stockId: tooltipItem.stockId,
          }),
        );
    tooltipText = intl.formatMessage({
      id: checked
        ? ETranslations.market_remove_from_favorites
        : ETranslations.market_add_to_favorites,
    });
  }
  if (tooltip?.actionKey === 'source-info')
    tooltipText = tooltipItem?.stock?.title ?? '';
  if (tooltip?.actionKey === 'dex-info') {
    const dex =
      perpRows?.get(tooltip.rowKey)?.dexLabel?.toLowerCase() ??
      (tooltipItem?.perpsCoin
        ? parseDexCoin(tooltipItem.perpsCoin).dexLabel
        : undefined);
    if (dex === 'xyz')
      tooltipText = intl.formatMessage({
        id: ETranslations.perp_xyz_market__desc,
      });
    else if (dex === 'para')
      tooltipText = intl.formatMessage({
        id: ETranslations.perp_para_market__desc,
      });
    else if (dex === 'io')
      tooltipText = intl.formatMessage({
        id: ETranslations.perp_io_market__desc,
      });
  }
  return (
    <Stack ref={setRootRef} width="100%" minHeight={registeredHeight}>
      <NativeList
        ref={listRef}
        snapshot={baseSnapshot}
        webScrollHost={isFocusedTab ? (scrollElement ?? null) : null}
        webStickyInset={stickyInset}
        listEmpty={empty}
        listFooter={footer}
        onRowAction={handleAction}
        onActionAnchorInvalidated={() => {
          setTooltip(undefined);
          onScrollBegin?.();
        }}
        onReorder={(event) => {
          const from = data.findIndex((item) => item.id === event.key);
          if (from < 0) return;
          const next = [...data];
          const [dragItem] = next.splice(from, 1);
          next.splice(event.toIndex, 0, dragItem);
          onDragEnd?.({
            data: next,
            from,
            to: event.toIndex,
            dragItem,
            prevItem: next[event.toIndex - 1],
            nextItem: next[event.toIndex + 1],
          });
        }}
        style={{ width: '100%' }}
      />
      {tooltip ? (
        <Stack
          position="fixed"
          left={tooltip.anchor.windowRect.x}
          top={tooltip.anchor.windowRect.y}
          width={tooltip.anchor.windowRect.width}
          height={tooltip.anchor.windowRect.height}
          pointerEvents="none"
        >
          <LazyTooltip
            open
            onOpenChange={(open) => {
              if (!open) {
                listRef.current?.setActionAnchorState({
                  token: tooltip.anchor.token,
                  open: false,
                  restoreFocus: true,
                });
                setTooltip(undefined);
              }
            }}
            placement="top"
            renderTrigger={
              <Stack
                width={tooltip.anchor.windowRect.width}
                height={tooltip.anchor.windowRect.height}
                pointerEvents="none"
              />
            }
            renderContent={
              <SizableText size="$bodySm">{tooltipText}</SizableText>
            }
          />
        </Stack>
      ) : null}
    </Stack>
  );
}

export function WebMarketStockList({
  items,
  columns,
  onPress,
  footer,
  empty,
  contentPaddingBottom,
}: {
  items: IMarketStockPublicItem[];
  columns: readonly IWebColumn[];
  onPress: (item: IMarketStockPublicItem) => void;
  footer?: ReactNode;
  empty?: ReactNode;
  contentPaddingBottom?: number;
}) {
  const stockRows = useMemo(
    () => new Map(items.map((item) => [item.stockId, item])),
    [items],
  );
  const data = useMemo<IMarketToken[]>(
    () =>
      items.map((item) => ({
        id: item.stockId,
        stockId: item.stockId,
        symbol: item.symbol,
        name: item.name,
        address: '',
        decimals: 0,
        price: Number(item.price),
        change24h: Number(item.priceChange24hPercent),
        marketCap: Number(item.marketCap),
        turnover: Number(item.volume24h),
        liquidity: 0,
        transactions: 0,
        uniqueTraders: 0,
        holders: 0,
        tokenImageUri: item.logoUrl,
        networkLogoUri: '',
        networkId: '',
      })),
    [items],
  );
  const onRow = useCallback(
    (_: IMarketToken, index: number) => ({
      onPress: () => onPress(items[index]),
    }),
    [items, onPress],
  );
  return (
    <WebMarketTokenList
      data={data}
      columns={columns}
      onRow={onRow}
      stockRows={stockRows}
      footer={footer}
      empty={empty}
      contentPaddingBottom={contentPaddingBottom}
    />
  );
}

export function WebMarketTopCoinsList({
  items,
  columns,
  onRow: originalOnRow,
  contentPaddingBottom,
}: {
  items: IMarketAssetListItem[];
  columns: readonly IWebColumn[];
  onRow: (item: IMarketAssetListItem) => { onPress?: () => void };
  contentPaddingBottom?: number;
}) {
  const assetRows = useMemo(
    () => new Map(items.map((item) => [item.assetId, item])),
    [items],
  );
  const data = useMemo<IMarketToken[]>(
    () =>
      items.map((item) => ({
        id: item.assetId,
        assetId: item.assetId,
        symbol: item.symbol.toUpperCase(),
        name: item.name ?? '',
        address: '',
        decimals: 0,
        price: Number(item.price),
        change24h: Number(item.priceChange24hPercent),
        marketCap: Number(item.marketCap),
        turnover: Number(item.volume24h),
        liquidity: 0,
        transactions: 0,
        uniqueTraders: 0,
        holders: 0,
        tokenImageUri: item.logoUrl,
        networkLogoUri: '',
        networkId: '',
      })),
    [items],
  );
  const onRow = useCallback(
    (_: IMarketToken, index: number) => originalOnRow(items[index]),
    [items, originalOnRow],
  );
  return (
    <WebMarketTokenList
      data={data}
      columns={columns}
      onRow={onRow}
      assetRows={assetRows}
      contentPaddingBottom={contentPaddingBottom}
    />
  );
}

export function WebMarketPerpsList({
  items,
  columns,
  onPress,
  footer,
  empty,
  contentPaddingBottom,
}: {
  items: IMarketPerpsToken[];
  columns: readonly IWebColumn[];
  onPress: (name: string) => void;
  footer?: ReactNode;
  empty?: ReactNode;
  contentPaddingBottom?: number;
}) {
  const perpRows = useMemo(
    () => new Map(items.map((item) => [item.name, item])),
    [items],
  );
  const data = useMemo<IMarketToken[]>(
    () =>
      items.map((item) => ({
        id: item.name,
        perpsCoin: item.name,
        symbol: item.displayName,
        name: item.name,
        address: '',
        decimals: 0,
        price: Number(item.markPrice),
        change24h: item.change24hPercent,
        marketCap: 0,
        turnover: Number(item.volume24h),
        liquidity: 0,
        transactions: 0,
        uniqueTraders: 0,
        holders: 0,
        tokenImageUri: item.tokenImageUrl,
        networkLogoUri: '',
        networkId: '',
      })),
    [items],
  );
  const onRow = useCallback(
    (item: IMarketToken) => ({ onPress: () => onPress(item.id) }),
    [onPress],
  );
  return (
    <WebMarketTokenList
      data={data}
      columns={columns}
      onRow={onRow}
      perpRows={perpRows}
      footer={footer}
      empty={empty}
      contentPaddingBottom={contentPaddingBottom}
    />
  );
}
