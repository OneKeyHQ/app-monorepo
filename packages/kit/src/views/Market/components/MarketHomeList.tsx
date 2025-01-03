import {
  Fragment,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { useIntl } from 'react-intl';
import {
  InteractionManager,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { TouchableWithoutFeedback } from 'react-native-gesture-handler';

import type {
  IActionListItemProps,
  IElement,
  IStackStyle,
  ITableColumn,
  ITableProps,
} from '@onekeyhq/components';
import {
  ActionList,
  Icon,
  NumberSizeableText,
  Select,
  SizableText,
  Skeleton,
  Spinner,
  Stack,
  Table,
  View,
  XStack,
  YStack,
  useMedia,
  usePopoverContext,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { EWatchlistFrom } from '@onekeyhq/shared/src/logger/scopes/market/scenes/token';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ETabMarketRoutes } from '@onekeyhq/shared/src/routes';
import { listItemPressStyle } from '@onekeyhq/shared/src/style';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import { isSupportStaking } from '@onekeyhq/shared/types/earn/earnProvider.constants';
import type {
  IMarketCategory,
  IMarketToken,
} from '@onekeyhq/shared/types/market';

import { useReviewControl } from '../../../components/ReviewControl';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { usePrevious } from '../../../hooks/usePrevious';
import { usePromiseResult } from '../../../hooks/usePromiseResult';
import { useThemeVariant } from '../../../hooks/useThemeVariant';

import { MarketListTradeButton } from './MarketListTradeButton';
import { MarketMore } from './MarketMore';
import { MarketStar } from './MarketStar';
import { MarketTokenIcon } from './MarketTokenIcon';
import { MarketTokenPrice } from './MarketTokenPrice';
import { PriceChangePercentage } from './PriceChangePercentage';
import SparklineChart from './SparklineChart';
import { ToggleButton } from './ToggleButton';
import { useLazyMarketTradeActions } from './tradeHook';
import { useSortType } from './useSortType';
import { useWatchListAction } from './wachListHooks';

const lineColorMap = {
  light: ['rgba(0, 113, 63)', 'rgba(196, 0, 6)'],
  dark: ['rgba(70, 254, 165)', 'rgba(255, 149, 146)'],
};
const colorMap = {
  light: ['rgba(0, 113, 63, 0.2)', 'rgba(196, 0, 6, 0.2)'],
  dark: ['rgba(70, 254, 165, 0.2)', 'rgba(255, 149, 146, 0.2)'],
};

const ROW_PROPS = {
  gap: '$3',
  px: '$3',
  mx: '$2',
};

const HEADER_ROW_PROPS = {
  minHeight: '$4',
  py: '$2',
  borderRadius: '$3',
} as IStackStyle;

function ListEmptyComponent({
  columns,
}: {
  columns: ITableColumn<IMarketToken>[];
}) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const timerId = setTimeout(
      () => {
        setIsVisible(true);
      },
      platformEnv.isNative ? 350 : 50,
    );
    return () => {
      clearTimeout(timerId);
    };
  }, []);

  return isVisible ? (
    <Table.Skeleton count={6} columns={columns} rowProps={ROW_PROPS} />
  ) : null;
}

function TableMdSkeletonRow() {
  return (
    <XStack h={60} jc="space-between" flex={1}>
      <XStack gap="$3" ai="center">
        <Skeleton w="$10" h="$10" radius="round" />
        <YStack gap="$2">
          <Skeleton w="$16" h="$2.5" />
          <Skeleton w="$24" h="$2.5" />
        </YStack>
      </XStack>
      <XStack gap="$5" ai="center">
        <Skeleton w="$16" h="$2.5" />
        <Skeleton w="$16" h="$2.5" />
      </XStack>
    </XStack>
  );
}

function MdPlaceholder() {
  return (
    <Stack
      borderRadius="$2"
      width="$20"
      height="$8"
      bg="$bgDisabled"
      jc="center"
      ai="center"
    >
      <SizableText size="$bodyMdMedium">-</SizableText>
    </Stack>
  );
}

type IKeyOfMarketToken = keyof IMarketToken;
const TouchableContainer = platformEnv.isNative
  ? Fragment
  : TouchableWithoutFeedback;

