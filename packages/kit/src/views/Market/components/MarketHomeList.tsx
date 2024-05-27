import type { PropsWithChildren, ReactElement } from 'react';
import { useCallback, useMemo, useRef, useState } from 'react';

import type { IActionListItemProps, IStackProps } from '@onekeyhq/components';
import {
  ActionList,
  Button,
  Icon,
  IconButton,
  Image,
  ListView,
  NumberSizeableText,
  Popover,
  Select,
  SizableText,
  XStack,
  YStack,
  useMedia,
  usePopoverContext,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import {
  EModalRoutes,
  EModalSwapRoutes,
  ETabMarketRoutes,
} from '@onekeyhq/shared/src/routes';
import type {
  IMarketCategory,
  IMarketToken,
} from '@onekeyhq/shared/types/market';

import { listItemPressStyle } from '../../../components/ListItem';
import useAppNavigation from '../../../hooks/useAppNavigation';

import { MarketMore } from './MarketMore';
import { MarketStar } from './MarketStar';
import { PriceChangePercentage } from './PriceChangePercentage';
import SparklineChart from './SparklineChart';
import { ToggleButton } from './ToggleButton';
import { useWatchListAction } from './wachListHooks';

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
  return (
    <XStack
      key={name}
      testID={`list-column-${name}`}
      jc={jc}
      alignItems="center"
      width={width}
      onPress={handlePress}
      {...props}
    >
      {typeof children === 'string' ? (
        <SizableText
          cursor={cursor}
          color="$textSubdued"
          size="$bodySmMedium"
          selectable={false}
        >
          {children}
        </SizableText>
      ) : (
        children
      )}
      {showSortIcon ? (
        <Icon
          cursor={cursor}
          name={
            order === 'desc'
              ? 'ChevronDownSmallOutline'
              : 'ChevronTopSmallOutline'
          }
          color="$iconSubdued"
          size="$5"
        />
      ) : null}
    </XStack>
  );
}

type ITableColumnConfig = Record<
  string,
  (item: IMarketToken) => ReactElement | string
>;

const useBuildTableHeaderConfig = () =>
  ({
    'serialNumber': () => '#',
    'name': () => 'Name',
    'price': () => 'Price',
    'priceChangePercentage1H': () => '1h%',
    'priceChangePercentage24H': () => '24h%',
    'priceChangePercentage7D': () => '7d%',
    'totalVolume': () => '24h volume',
    'marketCap': () => 'Market cap',
    'sparkline': () => 'Last 7 days',
  } as ITableColumnConfig);

const useBuildTableRowConfig = (showMoreAction = false) => {
  const navigation = useAppNavigation();
  return useMemo(() => {
    const tableRowConfig: ITableColumnConfig = {
      'serialNumber': (item) => (
        <SizableText size="$bodyMd" color="$textSubdued">
          {item.serialNumber}
        </SizableText>
      ),
      'name': (item) => (
        <XStack space="$3" ai="center">
          <Image
            src={decodeURIComponent(item.image)}
            size="$8"
            borderRadius="$full"
          />
          <YStack width="$20">
            <SizableText size="$bodyLgMedium">
              {item.symbol.toUpperCase()}
            </SizableText>
            <SizableText size="$bodySm" color="$textSubdued">
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
          size="$bodyMd"
          formatter="price"
          formatterOptions={{ currency: '$' }}
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
          size="$bodyMd"
          formatter="marketCap"
          formatterOptions={{ currency: '$' }}
        >
          {item.totalVolume}
        </NumberSizeableText>
      ),
      'marketCap': (item) => (
        <NumberSizeableText
          size="$bodyMd"
          formatter="marketCap"
          formatterOptions={{ currency: '$' }}
        >
          {item.marketCap}
        </NumberSizeableText>
      ),
      'sparkline': (item) => (
        <SparklineChart
          data={item.sparkline}
          width={144}
          height={40}
          lineColor={
            item.priceChangePercentage24H &&
            Number(item.priceChangePercentage24H) >= 0
              ? '#33C641'
              : '#FF6259'
          }
          linearGradientColor={
            item.priceChangePercentage24H &&
            Number(item.priceChangePercentage24H) >= 0
              ? 'rgba(0, 184, 18, 0.2)'
              : 'rgba(255, 98, 89, 0.2)'
          }
        />
      ),
      'actions': (item) => (
        <XStack>
          <MarketStar coingeckoId={item.coingeckoId} />
          {showMoreAction ? (
            <MarketMore coingeckoId={item.coingeckoId} />
          ) : null}
        </XStack>
      ),
    };
    return tableRowConfig;
  }, [showMoreAction]);
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
}: {
  item?: IMarketToken;
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
}) {
  const {
    serialNumber,
    name,
    price,
    priceChangePercentage1H,
    priceChangePercentage24H,
    priceChangePercentage7D,
    totalVolume,
    marketCap,
    sparkline,
    actions,
  } = tableConfig;
  const { gtLg } = useMedia();
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
      px="$5"
      minHeight={minHeight}
      onPress={handlePress}
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
        {serialNumber?.(item)}
      </Column>
      <Column
        name="name"
        alignLeft
        width={140}
        sortType={sortType?.columnName}
        order={sortType?.order}
        onPress={handleColumnPress}
        cursor={cursor}
      >
        {name?.(item)}
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
        {price?.(item)}
      </Column>
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
        {priceChangePercentage1H?.(item)}
      </Column>
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
        {priceChangePercentage24H?.(item)}
      </Column>
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
        {priceChangePercentage7D?.(item)}
      </Column>
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
        {totalVolume?.(item)}
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
        {marketCap?.(item)}
      </Column>
      {gtLg ? (
        <Column
          minWidth={160}
          name="sparkline"
          alignRight
          pl="$4"
          sortType={sortType?.columnName}
          order={sortType?.order}
          onPress={handleColumnPress}
          cursor={cursor}
        >
          {sparkline?.(item)}
        </Column>
      ) : null}
      <Column
        name="action"
        width={showMoreAction ? 88 : 64}
        jc="center"
        px="$3"
        onPress={handleColumnPress}
        cursor={cursor}
      >
        {actions?.(item)}
      </Column>
    </XStack>
  );
}

