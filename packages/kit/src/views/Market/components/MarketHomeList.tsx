import type { PropsWithChildren, ReactElement } from 'react';
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
import { InteractionManager, StyleSheet } from 'react-native';
import { TouchableWithoutFeedback } from 'react-native-gesture-handler';

import type {
  IActionListItemProps,
  IListViewRef,
  IStackProps,
} from '@onekeyhq/components';
import {
  ActionList,
  Button,
  Icon,
  IconButton,
  ListView,
  NumberSizeableText,
  Select,
  SizableText,
  Skeleton,
  Spinner,
  Stack,
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
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ETabMarketRoutes } from '@onekeyhq/shared/src/routes';
import type {
  IMarketCategory,
  IMarketToken,
} from '@onekeyhq/shared/types/market';

import { listItemPressStyle } from '../../../components/ListItem';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { useThemeVariant } from '../../../hooks/useThemeVariant';

import { MarketMore } from './MarketMore';
import { MarketStar } from './MarketStar';
import { MarketTokenIcon } from './MarketTokenIcon';
import { PriceChangePercentage } from './PriceChangePercentage';
import SparklineChart from './SparklineChart';
import { ToggleButton } from './ToggleButton';
import { useSortType } from './useSortType';
import { useWatchListAction } from './wachListHooks';

import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';

function Column({
  alignLeft,
  alignRight,
  children,
  width,
  sortType,
  order,
  onPress,
  cursor,
  name,
  ...props
}: PropsWithChildren<
  {
    name: string;
    sortType?: string;
    alignLeft?: boolean;
    alignRight?: boolean;
    order?: 'asc' | 'desc' | undefined;
    onPress?: (key: string) => void;
  } & Omit<IStackProps, 'onPress'>
>) {
  const jc = useMemo(() => {
    if (alignLeft) {
      return 'flex-start';
    }
    if (alignRight) {
      return 'flex-end';
    }
  }, [alignLeft, alignRight]);
  const showSortIcon = sortType === name && order;
  const handlePress = useCallback(() => {
    onPress?.(name);
  }, [name, onPress]);

  const renderSortIcon = useCallback(() => {
    if (showSortIcon) {
      return (
        <Icon
          cursor={cursor}
          name={
            order === 'desc'
              ? 'ChevronDownSmallOutline'
              : 'ChevronTopSmallOutline'
          }
          color="$iconSubdued"
          size="$4"
        />
      );
    }
    return null;
  }, [cursor, order, showSortIcon]);
  return (
    <XStack
      key={name}
      testID={`list-column-${name}`}
      jc={jc}
      ai="center"
      alignItems="center"
      width={width}
      onPress={handlePress}
      {...props}
    >
      {jc === 'flex-end' ? renderSortIcon() : null}
      {typeof children === 'string' ? (
        <SizableText cursor={cursor} color="$textSubdued" size="$bodySmMedium">
          {children}
        </SizableText>
      ) : (
        children
      )}
      {jc === 'flex-start' ? renderSortIcon() : null}
    </XStack>
  );
}

type ITableColumnConfig = Record<
  string,
  (item: IMarketToken) => ReactElement | string
>;