function MarketMdColumn({
  item,
  currency,
  mdColumnKeys,
  showMoreAction,
}: {
  item: IMarketToken;
  currency: string;
  mdColumnKeys: (keyof IMarketToken)[];
  showMoreAction: boolean;
}) {
  const navigation = useAppNavigation();
  const actions = useWatchListAction();
  const isShowActionSheet = useRef(false);
  const intl = useIntl();

  const toDetailPage = useCallback(() => {
    if (isShowActionSheet.current) {
      return;
    }
    navigation.push(ETabMarketRoutes.MarketDetail, {
      token: item.coingeckoId,
    });
  }, [item.coingeckoId, navigation]);

  const tradeActions = useLazyMarketTradeActions(item.coingeckoId);
  const showReviewControl = useReviewControl();
  const showBuyOrSellButton = item.isSupportBuy && showReviewControl;
  const canStaking = useMemo(
    () => isSupportStaking(item.symbol),
    [item.symbol],
  );
  const handleMdItemAction = useCallback(async () => {
    const { coingeckoId, symbol } = item;
    const isInWatchList = actions.isInWatchList(coingeckoId);
    const title = symbol.toUpperCase();
    const onClose = () => {
      isShowActionSheet.current = false;
    };
    isShowActionSheet.current = true;
    ActionList.show({
      title,
      onClose,
      sections: [
        {
          items: [
            isInWatchList
              ? {
                  destructive: true,
                  icon: 'DeleteOutline' as const,
                  label: intl.formatMessage({
                    id: ETranslations.market_remove_from_watchlist,
                  }),
                  onPress: () => {
                    actions.removeFormWatchList(coingeckoId);
                    defaultLogger.market.token.removeFromWatchlist({
                      tokenSymbol: coingeckoId,
                      removeWatchlistFrom: EWatchlistFrom.catalog,
                    });
                  },
                }
              : {
                  icon: 'StarOutline' as const,
                  label: intl.formatMessage({
                    id: ETranslations.market_add_to_watchlist,
                  }),
                  onPress: () => {
                    actions.addIntoWatchList(coingeckoId);
                    defaultLogger.market.token.addToWatchList({
                      tokenSymbol: coingeckoId,
                      addWatchlistFrom: EWatchlistFrom.catalog,
                    });
                  },
                },
            showMoreAction && {
              icon: 'ArrowTopOutline' as const,
              label: intl.formatMessage({
                id: ETranslations.market_move_to_top,
              }),
              onPress: () => {
                actions.MoveToTop(coingeckoId);
              },
            },
          ].filter(Boolean),
        },
        {
          items: [
            {
              icon: 'SwitchHorOutline' as const,
              label: intl.formatMessage({ id: ETranslations.global_trade }),
              onPress: tradeActions.onSwapLazyModal,
            },
            canStaking && {
              icon: 'CoinsOutline' as const,
              label: intl.formatMessage({ id: ETranslations.earn_stake }),
              onPress: tradeActions.onStaking,
            },
            showBuyOrSellButton && {
              icon: 'PlusLargeSolid' as const,
              label: intl.formatMessage({ id: ETranslations.global_buy }),
              onPress: tradeActions.onBuy,
            },
            showBuyOrSellButton && {
              icon: 'MinusLargeSolid' as const,
              label: intl.formatMessage({ id: ETranslations.global_sell }),
              onPress: tradeActions.onSell,
            },
          ].filter(Boolean),
        },
      ],
    });
  }, [
    actions,
    canStaking,
    intl,
    item,
    showBuyOrSellButton,
    showMoreAction,
    tradeActions.onBuy,
    tradeActions.onSell,
    tradeActions.onStaking,
    tradeActions.onSwapLazyModal,
  ]);
  const pressEvents = useMemo(
    () => ({
      onPress: () => toDetailPage(),
      onLongPress: () => {
        void handleMdItemAction();
      },
      delayLongPress: platformEnv.isNative ? undefined : 300,
    }),
    [handleMdItemAction, toDetailPage],
  );
  return (
    <TouchableContainer
      containerStyle={{ flex: 1 }}
      style={{ flex: 1 }}
      {...(platformEnv.isNative ? undefined : pressEvents)}
    >
      <XStack
        height={60}
        flex={1}
        justifyContent="space-between"
        userSelect="none"
        gap="$2"
        px="$5"
        {...listItemPressStyle}
        {...(platformEnv.isNative ? pressEvents : undefined)}
      >
        <XStack gap="$3" ai="center">
          <MarketTokenIcon uri={item.image} size="$10" />
          <YStack>
            <SizableText size="$bodyLgMedium" userSelect="none">
              {item.symbol.toUpperCase()}
            </SizableText>
            <SizableText size="$bodySm" color="$textSubdued" userSelect="none">
              {`VOL `}
              <NumberSizeableText
                userSelect="none"
                size="$bodySm"
                formatter="marketCap"
                color="$textSubdued"
                formatterOptions={{ currency }}
              >
                {item.totalVolume}
              </NumberSizeableText>
            </SizableText>
          </YStack>
        </XStack>
        <XStack ai="center" gap="$5" flexShrink={1}>
          {mdColumnKeys[0] === 'price' ? (
            <MarketTokenPrice
              numberOfLines={1}
              flexShrink={1}
              size="$bodyLgMedium"
              price={String(item[mdColumnKeys[0]])}
              tokenName={item.name}
              tokenSymbol={item.symbol}
              lastUpdated={item.lastUpdated}
            />
          ) : (
            <NumberSizeableText
              userSelect="none"
              flexShrink={1}
              numberOfLines={1}
              size="$bodyLgMedium"
              formatter="marketCap"
              formatterOptions={{ currency }}
            >
              {item[mdColumnKeys[0]] as string}
            </NumberSizeableText>
          )}
          {item[mdColumnKeys[1]] ? (
            <XStack
              width="$20"
              height="$8"
              jc="center"
              ai="center"
              backgroundColor={
                Number(item.priceChangePercentage24H) > 0
                  ? '$bgSuccessStrong'
                  : '$bgCriticalStrong'
              }
              borderRadius="$2"
            >
              <NumberSizeableText
                adjustsFontSizeToFit
                numberOfLines={platformEnv.isNative ? 1 : 2}
                px="$1"
                userSelect="none"
                size="$bodyMdMedium"
                color="white"
                formatter="priceChange"
                formatterOptions={{ showPlusMinusSigns: true }}
              >
                {item[mdColumnKeys[1]] as string}
              </NumberSizeableText>
            </XStack>
          ) : (
            <MdPlaceholder />
          )}
        </XStack>
      </XStack>
    </TouchableContainer>
  );
}