function PopoverSettingsContent({
  dataDisplay: defaultDataDisplay,
  priceChange: defaultPriceChange,
  onConfirm,
}: {
  dataDisplay: IKeyOfMarketToken;
  priceChange: IKeyOfMarketToken;
  onConfirm: (value: {
    dataDisplay: IKeyOfMarketToken;
    priceChange: IKeyOfMarketToken;
  }) => void;
}) {
  const { closePopover } = usePopoverContext();
  const [dataDisplay, setDataDisplay] = useState(defaultDataDisplay);
  const [priceChange, setPriceChange] = useState(defaultPriceChange);
  return (
    <YStack px="$5" space="$5">
      <ToggleButton
        title="Data Display"
        value={dataDisplay}
        onChange={setDataDisplay as (v: string) => void}
        options={[
          {
            label: 'Price',
            value: 'price',
          },
          {
            label: '24h volume',
            value: 'totalVolume',
          },
          {
            label: 'Market Cap',
            value: 'marketCap',
          },
        ]}
      />
      <ToggleButton
        title="Price Change"
        value={priceChange}
        onChange={setPriceChange as (v: string) => void}
        options={[
          {
            label: '1 hour',
            value: 'priceChangePercentage1H',
          },
          {
            label: '24 hour',
            value: 'priceChangePercentage24H',
          },
          {
            label: '7 days',
            value: 'priceChangePercentage7D',
          },
        ]}
      />
      <Button
        my="$5"
        variant="primary"
        onPress={async () => {
          await closePopover?.();
          onConfirm({
            dataDisplay,
            priceChange,
          });
        }}
      >
        Confirm
      </Button>
    </YStack>
  );
}