const lineColorMap = {
  light: ['rgba(0, 113, 63)', 'rgba(196, 0, 6)'],
  dark: ['rgba(70, 254, 165)', 'rgba(255, 149, 146)'],
};
const colorMap = {
  light: ['rgba(0, 113, 63, 0.2)', 'rgba(196, 0, 6, 0.2)'],
  dark: ['rgba(70, 254, 165, 0.2)', 'rgba(255, 149, 146, 0.2)'],
};
const useBuildTableRowConfig = (showMoreAction = false, tabIndex = 0) => {
  // const navigation = useAppNavigation();
  const [settings] = useSettingsPersistAtom();
  const currency = settings.currencyInfo.symbol;
  const theme = useThemeVariant();
  const lineColors = lineColorMap[theme];
  const colors = colorMap[theme];
  return useMemo(() => {
    const tableRowConfig: ITableColumnConfig = {
      'serialNumber': (item) => (
        <SizableText size="$bodyMd" color="$textSubdued" selectable={false}>
          {item.serialNumber ?? '-'}
        </SizableText>
      ),
      'symbol': (item) => (
        <XStack space="$3" ai="center">
          <MarketTokenIcon uri={item.image} size="$8" />
          <YStack width="$24">
            <SizableText
              size="$bodyLgMedium"
              numberOfLines={1}
              selectable={false}
            >
              {item.symbol.toUpperCase()}
            </SizableText>
            <SizableText
              size="$bodySm"
              color="$textSubdued"
              numberOfLines={1}
              selectable={false}
            >
              {item.name}
            </SizableText>
          </YStack>
          {/* <Button
            size="small"
            onPress={async () => {
              console.log('----log', item);
              const response =
                await backgroundApiProxy.serviceMarket.fetchPools(
                  item.symbol,
                  item.symbol,
                );

              navigation.pushModal(EModalRoutes.SwapModal, {
                screen: EModalSwapRoutes.SwapMainLand,
                params: {
                  importNetworkId: networkId,
                  importFromToken: {
                    contractAddress: tokenInfo.address,
                    symbol: tokenInfo.symbol,
                    networkId,
                    isNative: tokenInfo.isNative,
                    decimals: tokenInfo.decimals,
                    name: tokenInfo.name,
                    logoURI: tokenInfo.logoURI,
                    networkLogoURI: network?.logoURI,
                  },
                },
              });
            }}
          >
            Swap
          </Button> */}
        </XStack>
      ),
      'price': (item) => (
        <NumberSizeableText
          selectable={false}
          size="$bodyMd"
          formatter="price"
          formatterOptions={{ currency }}
        >
          {item.price}
        </NumberSizeableText>
      ),
      'priceChangePercentage1H': (item) => (
        <PriceChangePercentage>
          {item.priceChangePercentage1H}
        </PriceChangePercentage>
      ),
      'priceChangePercentage24H': (item) => (
        <PriceChangePercentage>
          {item.priceChangePercentage24H}
        </PriceChangePercentage>
      ),
      'priceChangePercentage7D': (item) => (
        <PriceChangePercentage>
          {item.priceChangePercentage7D}
        </PriceChangePercentage>
      ),
      'totalVolume': (item) => (
        <NumberSizeableText
          selectable={false}
          size="$bodyMd"
          formatter="marketCap"
          formatterOptions={{ currency }}
        >
          {item.totalVolume}
        </NumberSizeableText>
      ),
      'marketCap': (item) => (
        <NumberSizeableText
          selectable={false}
          size="$bodyMd"
          formatter="marketCap"
          formatterOptions={{ currency }}
        >
          {item.marketCap}
        </NumberSizeableText>
      ),
      'sparkline': (item) => (
        <View>
          <SparklineChart
            data={item.sparkline}
            width={100}
            height={40}
            lineColor={
              item.priceChangePercentage7D &&
              Number(item.priceChangePercentage7D) >= 0
                ? lineColors[0]
                : lineColors[1]
            }
            linearGradientColor={
              item.priceChangePercentage7D &&
              Number(item.priceChangePercentage7D) >= 0
                ? colors[0]
                : colors[1]
            }
          />
        </View>
      ),
      'actions': (item) => (
        <XStack flex={1}>
          <Stack flex={1} ai="center">
            <MarketStar
              key={item.coingeckoId}
              coingeckoId={item.coingeckoId}
              tabIndex={tabIndex}
            />
          </Stack>
          {showMoreAction ? (
            <Stack flex={1} ai="center">
              <MarketMore coingeckoId={item.coingeckoId} />
            </Stack>
          ) : null}
        </XStack>
      ),
    };
    return tableRowConfig;
  }, [colors, currency, lineColors, showMoreAction, tabIndex]);
};

