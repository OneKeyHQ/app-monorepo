import { useCallback, useLayoutEffect, useRef, useState } from 'react';

import type { IListViewRef } from '@onekeyhq/components';
import {
  Button,
  Divider,
  ListView,
  SizableText,
  XStack,
} from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import {
  CommonTableListView,
  type IColumnConfig,
} from '@onekeyhq/kit/src/views/Perp/components/OrderInfoPanel/List/CommonTableListView';

import ListPerformance from './ListPerformance';
import { Layout } from './utils/Layout';

// read it before you use it.
// https://shopify.github.io/flash-list/docs/fundamentals/performant-components
const listData = new Array(100).fill(0).map((_, index) => index);

// 模拟数据 - 8个数据项
const mockData = [
  {
    id: 1,
    name: 'BTC/USDT',
    price: '45,230.50',
    change: '+2.5%',
    volume: '1,234,567',
    marketCap: '850.2B',
    high24h: '46,100.00',
    low24h: '44,800.00',
    status: 'active',
  },
  {
    id: 2,
    name: 'ETH/USDT',
    price: '3,120.80',
    change: '-1.2%',
    volume: '987,654',
    marketCap: '375.1B',
    high24h: '3,180.00',
    low24h: '3,090.00',
    status: 'active',
  },
  {
    id: 3,
    name: 'BNB/USDT',
    price: '315.45',
    change: '+0.8%',
    volume: '456,789',
    marketCap: '48.5B',
    high24h: '320.00',
    low24h: '310.00',
    status: 'active',
  },
  {
    id: 4,
    name: 'ADA/USDT',
    price: '0.485',
    change: '+3.2%',
    volume: '234,567',
    marketCap: '17.2B',
    high24h: '0.495',
    low24h: '0.470',
    status: 'active',
  },
  {
    id: 5,
    name: 'SOL/USDT',
    price: '98.75',
    change: '-0.5%',
    volume: '345,678',
    marketCap: '42.8B',
    high24h: '100.50',
    low24h: '97.20',
    status: 'active',
  },
  {
    id: 6,
    name: 'DOT/USDT',
    price: '7.85',
    change: '+1.8%',
    volume: '123,456',
    marketCap: '9.8B',
    high24h: '8.00',
    low24h: '7.70',
    status: 'active',
  },
  {
    id: 7,
    name: 'MATIC/USDT',
    price: '0.925',
    change: '+2.1%',
    volume: '178,234',
    marketCap: '8.9B',
    high24h: '0.940',
    low24h: '0.905',
    status: 'active',
  },
  {
    id: 8,
    name: 'AVAX/USDT',
    price: '28.45',
    change: '-0.8%',
    volume: '267,890',
    marketCap: '10.7B',
    high24h: '29.20',
    low24h: '28.10',
    status: 'active',
  },
];

// 列配置
const COLUMNS: IColumnConfig[] = [
  // 前3项固定宽度
  { key: 'name', title: 'Symbol', width: 120 },
  { key: 'price', title: 'Price', width: 100 },
  { key: 'change', title: 'Change', width: 80 },
  // 4-7项可变宽度但有最小宽度 - 增加最小宽度让内容更易读
  { key: 'volume', title: 'Volume', minWidth: 120 },
  { key: 'marketCap', title: 'Market Cap', minWidth: 120 },
  { key: 'high24h', title: '24h High', minWidth: 110 },
  { key: 'low24h', title: '24h Low', minWidth: 110 },
  // 第8项固定宽度
  { key: 'actions', title: 'Actions', width: 120 },
];
const ListViewDemo = () => {
  const ref = useRef<IListViewRef<any> | null>(null);
  return (
    <ListView
      useFlashList
      h="$60"
      maxHeight="$60"
      estimatedItemSize="$10"
      contentContainerStyle={{
        bg: '$borderLight',
        p: '$4',
      }}
      ListHeaderComponentStyle={{
        h: '$10',
        w: '100%',
        bg: 'blue',
      }}
      ListFooterComponentStyle={{
        h: '$10',
        w: '100%',
        bg: 'red',
      }}
      ref={ref}
      data={listData}
      ListHeaderComponent={XStack}
      ListFooterComponent={XStack}
      renderItem={({ item }) => (
        <XStack>
          <SizableText>{item}</SizableText>
          <Divider />
          <XStack gap="$8">
            <Button
              onPress={() => {
                const scrollView = ref.current;
                scrollView?.scrollToIndex({ index: 0, animated: true });
              }}
            >
              Scroll to Top
            </Button>
          </XStack>
        </XStack>
      )}
    />
  );
};