type IKeyOfMarketToken = keyof IMarketToken;
export function MarketHomeList({
  category,
  showMoreAction = false,
}: {
  category: IMarketCategory;
  showMoreAction?: boolean;
}) {
  const navigation = useAppNavigation();

  const { result: listData } = usePromiseResult(
    async () =>
      backgroundApiProxy.serviceMarket.fetchCategory(
        category.categoryId,
        category.coingeckoIds,
        true,
      ),
    [category.categoryId, category.coingeckoIds],
  );

  const listDataRef = useRef<typeof listData | undefined>();

  if (!listDataRef.current && listData?.length) {
    listDataRef.current = listData;
  }

  const tableRowConfig = useBuildTableRowConfig(showMoreAction);

  const toDetailPage = useCallback(
    (item: IMarketToken) => {
      navigation.push(ETabMarketRoutes.MarketDetail, {
        coinGeckoId: item.coingeckoId,
        icon: item.image,
        symbol: item.symbol,
      });
    },
    [navigation],
  );

  const { gtMd } = useMedia();
  const [sortByType, setSortByType] = useState<{
    columnName: string;
    order: 'asc' | 'desc' | undefined;
  }>({
    columnName: 'default',
    order: 'desc',
  });

  const handleSortTypeChange = useCallback(
    (options: { columnName: string; order: 'asc' | 'desc' | undefined }) => {
      setSortByType(options);
    },
    [],
  );

  const tableHeaderConfig = useBuildTableHeaderConfig();
  const HeaderColumns = useMemo(
    () => (
      <TableRow
        showMoreAction={showMoreAction}
        tableConfig={tableHeaderConfig}
        minHeight="$4"
        sortType={sortByType}
        onSortTypeChange={handleSortTypeChange}
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
                      label: 'Remove from Favorites',
                      onPress: () => {
                        actions.removeFormWatchList(coingeckoId);
                      },
                    },
                    showMoreAction && {
                      icon: 'ArrowTopOutline',
                      label: 'Move to Top',
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
                      label: 'Add to Favorites',
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
    [actions, showMoreAction],
  );

  const renderMdItem = useCallback(
    ({ item }: { item: IMarketToken }) => (
      <XStack
        px="$5"
        height={60}
        justifyContent="space-between"
        onPress={() => toDetailPage(item)}
        onLongPress={() => handleMdItemAction(item)}
        {...listItemPressStyle}
      >
        <XStack space="$3" ai="center">
          <Image
            src={decodeURIComponent(item.image)}
            size="$10"
            borderRadius="$full"
          />
          <YStack>
            <SizableText size="$bodyLgMedium">
              {item.symbol.toUpperCase()}
            </SizableText>
            <SizableText size="$bodySm" color="$textSubdued">
              {`VOL `}
              <NumberSizeableText
                size="$bodySm"
                formatter="marketCap"
                color="$textSubdued"
                formatterOptions={{ currency: '$' }}
              >
                {item.totalVolume}
              </NumberSizeableText>
            </SizableText>
          </YStack>
        </XStack>
        <XStack ai="center" space="$5" flexShrink={1}>
          <NumberSizeableText
            flexShrink={1}
            numberOfLines={1}
            size="$bodyLgMedium"
            formatter={mdColumnKeys[0] === 'price' ? 'price' : 'marketCap'}
            formatterOptions={{ currency: '$' }}
          >
            {item[mdColumnKeys[0]] as string}
          </NumberSizeableText>
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
              size="$bodyMdMedium"
              color="white"
              formatter="priceChange"
            >
              {item[mdColumnKeys[1]] as string}
            </NumberSizeableText>
          </XStack>
        </XStack>
      </XStack>
    ),
    [handleMdItemAction, mdColumnKeys, toDetailPage],
  );

  const renderSelectTrigger = useCallback(
    ({ label }: { label?: string }) => (
      <XStack ai="center" space="$1">
        <SizableText>{label}</SizableText>
        <Icon name="ChevronBottomSolid" size="$4" />
      </XStack>
    ),
    [],
  );

  const handleSettingsContentChange = useCallback(
    ({
      dataDisplay,
      priceChange,
    }: {
      dataDisplay: IKeyOfMarketToken;
      priceChange: IKeyOfMarketToken;
    }) => {
      setMdColumnKeys([dataDisplay, priceChange]);
    },
    [],
  );

  const sortedListData = useMemo(() => {
    const columnValue =
      listDataRef.current?.[0]?.[sortByType.columnName as IKeyOfMarketToken];
    if (columnValue) {
      if (sortByType.order) {
        if (typeof columnValue === 'number')
          return listDataRef.current?.slice().sort((a, b) => {
            const numberA = a[
              sortByType.columnName as IKeyOfMarketToken
            ] as number;
            const numberB = b[
              sortByType.columnName as IKeyOfMarketToken
            ] as number;
            return sortByType.order === 'desc'
              ? numberB - numberA
              : numberA - numberB;
          });
        if (typeof columnValue === 'string') {
          return listDataRef.current?.slice().sort((a, b) => {
            const stringA = a[
              sortByType.columnName as IKeyOfMarketToken
            ] as string;
            const stringB = b[
              sortByType.columnName as IKeyOfMarketToken
            ] as string;
            return sortByType.order === 'desc'
              ? stringA.charCodeAt(0) - stringB.charCodeAt(0)
              : stringB.charCodeAt(0) - stringA.charCodeAt(0);
          });
        }
        return listData;
      }
    }

    return listData;
  }, [listData, sortByType.columnName, sortByType.order]);

  const [mdSortByType, setMdSortByType] = useState<string | undefined>();
  const selectOptions = useMemo(
    () => [
      {
        label: 'Last price',
        value: 'last_price',
        options: { columnName: 'price', order: 'desc' },
      },
      {
        label: 'Most 24h volume',
        value: 'Most 24h volume',
        options: { columnName: 'totalVolume', order: 'desc' },
      },
      {
        label: 'Most market cap',
        value: 'Most market cap',
        options: { columnName: 'marketCap', order: 'desc' },
      },
      {
        label: 'Price change up',
        value: 'Price change up',
        options: { columnName: mdColumnKeys[1], order: 'desc' },
      },
      {
        label: 'Price change down',
        value: 'Price change down',
        options: { columnName: mdColumnKeys[1], order: 'desc' },
      },
    ],
    [mdColumnKeys],
  );

  const handleMdSortByTypeChange = useCallback(
    (value: string) => {
      setMdSortByType(value);
      const item = selectOptions.find((v) => v.value === value);
      if (item?.options) {
        setSortByType(item?.options as typeof sortByType);
      }
    },
    [selectOptions],
  );

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
                title="Sort by"
                value={mdSortByType}
                onChange={handleMdSortByTypeChange}
                renderTrigger={renderSelectTrigger}
              />
            </XStack>
            <Popover
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
            />
          </XStack>
        </YStack>
      )}

      <YStack flex={1} py="$3">
        {gtMd ? HeaderColumns : undefined}
        <ListView
          stickyHeaderHiddenOnScroll
          estimatedItemSize={60}
          data={sortedListData}
          renderItem={gtMd ? renderItem : renderMdItem}
        />
      </YStack>
    </>
  );
}
