import type { ReactElement } from 'react';
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
import { InteractionManager } from 'react-native';
import { TouchableWithoutFeedback } from 'react-native-gesture-handler';

import type {
  IActionListItemProps,
  IElement,
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

const lineColorMap = {
  light: ['rgba(0, 113, 63)', 'rgba(196, 0, 6)'],
  dark: ['rgba(70, 254, 165)', 'rgba(255, 149, 146)'],
};
const colorMap = {
  light: ['rgba(0, 113, 63, 0.2)', 'rgba(196, 0, 6, 0.2)'],
  dark: ['rgba(70, 254, 165, 0.2)', 'rgba(255, 149, 146, 0.2)'],
};

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

// function ListEmptyComponent({ showMoreAction }: { showMoreAction: boolean }) {
//   const { gtMd } = useMedia();
//   if (platformEnv.isNativeAndroid) {
//     return null;
//   }
//   return gtMd ? (
//     <YStack>
//       {new Array(6).fill(0).map((i) => (
//         <TableRow
//           key={i}
//           isLoading
//           showMoreAction={showMoreAction}
//           tableConfig={{}}
//         />
//       ))}
//     </YStack>
//   ) : (
//     <YStack px="$5">
//       {new Array(6).fill(0).map((_, index) => (
//         <TableMdSkeletonRow key={index} />
//       ))}
//     </YStack>
//   );
// }

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

  const toDetailPage = useCallback(
    (item: IMarketToken) => {
      navigation.push(ETabMarketRoutes.MarketDetail, {
        token: item.coingeckoId,
      });
    },
    [navigation],
  );

  const { gtMd, md } = useMedia();

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
    (item: IMarketToken) => {
      const pressEvents = {
        onPress: () => toDetailPage(item),
        onLongPress: () => handleMdItemAction(item),
      };
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
            space="$2"
            {...listItemPressStyle}
            {...(platformEnv.isNative ? pressEvents : undefined)}
          >
            <XStack space="$3" ai="center" flexShrink={1}>
              <MarketTokenIcon uri={item.image} size="$10" />
              <YStack flexShrink={1}>
                <SizableText
                  size="$bodyLgMedium"
                  selectable={false}
                  numberOfLines={1}
                  flexShrink={1}
                >
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
            <XStack ai="center" space="$5">
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

  const containerRef = useRef<IElement>(null);
  const onSwitchMarketHomeTabCallback = useCallback(
    ({ tabIndex: index }: { tabIndex: number }) => {
      setTimeout(
        () => {
          if (!platformEnv.isNative && containerRef) {
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
  const { gtLg, gtXl } = useMedia();

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
                  selectable={false}
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
                <XStack space="$3" ai="center">
                  <MarketTokenIcon uri={record.image} size="$8" />
                  <YStack width="$24">
                    <SizableText
                      size="$bodyLgMedium"
                      numberOfLines={1}
                      selectable={false}
                    >
                      {symbol.toUpperCase()}
                    </SizableText>
                    <SizableText
                      size="$bodySm"
                      color="$textSubdued"
                      numberOfLines={1}
                      selectable={false}
                    >
                      {record.name}
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
              renderSkeleton: () => (
                <XStack space="$3">
                  <Skeleton w="$8" h="$8" radius="round" />
                  <YStack space="$2">
                    <Skeleton w="$16" h="$3" />
                    <Skeleton w="$24" h="$3" />
                  </YStack>
                </XStack>
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
              render: (price: string) => (
                <NumberSizeableText
                  selectable={false}
                  size="$bodyMd"
                  formatter="price"
                  formatterOptions={{ currency }}
                >
                  {price}
                </NumberSizeableText>
              ),
              renderSkeleton: () => <Skeleton w="$20" h="$3" />,
            },
            gtLg
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
            {
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
            },
            gtLg
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
            {
              title: intl.formatMessage({
                id: ETranslations.market_seven_day_percentage,
              }),
              dataIndex: 'totalVolume',
              columnProps: {
                flexGrow: 1,
                flexBasis: 0,
              },
              align: 'right',
              render: (totalVolume: string) => (
                <NumberSizeableText
                  selectable={false}
                  size="$bodyMd"
                  formatter="marketCap"
                  formatterOptions={{ currency }}
                >
                  {totalVolume || '-'}
                </NumberSizeableText>
              ),
              renderSkeleton: () => <Skeleton w="$20" h="$3" />,
            },
            {
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
                  selectable={false}
                  size="$bodyMd"
                  formatter="marketCap"
                  formatterOptions={{ currency }}
                >
                  {marketCap || '-'}
                </NumberSizeableText>
              ),
              renderSkeleton: () => <Skeleton w="$20" h="$3" />,
            },
            gtXl
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
              columnWidth: showMoreAction ? 88 : 64,
              align: 'center',
              renderSkeleton: () => null,
              render: (_: unknown, record: IMarketToken) => (
                <XStack flex={1}>
                  <Stack flex={1} ai="center">
                    <MarketStar
                      key={record.coingeckoId}
                      coingeckoId={record.coingeckoId}
                      tabIndex={tabIndex}
                    />
                  </Stack>
                  {showMoreAction ? (
                    <Stack flex={1} ai="center">
                      <MarketMore coingeckoId={record.coingeckoId} />
                    </Stack>
                  ) : null}
                </XStack>
              ),
            },
          ].filter(Boolean) as ITableProps<IMarketToken>['columns'])
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
            },
          ],
    [
      colors,
      currency,
      gtLg,
      gtMd,
      gtXl,
      intl,
      lineColors,
      renderMdItem,
      showMoreAction,
      tabIndex,
    ],
  );

  const onRow = useCallback(
    (record: IMarketToken) => ({
      onPress: () => toDetailPage(record),
    }),
    [toDetailPage],
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

  const listEmptyComponent = useMemo(() => {
    if (platformEnv.isNativeAndroid) {
      return null;
    }
    if (gtMd) {
      const skeletonColumns = columns.map((i) => ({
        ...i,
        render: (i as unknown as { renderSkeleton: () => ReactElement })
          .renderSkeleton,
      }));
      return (
        <YStack>
          {new Array(6).fill(0).map((i) => (
            <Table.Row key={i} columns={skeletonColumns} index={i} item={{}} />
          ))}
        </YStack>
      );
    }
    return (
      <YStack px="$5">
        {new Array(6).fill(0).map((_, index) => (
          <TableMdSkeletonRow key={index} />
        ))}
      </YStack>
    );
  }, [columns, gtMd]);

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

      <YStack flex={1} ref={containerRef} $gtMd={{ pt: '$3' }}>
        <Table
          stickyHeaderHiddenOnScroll
          onRow={onRow}
          onHeaderRow={onHeaderRow}
          showHeader={gtMd}
          columns={columns}
          dataSource={sortedListData as unknown as IMarketToken[]}
          TableFooterComponent={gtMd ? <Stack height={60} /> : undefined}
          extraData={gtMd ? undefined : mdColumnKeys}
          TableEmptyComponent={listEmptyComponent}
        />
      </YStack>
    </>
  );
}

export const MarketHomeList = memo(BasicMarketHomeList);
