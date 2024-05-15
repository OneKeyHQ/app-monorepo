import type { PropsWithChildren, ReactElement } from 'react';
import { useCallback, useMemo } from 'react';

import type { IStackProps } from '@onekeyhq/components';
import { ListView, SizableText, XStack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';

import type { IMarketHomeListProps } from './type';

function Column({
  key,
  alignLeft = true,
  alignRight,
  children,
  width,
}: PropsWithChildren<{
  key: string;
  alignLeft?: boolean;
  alignRight?: boolean;
  width?: IStackProps['width'];
}>) {
  const jc = useMemo(() => {
    if (alignLeft) {
      return 'flex-start';
    }
    return alignRight ? 'flex-end' : undefined;
  }, [alignLeft, alignRight]);
  return (
    <XStack key={key} jc={jc} alignItems="center" width={width}>
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

type ITableColumnConfig = Record<
  string,
  (item: Record<string, string>) => ReactElement | string
>;

const TableHeaderConfig: ITableColumnConfig = {
  'no': () => '#',
  'name': () => 'Name',
  'price': () => 'Price',
  'r1h': () => '1h%',
  'r24h': () => '24h%',
  'r7d': () => '7d%',
  'r24hv': () => '24h volume',
  'marketCap': () => 'Market cap',
  'l7d': () => 'Last 7 days',
};

function TableRow({
  item = {},
  tableConfig,
  height = 60,
}: {
  item?: Record<string, string>;
  tableConfig: ITableColumnConfig;
  height?: IStackProps['height'];
}) {
  const { no, name, price, r1h, r24h, r7d, r24hv, marketCap, l7d } =
    tableConfig;
  return (
    <XStack space="$3" height={height}>
      <Column key="no" alignLeft width="$4">
        {no(item)}
      </Column>
      <Column key="name" alignLeft width={261}>
        {name(item)}
      </Column>
      <Column key="price" alignRight width={85}>
        {price(item)}
      </Column>
      <Column key="r1h" alignRight width={75}>
        {r1h(item)}
      </Column>
      <Column key="r24h" alignRight width={75}>
        {r24h(item)}
      </Column>
      <Column key="r7d" alignRight width={75}>
        {r7d(item)}
      </Column>
      <Column key="r24hv" alignRight width={75}>
        {r24hv(item)}
      </Column>
      <Column key="marketCap" alignRight width={75}>
        {marketCap(item)}
      </Column>
      <Column key="l7d" alignRight width={100}>
        {l7d(item)}
      </Column>
    </XStack>
  );
}

export function MarketHomeList({ category }: IMarketHomeListProps) {
  const Columns = useMemo(
    () => <TableRow tableConfig={TableHeaderConfig} height={16} />,
    [],
  );

  const { result: categories } = usePromiseResult(
    async () =>
      backgroundApiProxy.serviceMarket.fetchCategory(
        category.categoryId,
        category.coingeckoIds,
        true,
      ),
    [category.categoryId, category.coingeckoIds],
  );
  const renderItem = useCallback(
    ({ item }: any) => <TableRow tableConfig={TableHeaderConfig} item={item} />,
    [],
  );
  return (
    <ListView
      contentContainerStyle={{ flex: 1, px: '$6', py: '$3' }}
      ListHeaderComponent={Columns}
      estimatedItemSize={60}
      data={[
        {
          'no': 'no',
          'name': 'name',
          'price': 'price',
          'r1h': 'r1h',
          'r24h': 'r24h',
          'r7d': 'r7d',
          'r24hv': 'r24hv',
          'marketCap': 'marketCap',
          'l7d': 'l7d',
        },
      ]}
      renderItem={renderItem}
    />
  );
}