function TableRow({
  item = {} as IMarketToken,
  tableConfig,
  minHeight = 60,
  onPress,
  sortType,
  onSortTypeChange,
  showMoreAction = false,
  showListItemPressStyle = false,
  isLoading,
  py,
}: {
  item?: IMarketToken;
  isLoading?: boolean;
  tableConfig: ITableColumnConfig;
  minHeight?: IStackProps['height'];
  onPress?: (item: IMarketToken) => void;
  sortType?: { columnName: string; order: 'asc' | 'desc' | undefined };
  onSortTypeChange?: (options: {
    columnName: string;
    order: 'asc' | 'desc' | undefined;
  }) => void;
  showMoreAction?: boolean;
  showListItemPressStyle?: boolean;
  py?: IStackProps['py'];
}) {
  const {
    serialNumber,
    symbol,
    price,
    priceChangePercentage1H,
    priceChangePercentage24H,
    priceChangePercentage7D,
    totalVolume,
    marketCap,
    sparkline,
    actions,
  } = tableConfig;
  const { gtLg, gtXl } = useMedia();
  const handlePress = useCallback(() => {
    onPress?.(item);
  }, [item, onPress]);
  const useSortFunc = !!(sortType || onSortTypeChange);
  const handleColumnPress = useCallback(
    (key: string) => {
      if (!useSortFunc) {
        return;
      }
      if (key === sortType?.columnName) {
        let order: 'asc' | 'desc' | undefined = 'desc';
        if (sortType?.order === 'desc') {
          order = 'asc';
        } else if (sortType?.order === 'asc') {
          order = undefined;
        }
        onSortTypeChange?.({
          columnName: key,
          order,
        });
        return;
      }
      onSortTypeChange?.({
        columnName: key,
        order: 'desc',
      });
    },
    [onSortTypeChange, sortType?.columnName, sortType?.order, useSortFunc],
  );
  const cursor = useSortFunc ? 'pointer' : undefined;
  return (
    <XStack
      space="$3"
      px="$3"
      mx="$2"
      py={py}
      minHeight={minHeight}
      onPress={handlePress}
      borderRadius="$3"
      {...(showListItemPressStyle && listItemPressStyle)}
    >
      <Column
        name="serialNumber"
        alignLeft
        width={40}
        sortType={sortType?.columnName}
        order={sortType?.order}
        onPress={handleColumnPress}
        cursor={cursor}
      >
        {isLoading ? <Skeleton w="$4" h="$3" /> : serialNumber?.(item)}
      </Column>
      <Column
        name="symbol"
        alignLeft
        width={140}
        sortType={sortType?.columnName}
        order={sortType?.order}
        onPress={handleColumnPress}
        cursor={cursor}
      >
        {isLoading ? (
          <XStack space="$3">
            <Skeleton w="$8" h="$8" radius="round" />
            <YStack space="$2">
              <Skeleton w="$16" h="$3" />
              <Skeleton w="$24" h="$3" />
            </YStack>
          </XStack>
        ) : (
          symbol?.(item)
        )}
      </Column>
      <Column
        name="price"
        alignRight
        flexGrow={1}
        flexBasis={0}
        sortType={sortType?.columnName}
        order={sortType?.order}
        onPress={handleColumnPress}
        cursor={cursor}
      >
        {isLoading ? <Skeleton w="$20" h="$3" /> : price?.(item)}
      </Column>
      {gtLg ? (
        <Column
          name="priceChangePercentage1H"
          alignRight
          flexGrow={1}
          flexBasis={0}
          sortType={sortType?.columnName}
          order={sortType?.order}
          onPress={handleColumnPress}
          cursor={cursor}
        >
          {isLoading ? (
            <Skeleton w="$10" h="$3" />
          ) : (
            priceChangePercentage1H?.(item)
          )}
        </Column>
      ) : null}
      <Column
        name="priceChangePercentage24H"
        alignRight
        flexGrow={1}
        flexBasis={0}
        sortType={sortType?.columnName}
        order={sortType?.order}
        onPress={handleColumnPress}
        cursor={cursor}
      >
        {isLoading ? (
          <Skeleton w="$10" h="$3" />
        ) : (
          priceChangePercentage24H?.(item)
        )}
      </Column>
      {gtLg ? (
        <Column
          flexGrow={1}
          flexBasis={0}
          name="priceChangePercentage7D"
          alignRight
          sortType={sortType?.columnName}
          order={sortType?.order}
          onPress={handleColumnPress}
          cursor={cursor}
        >
          {isLoading ? (
            <Skeleton w="$10" h="$3" />
          ) : (
            priceChangePercentage7D?.(item)
          )}
        </Column>
      ) : null}
      <Column
        flexGrow={1}
        flexBasis={0}
        name="totalVolume"
        alignRight
        sortType={sortType?.columnName}
        order={sortType?.order}
        onPress={handleColumnPress}
        cursor={cursor}
      >
        {isLoading ? <Skeleton w="$20" h="$3" /> : totalVolume?.(item)}
      </Column>
      <Column
        flexGrow={1}
        flexBasis={0}
        name="marketCap"
        alignRight
        sortType={sortType?.columnName}
        order={sortType?.order}
        onPress={handleColumnPress}
        cursor={cursor}
      >
        {isLoading ? <Skeleton w="$20" h="$3" /> : marketCap?.(item)}
      </Column>
      {gtXl ? (
        <Column
          minWidth={100}
          flexGrow={1}
          flexBasis={0}
          name="sparkline"
          alignRight
          ml="$4"
          onPress={handleColumnPress}
        >
          {isLoading ? <Skeleton w="$20" h="$3" /> : sparkline?.(item)}
        </Column>
      ) : null}
      <Column
        name="action"
        width={showMoreAction ? 88 : 64}
        jc="center"
        onPress={handleColumnPress}
        cursor={cursor}
      >
        {isLoading ? null : actions?.(item)}
      </Column>
    </XStack>
  );
}