function BasicMarketHomeList({
  category,
  tabIndex = 0,
  showMoreAction = false,
  ordered,
}: {
  tabIndex?: number;
  category: IMarketCategory;
  showMoreAction?: boolean;
  ordered?: boolean;
}) {
  const intl = useIntl();
  const navigation = useAppNavigation();

  const updateAtRef = useRef(0);

  const [listData, setListData] = useState<IMarketToken[]>([]);
  const prevCoingeckoIdsLength = usePrevious(category.coingeckoIds.length);

  const fetchCategory = useCallback(async () => {
    const now = Date.now();
    if (
      now - updateAtRef.current >
        timerUtils.getTimeDurationMs({ seconds: 45 }) ||
      prevCoingeckoIdsLength !== category.coingeckoIds.length ||
      (prevCoingeckoIdsLength === 0 && category.coingeckoIds.length === 0)
    ) {
      updateAtRef.current = now;
      const response = await backgroundApiProxy.serviceMarket.fetchCategory(
        category.categoryId,
        category.coingeckoIds,
        true,
      );
      void InteractionManager.runAfterInteractions(() => {
        setListData(response);
      });
    }
  }, [category.categoryId, category.coingeckoIds, prevCoingeckoIdsLength]);

  usePromiseResult(
    async () => {
      await fetchCategory();
    },
    [fetchCategory],
    {
      pollingInterval: timerUtils.getTimeDurationMs({ seconds: 50 }),
    },
  );

  useEffect(() => {
    void fetchCategory();
  }, [fetchCategory]);

  const { md, gtMd, gt2Md, gtLg, gtXl, gt2xl } = useMedia();

  const filterCoingeckoIdsListData = useMemo(() => {
    const filterListData = category.coingeckoIds?.length
      ? listData?.filter((item) =>
          category.coingeckoIds.includes(item.coingeckoId),
        )
      : listData;
    if (ordered) {
      return category.coingeckoIds.reduce((prev, coingeckoId) => {
        const item = filterListData?.find(
          (i) => i?.coingeckoId === coingeckoId,
        );
        if (item) {
          prev.push(item);
        }
        return prev;
      }, [] as IMarketToken[]);
    }
    return filterListData;
  }, [category.coingeckoIds, listData, ordered]);
  const { sortedListData, handleSortTypeChange, sortByType, setSortByType } =
    useSortType(filterCoingeckoIdsListData as Record<string, any>[]);

  const [mdColumnKeys, setMdColumnKeys] = useState<IKeyOfMarketToken[]>([
    'price',
    'priceChangePercentage24H',
  ]);

  const toDetailPage = useCallback(
    (item: IMarketToken) => {
      navigation.push(ETabMarketRoutes.MarketDetail, {
        token: item.coingeckoId,
      });
    },
    [navigation],
  );

  const { width: screenWidth } = useWindowDimensions();

  const [settings] = useSettingsPersistAtom();
  const currency = settings.currencyInfo.symbol;

  const renderMdItem = useCallback(
    (item: IMarketToken) => (
      <MarketMdColumn
        item={item}
        currency={currency}
        mdColumnKeys={mdColumnKeys}
        showMoreAction={showMoreAction}
      />
    ),
    [currency, mdColumnKeys, showMoreAction],
  );

  const renderSelectTrigger = useCallback(
    ({ label }: { label?: string }) => (
      <XStack ai="center" gap="$2">
        <Icon name="FilterSortOutline" color="$iconSubdued" size="$5" />
        <XStack ai="center" gap="$1">
          <SizableText size="$bodyMd" color="$textSubdued">
            {label}
          </SizableText>
          <Icon name="ChevronDownSmallSolid" size="$4" />
        </XStack>
      </XStack>
    ),
    [],
  );

  // const handleSettingsContentChange = useCallback(
  //   ({
  //     dataDisplay,
  //     priceChange,
  //   }: {
  //     dataDisplay: IKeyOfMarketToken;
  //     priceChange: IKeyOfMarketToken;
  //   }) => {
  //     setMdColumnKeys([dataDisplay, priceChange]);
  //   },
  //   [],
  // );

  const [mdSortByType, setMdSortByType] = useState<string | undefined>(
    'Default',
  );
  const selectOptions = useMemo(
    () => [
      {
        label: intl.formatMessage({ id: ETranslations.global_default }),
        value: 'Default',
      },
      {
        label: intl.formatMessage({ id: ETranslations.market_last_price }),
        value: 'Last price',
        options: { columnName: 'price', order: 'desc' },
      },
      {
        label: intl.formatMessage({ id: ETranslations.market_most_24h_volume }),
        value: 'Most 24h volume',
        options: { columnName: 'totalVolume', order: 'desc' },
      },
      {
        label: intl.formatMessage({ id: ETranslations.market_most_market_cap }),
        value: 'Most market cap',
        options: { columnName: 'marketCap', order: 'desc' },
      },
      {
        label: intl.formatMessage({ id: ETranslations.market_price_change_up }),
        value: 'Price change up',
        options: { columnName: mdColumnKeys[1], order: 'desc' },
      },
      {
        label: intl.formatMessage({
          id: ETranslations.market_price_change_down,
        }),
        value: 'Price change down',
        options: { columnName: mdColumnKeys[1], order: 'asc' },
      },
    ],
    [intl, mdColumnKeys],
  );

  const handleMdSortByTypeChange = useCallback(
    (value: string) => {
      setMdSortByType(value);
      const item = selectOptions.find((v) => v.value === value);
      setSortByType(item?.options as typeof sortByType);
    },
    [selectOptions, setSortByType],
  );

  const containerRef = useRef<IElement>(null);
  const onSwitchMarketHomeTabCallback = useCallback(
    ({ tabIndex: index }: { tabIndex: number }) => {
      setTimeout(
        () => {
          if (!platformEnv.isNative && containerRef.current) {
            (containerRef.current as HTMLElement).style.contentVisibility =
              index === tabIndex ? 'visible' : 'hidden';
          }
          if (index !== tabIndex) {
            if (md) {
              handleMdSortByTypeChange('Default');
            }
          } else {
            void fetchCategory();
          }
        },
        platformEnv.isNative ? 10 : 0,
      );
    },
    [fetchCategory, handleMdSortByTypeChange, md, tabIndex],
  );

  useEffect(() => {
    appEventBus.on(
      EAppEventBusNames.SwitchMarketHomeTab,
      onSwitchMarketHomeTabCallback,
    );
    return () => {
      appEventBus.off(
        EAppEventBusNames.SwitchMarketHomeTab,
        onSwitchMarketHomeTabCallback,
      );
    };
  }, [md, onSwitchMarketHomeTabCallback, tabIndex]);

  const theme = useThemeVariant();
  const lineColors = lineColorMap[theme];
  const colors = colorMap[theme];

  const marketListTradeButtonWidth = useCallback(() => {
    if (gtMd) {
      let numberOfButtons = 1;
      let isItemSupportStaking = false;
      let isItemSupportBuy = false;
      if (listData) {
        for (let i = 0; i < listData.length; i += 1) {
          const item = listData[i] as unknown as IMarketToken;
          if (!isItemSupportStaking) {
            const stakingItem = isSupportStaking(item.symbol);
            if (stakingItem) {
              isItemSupportStaking = true;
              numberOfButtons += 1;
            }
          }

          if (!isItemSupportBuy && item.isSupportBuy) {
            isItemSupportBuy = true;
            numberOfButtons += 1;
          }
          if (isItemSupportStaking && isItemSupportBuy) {
            break;
          }
        }
        switch (numberOfButtons) {
          case 3:
            return 180;
          case 2:
            return 120;
          default:
            return 60;
        }
      }
    }
    return 0;
  }, [gtMd, listData]);

  const columns = useMemo(
    () =>
      gtMd
        ? ([
            {
              title: '#',
              dataIndex: 'serialNumber',
              columnWidth: 40,
              render: (serialNumber: string) => (
                <SizableText
                  size="$bodyMd"
                  color="$textSubdued"
                  userSelect="none"
                >
                  {serialNumber ?? '-'}
                </SizableText>
              ),
              renderSkeleton: () => <Skeleton w="$4" h="$3" />,
            },
            {
              title: intl.formatMessage({ id: ETranslations.global_name }),
              dataIndex: 'symbol',
              columnWidth: 140,
              render: (symbol: string, record: IMarketToken) => (
                <XStack gap="$3" ai="center">
                  <MarketTokenIcon uri={record.image} size="$8" />
                  <YStack width="$24">
                    <SizableText
                      size="$bodyLgMedium"
                      numberOfLines={1}
                      userSelect="none"
                    >
                      {symbol.toUpperCase()}
                    </SizableText>
                    <SizableText
                      size="$bodySm"
                      color="$textSubdued"
                      numberOfLines={1}
                      userSelect="none"
                    >
                      {record.name}
                    </SizableText>
                  </YStack>
                </XStack>
              ),
              renderSkeleton: () => (
                <XStack gap="$3">
                  <Skeleton w="$8" h="$8" radius="round" />
                  <YStack gap="$2">
                    <Skeleton w="$16" h="$3" />
                    <Skeleton w="$24" h="$3" />
                  </YStack>
                </XStack>
              ),
            },
            {
              title: '',
              dataIndex: 'trade',
              columnWidth: marketListTradeButtonWidth(),
              renderSkeleton: () => <Skeleton w="100%" h="$3" />,
              render: (_, record: IMarketToken) => (
                <MarketListTradeButton
                  isSupportBuy={record.isSupportBuy}
                  coinGeckoId={record.coingeckoId}
                  symbol={record.symbol}
                />
              ),
            },
            {
              title: intl.formatMessage({ id: ETranslations.global_price }),
              dataIndex: 'price',
              align: 'right',
              columnProps: {
                flexGrow: 1,
                flexBasis: 0,
              },
              render: (price: string, record: IMarketToken) => (
                <MarketTokenPrice
                  size="$bodyMd"
                  price={price}
                  tokenName={record.name}
                  tokenSymbol={record.symbol}
                  lastUpdated={record.lastUpdated}
                />
              ),
              renderSkeleton: () => <Skeleton w="$20" h="$3" />,
            },
            gtXl
              ? {
                  title: intl.formatMessage({
                    id: ETranslations.market_one_hour_percentage,
                  }),
                  align: 'right',
                  dataIndex: 'priceChangePercentage1H',
                  columnProps: {
                    flexGrow: 1,
                    flexBasis: 0,
                  },
                  render: (priceChangePercentage1H: string) => (
                    <PriceChangePercentage>
                      {priceChangePercentage1H}
                    </PriceChangePercentage>
                  ),
                  renderSkeleton: () => <Skeleton w="$10" h="$3" />,
                }
              : undefined,
            gt2Md
              ? {
                  title: intl.formatMessage({
                    id: ETranslations.market_twenty_four_hour_percentage,
                  }),
                  columnProps: {
                    flexGrow: 1,
                    flexBasis: 0,
                  },
                  align: 'right',
                  dataIndex: 'priceChangePercentage24H',
                  render: (priceChangePercentage24H: string) => (
                    <PriceChangePercentage>
                      {priceChangePercentage24H}
                    </PriceChangePercentage>
                  ),
                  renderSkeleton: () => <Skeleton w="$10" h="$3" />,
                }
              : undefined,
            gt2xl
              ? {
                  title: intl.formatMessage({
                    id: ETranslations.market_seven_day_percentage,
                  }),
                  align: 'right',
                  columnProps: {
                    flexGrow: 1,
                    flexBasis: 0,
                  },
                  dataIndex: 'priceChangePercentage7D',
                  render: (priceChangePercentage7D: string) => (
                    <PriceChangePercentage>
                      {priceChangePercentage7D}
                    </PriceChangePercentage>
                  ),
                  renderSkeleton: () => <Skeleton w="$10" h="$3" />,
                }
              : undefined,
            gtXl
              ? {
                  title: intl.formatMessage({
                    id: ETranslations.market_24h_vol_usd,
                  }),
                  dataIndex: 'totalVolume',
                  columnProps: {
                    flexGrow: 1,
                    flexBasis: 0,
                  },
                  align: 'right',
                  render: (totalVolume: string) => (
                    <NumberSizeableText
                      userSelect="none"
                      size="$bodyMd"
                      formatter="marketCap"
                      formatterOptions={{ currency }}
                    >
                      {totalVolume || '-'}
                    </NumberSizeableText>
                  ),
                  renderSkeleton: () => <Skeleton w="$20" h="$3" />,
                }
              : undefined,
            gtLg
              ? {
                  title: intl.formatMessage({
                    id: ETranslations.global_market_cap,
                  }),
                  dataIndex: 'marketCap',
                  columnProps: {
                    flexGrow: 1,
                    flexBasis: 0,
                  },
                  align: 'right',
                  render: (marketCap: string) => (
                    <NumberSizeableText
                      userSelect="none"
                      size="$bodyMd"
                      formatter="marketCap"
                      formatterOptions={{ currency }}
                    >
                      {marketCap || '-'}
                    </NumberSizeableText>
                  ),
                  renderSkeleton: () => <Skeleton w="$20" h="$3" />,
                }
              : undefined,
            gt2xl
              ? {
                  title: intl.formatMessage({
                    id: ETranslations.market_last_seven_days,
                  }),
                  dataIndex: 'sparkline',
                  columnProps: {
                    flexGrow: 1,
                    flexBasis: 0,
                    minWidth: 100,
                  },
                  align: 'right',
                  renderSkeleton: () => <Skeleton w="$20" h="$3" />,
                  render: (
                    sparkline: IMarketToken['sparkline'],
                    record: IMarketToken,
                  ) => (
                    <View>
                      <SparklineChart
                        data={sparkline}
                        width={100}
                        height={40}
                        lineColor={
                          record.priceChangePercentage7D &&
                          Number(record.priceChangePercentage7D) >= 0
                            ? lineColors[0]
                            : lineColors[1]
                        }
                        linearGradientColor={
                          record.priceChangePercentage7D &&
                          Number(record.priceChangePercentage7D) >= 0
                            ? colors[0]
                            : colors[1]
                        }
                      />
                    </View>
                  ),
                }
              : undefined,

            {
              title: '',
              dataIndex: 'action',
              columnWidth: 88,
              align: 'center',
              renderSkeleton: () => null,
              render: (_: unknown, record: IMarketToken) => (
                <XStack flex={1}>
                  <Stack flex={1} ai="center">
                    <MarketStar
                      key={record.coingeckoId}
                      coingeckoId={record.coingeckoId}
                      tabIndex={tabIndex}
                      from={EWatchlistFrom.catalog}
                    />
                  </Stack>
                  <Stack flex={1} ai="center">
                    <MarketMore
                      isSupportBuy={record.isSupportBuy}
                      showMoreAction={showMoreAction}
                      coingeckoId={record.coingeckoId}
                      symbol={record.symbol}
                    />
                  </Stack>
                </XStack>
              ),
            },
          ] as ITableProps<IMarketToken>['columns'])
        : [
            {
              title: '',
              dataIndex: 'serialNumber',
              columnProps: {
                flex: 1,
                width: undefined,
                px: 0,
              },
              render: (_: unknown, record: IMarketToken) =>
                renderMdItem(record),
              renderSkeleton: () => <TableMdSkeletonRow />,
            },
          ],
    [
      colors,
      currency,
      gt2Md,
      gt2xl,
      gtLg,
      gtMd,
      gtXl,
      intl,
      lineColors,
      marketListTradeButtonWidth,
      renderMdItem,
      showMoreAction,
      tabIndex,
    ],
  );

  const onRow = useCallback(
    (record: IMarketToken) => ({
      onPress: md ? undefined : () => toDetailPage(record),
    }),
    [md, toDetailPage],
  );

  const onHeaderRow = useCallback(
    (column: ITableColumn<IMarketToken>) => {
      if (['sparkline', 'action'].includes(column.dataIndex)) {
        return undefined;
      }
      return {
        onSortTypeChange: (order: 'asc' | 'desc' | undefined) => {
          handleSortTypeChange?.({
            columnName: column.dataIndex,
            order,
          });
        },
      };
    },
    [handleSortTypeChange],
  );

  const rowProps = useMemo(() => {
    if (gtMd) {
      return ROW_PROPS;
    }
    return platformEnv.isNativeAndroid
      ? {
          width: screenWidth,
        }
      : undefined;
  }, [gtMd, screenWidth]);

  if (platformEnv.isNativeAndroid && !sortedListData?.length) {
    return (
      <YStack flex={1} ai="center" jc="center">
        <Spinner size="large" />
      </YStack>
    );
  }

  return (
    <>
      {gtMd ? undefined : (
        <YStack
          px="$5"
          borderBottomWidth={StyleSheet.hairlineWidth}
          borderBottomColor="$borderSubdued"
        >
          <XStack h="$11" ai="center" justifyContent="space-between">
            <Select
              items={selectOptions}
              title={intl.formatMessage({ id: ETranslations.market_sort_by })}
              value={mdSortByType}
              onChange={handleMdSortByTypeChange}
              renderTrigger={renderSelectTrigger}
            />
            {/* <Popover
              title="Settings"
              renderTrigger={
                <IconButton
                  icon="SliderVerOutline"
                  color="$iconSubdued"
                  size="small"
                  variant="tertiary"
                  iconSize="$5"
                />
              }
              renderContent={
                <PopoverSettingsContent
                  dataDisplay={mdColumnKeys[0]}
                  priceChange={mdColumnKeys[1]}
                  onConfirm={handleSettingsContentChange}
                />
              }
            /> */}
          </XStack>
        </YStack>
      )}

      <YStack flex={1} ref={containerRef} $gtMd={{ pt: '$3' }}>
        <Table
          headerRowProps={HEADER_ROW_PROPS}
          showBackToTopButton
          stickyHeaderHiddenOnScroll
          onRow={onRow}
          onHeaderRow={onHeaderRow}
          rowProps={rowProps}
          showHeader={gtMd}
          columns={columns}
          dataSource={sortedListData as unknown as IMarketToken[]}
          TableFooterComponent={gtMd ? <Stack height={60} /> : undefined}
          extraData={gtMd ? undefined : mdColumnKeys}
          TableEmptyComponent={
            platformEnv.isNativeAndroid ? null : (
              <ListEmptyComponent columns={columns} />
            )
          }
        />
      </YStack>
    </>
  );
}

export const MarketHomeList = memo(BasicMarketHomeList);
