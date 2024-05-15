import type { PropsWithChildren, ReactElement } from 'react';
import { useCallback, useMemo } from 'react';

import type {
  INumberSizeableTextProps,
  IStackProps,
} from '@onekeyhq/components';
import {
  Button,
  Icon,
  Image,
  ListView,
  NumberSizeableText,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import type { IMarketToken } from '@onekeyhq/shared/types/market';

import SparklineChart from './SparklineChart';

import type { IMarketHomeListProps } from './type';

function Column({
  key,
  alignLeft,
  alignRight,
  children,
  width,
  ...props
}: PropsWithChildren<
  {
    key: string;
    alignLeft?: boolean;
    alignRight?: boolean;
  } & IStackProps
>) {
  const jc = useMemo(() => {
    if (alignLeft) {
      return 'flex-start';
    }
    if (alignRight) {
      return 'flex-end';
    }
  }, [alignLeft, alignRight]);
  return (
    <XStack
      key={key}
      testID={`list-column-${key}`}
      jc={jc}
      alignItems="center"
      width={width}
      {...props}
    >
      {typeof children === 'string' ? (
        <SizableText color="$textSubdued" size="$bodySmMedium">
          {children}
        </SizableText>
      ) : (
        children
      )}
    </XStack>
  );
}

function PriceChangePercentage({ children }: INumberSizeableTextProps) {
  return (
    <NumberSizeableText
      size="$bodyMd"
      formatter="priceChange"
      color={Number(children) > 0 ? '$textSuccess' : '$textCritical'}
      formatterOptions={{ currency: '$' }}
    >
      {children}
    </NumberSizeableText>
  );
}

type ITableColumnConfig = Record<
  string,
  (item: IMarketToken) => ReactElement | string
>;

const TableHeaderConfig: ITableColumnConfig = {
  'serialNumber': () => '#',
  'name': () => 'Name',
  'price': () => 'Price',
  'priceChangePercentage1H': () => '1h%',
  'priceChangePercentage24H': () => '24h%',
  'priceChangePercentage7D': () => '7d%',
  'totalVolume': () => '24h volume',
  'marketCap': () => 'Market cap',
  'sparkline': () => 'Last 7 days',
};

const TableRowConfig: ITableColumnConfig = {
  'serialNumber': (item) => (
    <SizableText size="$bodyMd" color="$textSubdued">
      {item.serialNumber}
    </SizableText>
  ),
  'name': (item) => (
    <XStack space="$3" ai="center">
      <Image src={item.image} size="$8" borderRadius="100%" />
      <YStack width="$20">
        <SizableText size="$bodyLgMedium">{item.symbol}</SizableText>
        <SizableText size="$bodySm" color="$textSubdued">
          {item.name}
        </SizableText>
      </YStack>
      <Button size="small">Swap</Button>
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
      {item.priceChangePercentage24H}
    </PriceChangePercentage>
  ),
  'priceChangePercentage24H': (item) => (
    <PriceChangePercentage>
      {item.priceChangePercentage24H}
    </PriceChangePercentage>
  ),
  'priceChangePercentage7D': (item) => (
    <PriceChangePercentage>
      {item.priceChangePercentage24H}
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
      width={100}
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
    <XStack space="$6">
      <Icon name="StarOutline" size="$5" />
      <Icon name="DotVerSolid" size="$5" />
    </XStack>
  ),
};

function TableRow({
  item = {} as IMarketToken,
  tableConfig,
  minHeight = 60,
}: {
  item?: IMarketToken;
  tableConfig: ITableColumnConfig;
  minHeight?: IStackProps['height'];
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
  return (
    <XStack space="$3" minHeight={minHeight}>
      <Column key="serialNumber" alignLeft width={40}>
        {serialNumber?.(item)}
      </Column>
      <Column key="name" alignLeft width={261}>
        {name?.(item)}
      </Column>
      <Column key="price" alignRight width={85}>
        {price?.(item)}
      </Column>
      <Column key="priceChangePercentage1H" alignRight width={75}>
        {priceChangePercentage1H?.(item)}
      </Column>
      <Column key="priceChangePercentage24H" alignRight width={75}>
        {priceChangePercentage24H?.(item)}
      </Column>
      <Column key="priceChangePercentage7D" alignRight width={75}>
        {priceChangePercentage7D?.(item)}
      </Column>
      <Column key="totalVolume" alignRight width={75}>
        {totalVolume?.(item)}
      </Column>
      <Column key="marketCap" alignRight width={75}>
        {marketCap?.(item)}
      </Column>
      <Column key="sparkline" alignRight width={100} pl="$2">
        {sparkline?.(item)}
      </Column>
      <Column key="action" alignLeft width={200} pl="$4">
        {actions?.(item)}
      </Column>
    </XStack>
  );
}

export function MarketHomeList({ category }: IMarketHomeListProps) {
  const HeaderColumns = useMemo(
    () => <TableRow tableConfig={TableHeaderConfig} minHeight={16} />,
    [],
  );

  const { result: listData } = usePromiseResult(
    async () =>
      backgroundApiProxy.serviceMarket.fetchCategory(
        category.categoryId,
        category.coingeckoIds,
        true,
      ),
    [category.categoryId, category.coingeckoIds],
  );
  const renderItem = useCallback(
    ({ item }: any) => (
      <TableRow tableConfig={TableRowConfig} item={item} minHeight={60} />
    ),
    [],
  );
  return (
    <YStack flex={1} px="$6" py="$3">
      {HeaderColumns}
      <ListView
        stickyHeaderHiddenOnScroll
        estimatedItemSize={60}
        data={listData}
        renderItem={renderItem}
      />
    </YStack>
  );
}