// 新的 ListView Demo - 使用封装的 CommonTableListView
const TableListViewDemo = () => {
  const renderTableRow = (item: (typeof mockData)[0], _index: number) => (
    <XStack
      py="$2"
      px="$3"
      alignItems="center"
      borderBottomWidth="$px"
      borderBottomColor="$borderSubdued"
      hoverStyle={{ bg: '$bgHover' }}
    >
      {/* Symbol - 固定宽度 */}
      <XStack width={120} justifyContent="flex-start">
        <SizableText size="$bodyMd" fontWeight="600">
          {item.name}
        </SizableText>
      </XStack>

      {/* Price - 固定宽度 */}
      <XStack width={100} justifyContent="flex-start">
        <SizableText size="$bodyMd">${item.price}</SizableText>
      </XStack>

      {/* Change - 固定宽度 */}
      <XStack width={80} justifyContent="flex-start">
        <SizableText
          size="$bodyMd"
          color={item.change.startsWith('+') ? '$textSuccess' : '$textCritical'}
        >
          {item.change}
        </SizableText>
      </XStack>

      {/* Volume - 可变宽度 */}
      <XStack minWidth={120} flex={1} justifyContent="flex-start">
        <SizableText size="$bodyMd">{item.volume}</SizableText>
      </XStack>

      {/* Market Cap - 可变宽度 */}
      <XStack minWidth={120} flex={1} justifyContent="flex-start">
        <SizableText size="$bodyMd">{item.marketCap}</SizableText>
      </XStack>

      {/* 24h High - 可变宽度 */}
      <XStack minWidth={110} flex={1} justifyContent="flex-start">
        <SizableText size="$bodyMd">${item.high24h}</SizableText>
      </XStack>

      {/* 24h Low - 可变宽度 */}
      <XStack minWidth={110} flex={1} justifyContent="flex-start">
        <SizableText size="$bodyMd">${item.low24h}</SizableText>
      </XStack>

      {/* Actions - 固定宽度 */}
      <XStack width={120} justifyContent="flex-start">
        <Button
          size="small"
          variant="secondary"
          onPress={() => {
            console.log('Trade clicked for:', item.name);
          }}
        >
          <SizableText size="$bodySm">Trade</SizableText>
        </Button>
      </XStack>
    </XStack>
  );

  return (
    <CommonTableListView
      columns={COLUMNS}
      data={mockData}
      renderRow={renderTableRow}
      emptyMessage="No trading data"
      emptySubMessage="Trading data will appear here"
    />
  );
};

const ListViewGallery = () => {
  const [showPerformanceList, setShowPerformanceList] = useState(false);
  const navigation = useAppNavigation();

  const headerRight = useCallback(
    () => (
      <Button
        onPress={() => {
          setShowPerformanceList(true);
        }}
      >
        ListView 性能测试
      </Button>
    ),
    [setShowPerformanceList],
  );

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight,
    });
  }, [navigation, headerRight]);

  return !showPerformanceList ? (
    <Layout
      filePath={__CURRENT_FILE_PATH__}
      componentName="ListView"
      elements={[
        {
          title: 'Styled ListView',
          element: <ListViewDemo />,
        },
        {
          title: 'Table ListView with Horizontal Scroll',
          element: <TableListViewDemo />,
        },
      ]}
    />
  ) : (
    <ListPerformance />
  );
};

export default ListViewGallery;