// function PopoverSettingsContent({
//   dataDisplay: defaultDataDisplay,
//   priceChange: defaultPriceChange,
//   onConfirm,
// }: {
//   dataDisplay: IKeyOfMarketToken;
//   priceChange: IKeyOfMarketToken;
//   onConfirm: (value: {
//     dataDisplay: IKeyOfMarketToken;
//     priceChange: IKeyOfMarketToken;
//   }) => void;
// }) {
//   const { closePopover } = usePopoverContext();
//   const [dataDisplay, setDataDisplay] = useState(defaultDataDisplay);
//   const [priceChange, setPriceChange] = useState(defaultPriceChange);
//   return (
//     <YStack px="$5" space="$5">
//       <ToggleButton
//         title="Data Display"
//         value={dataDisplay}
//         onChange={setDataDisplay as (v: string) => void}
//         options={[
//           {
//             label: 'Price',
//             value: 'price',
//           },
//           {
//             label: '24h volume',
//             value: 'totalVolume',
//           },
//           {
//             label: 'Market Cap',
//             value: 'marketCap',
//           },
//         ]}
//       />
//       <ToggleButton
//         title="Price Change"
//         value={priceChange}
//         onChange={setPriceChange as (v: string) => void}
//         options={[
//           {
//             label: '1 hour',
//             value: 'priceChangePercentage1H',
//           },
//           {
//             label: '24 hour',
//             value: 'priceChangePercentage24H',
//           },
//           {
//             label: '7 days',
//             value: 'priceChangePercentage7D',
//           },
//         ]}
//       />
//       <Button
//         my="$5"
//         variant="primary"
//         onPress={async () => {
//           await closePopover?.();
//           onConfirm({
//             dataDisplay,
//             priceChange,
//           });
//         }}
//       >
//         Confirm
//       </Button>
//     </YStack>
//   );
// }

function TableMdSkeletonRow() {
  return (
    <XStack h={60} jc="space-between">
      <XStack space="$3" ai="center">
        <Skeleton w="$10" h="$10" radius="round" />
        <YStack space="$2">
          <Skeleton w="$16" h="$2.5" />
          <Skeleton w="$24" h="$2.5" />
        </YStack>
      </XStack>
      <XStack space="$5" ai="center">
        <Skeleton w="$16" h="$2.5" />
        <Skeleton w="$16" h="$2.5" />
      </XStack>
    </XStack>
  );
}

function ListEmptyComponent({ showMoreAction }: { showMoreAction: boolean }) {
  const { gtMd } = useMedia();
  if (platformEnv.isNativeAndroid) {
    return null;
  }
  return gtMd ? (
    <YStack>
      {new Array(6).fill(0).map((i) => (
        <TableRow
          key={i}
          isLoading
          showMoreAction={showMoreAction}
          tableConfig={{}}
          minHeight={52}
        />
      ))}
    </YStack>
  ) : (
    <YStack px="$5">
      {new Array(6).fill(0).map((_, index) => (
        <TableMdSkeletonRow key={index} />
      ))}
    </YStack>
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
  const fetchCategory = useCallback(async () => {
    const now = Date.now();
    if (now - updateAtRef.current > 45 * 1000) {
      const response = await backgroundApiProxy.serviceMarket.fetchCategory(
        category.categoryId,
        category.coingeckoIds,
        true,
      );
      void InteractionManager.runAfterInteractions(() => {
        setListData(response);
      });
    }
  }, [category.categoryId, category.coingeckoIds]);

  useEffect(() => {
    void fetchCategory();
  }, [fetchCategory]);

  const tableRowConfig = useBuildTableRowConfig(showMoreAction, tabIndex);

  const toDetailPage = useCallback(
    (item: IMarketToken) => {
      navigation.push(ETabMarketRoutes.MarketDetail, {
        coinGeckoId: item.coingeckoId,
        symbol: item.symbol,
      });
    },
    [navigation],
  );

  const { gtMd, md } = useMedia();

  const tableHeaderConfig = useMemo(
    () => ({
      'serialNumber': () => '#',
      'symbol': () => intl.formatMessage({ id: ETranslations.global_name }),
      'price': () => intl.formatMessage({ id: ETranslations.global_price }),
      'priceChangePercentage1H': () =>
        intl.formatMessage({ id: ETranslations.market_one_hour_percentage }),
      'priceChangePercentage24H': () =>
        intl.formatMessage({
          id: ETranslations.market_twenty_four_hour_percentage,
        }),
      'priceChangePercentage7D': () =>
        intl.formatMessage({ id: ETranslations.market_seven_day_percentage }),
      'totalVolume': () =>
        intl.formatMessage({
          id: ETranslations.market_twenty_four_hour_volume,
        }),
      'marketCap': () =>
        intl.formatMessage({ id: ETranslations.global_market_cap }),
      'sparkline': () =>
        intl.formatMessage({ id: ETranslations.market_last_seven_days }),
    }),
    [intl],
  );

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

  const HeaderColumns = useMemo(
    () => (
      <TableRow
        showMoreAction={showMoreAction}
        tableConfig={tableHeaderConfig}
        minHeight="$4"
        sortType={sortByType}
        onSortTypeChange={handleSortTypeChange}
        py="$2"
      />
    ),
    [handleSortTypeChange, showMoreAction, sortByType, tableHeaderConfig],
  );

  const renderItem = useCallback(
    ({ item }: any) => (
      <TableRow
        showListItemPressStyle
        showMoreAction={showMoreAction}
        tableConfig={tableRowConfig}
        item={item}
        minHeight={60}
        onPress={toDetailPage}
      />
    ),
    [showMoreAction, tableRowConfig, toDetailPage],
  );

  const [mdColumnKeys, setMdColumnKeys] = useState<IKeyOfMarketToken[]>([
    'price',
    'priceChangePercentage24H',
  ]);

  const actions = useWatchListAction();
  const handleMdItemAction = useCallback(
    async ({ coingeckoId, symbol }: IMarketToken) => {
      const isInWatchList = actions.isInWatchList(coingeckoId);
      const title = symbol.toUpperCase();
      ActionList.show(
        isInWatchList
          ? {
              title,
              sections: [
                {
                  items: [
                    {
                      destructive: true,
                      icon: 'DeleteOutline',
                      label: intl.formatMessage({
                        id: ETranslations.market_remove_from_watchlist,
                      }),
                      onPress: () => {
                        actions.removeFormWatchList(coingeckoId);
                      },
                    },
                    showMoreAction && {
                      icon: 'ArrowTopOutline',
                      label: intl.formatMessage({
                        id: ETranslations.market_move_to_top,
                      }),
                      onPress: () => {
                        actions.MoveToTop(coingeckoId);
                      },
                    },
                  ].filter(Boolean) as IActionListItemProps[],
                },
              ],
            }
          : {
              title,
              sections: [
                {
                  items: [
                    {
                      icon: 'StarOutline',

                      label: intl.formatMessage({
                        id: ETranslations.market_add_to_watchlist,
                      }),
                      onPress: () => {
                        actions.addIntoWatchList(coingeckoId);
                      },
                    },
                  ],
                },
              ],
            },
      );
    },
    [actions, intl, showMoreAction],
  );

  const [settings] = useSettingsPersistAtom();
  const currency = settings.currencyInfo.symbol;
  const renderMdItem = useCallback(
    ({ item }: { item: IMarketToken }) => {
      const pressEvents = {
        onPress: () => toDetailPage(item),
        onLongPress: () => handleMdItemAction(item),
      };
      return (
        <TouchableContainer
          {...(platformEnv.isNative ? undefined : pressEvents)}
        >
          <XStack
            px="$5"
            height={60}
            justifyContent="space-between"
            userSelect="none"
            {...listItemPressStyle}
            {...(platformEnv.isNative ? pressEvents : undefined)}
          >
            <XStack space="$3" ai="center">
              <MarketTokenIcon uri={item.image} size="$10" />
              <YStack>
                <SizableText size="$bodyLgMedium" selectable={false}>
                  {item.symbol.toUpperCase()}
                </SizableText>
                <SizableText
                  size="$bodySm"
                  color="$textSubdued"
                  selectable={false}
                >
                  {`VOL `}
                  <NumberSizeableText
                    selectable={false}
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
            <XStack ai="center" space="$5" flexShrink={1}>
              <NumberSizeableText
                selectable={false}
                flexShrink={1}
                numberOfLines={1}
                size="$bodyLgMedium"
                formatter={mdColumnKeys[0] === 'price' ? 'price' : 'marketCap'}
                formatterOptions={{ currency }}
              >
                {item[mdColumnKeys[0]] as string}
              </NumberSizeableText>
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
                    selectable={false}
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
    },
    [currency, handleMdItemAction, mdColumnKeys, toDetailPage],
  );

  const renderSelectTrigger = useCallback(
    ({ label }: { label?: string }) => (
      <XStack ai="center" space="$1">
        <SizableText size="$bodyMd" color="$textSubdued">
          {label}
        </SizableText>
        <Icon name="ChevronDownSmallSolid" size="$4" />
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

  const [isShowBackToTopButton, setIsShowBackToTopButton] = useState(false);
  const listViewRef = useRef<IListViewRef<unknown> | null>(null);
  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) =>
      setIsShowBackToTopButton(event.nativeEvent.contentOffset.y > 0),
    [],
  );

  const handleScrollToTop = useCallback(() => {
    if (listViewRef.current) {
      listViewRef.current?.scrollToOffset({ offset: 0, animated: true });
    }
  }, []);

  const onSwitchMarketHomeTabCallback = useCallback(
    ({ tabIndex: currentTabIndex }: { tabIndex: number }) => {
      setTimeout(() => {
        if (currentTabIndex !== tabIndex) {
          if (md) {
            handleMdSortByTypeChange('Default');
          }
        } else {
          void fetchCategory();
        }
      }, 10);
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
          borderBottomWidth="$px"
          borderBottomColor="$borderSubdued"
        >
          <XStack h="$11" ai="center" justifyContent="space-between">
            <XStack ai="center" space="$2">
              <Icon name="FilterSortOutline" color="$iconSubdued" size="$5" />
              <Select
                items={selectOptions}
                title={intl.formatMessage({ id: ETranslations.market_sort_by })}
                value={mdSortByType}
                onChange={handleMdSortByTypeChange}
                renderTrigger={renderSelectTrigger}
              />
            </XStack>
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

      <YStack flex={1} $gtMd={{ py: '$3' }}>
        {gtMd ? HeaderColumns : undefined}
        <ListView
          ref={listViewRef}
          stickyHeaderHiddenOnScroll
          estimatedItemSize={60}
          // @ts-ignore
          estimatedListSize={{ width: 370, height: 525 }}
          onScroll={handleScroll}
          scrollEventThrottle={100}
          data={sortedListData as unknown as IMarketToken[]}
          renderItem={gtMd ? renderItem : renderMdItem}
          ListFooterComponent={gtMd ? <Stack height={60} /> : undefined}
          ListEmptyComponent={
            <ListEmptyComponent showMoreAction={showMoreAction} />
          }
          extraData={gtMd ? undefined : mdColumnKeys}
        />
        {isShowBackToTopButton ? (
          <Stack
            position="absolute"
            bg="$bg"
            borderRadius="$full"
            bottom={gtMd ? '$8' : '$4'}
            right={gtMd ? '$8' : '$4'}
          >
            <IconButton
              title=""
              borderWidth={StyleSheet.hairlineWidth}
              borderColor="$transparent"
              iconColor="$icon"
              icon="AlignTopOutline"
              onPress={handleScrollToTop}
            />
          </Stack>
        ) : null}
      </YStack>
    </>
  );
}

export const MarketHomeList = memo(BasicMarketHomeList);
