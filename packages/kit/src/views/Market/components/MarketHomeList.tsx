import type { PropsWithChildren, ReactElement } from 'react';
import { useCallback, useMemo, useState } from 'react';

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
import { EModalRoutes, EModalSwapRoutes } from '@onekeyhq/shared/src/routes';
import type {
  IMarketCategory,
  IMarketToken,
} from '@onekeyhq/shared/types/market';

import useAppNavigation from '../../../hooks/useAppNavigation';

import SparklineChart from './SparklineChart';
import { ToggleButton } from './ToggleButton';

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

const useBuildTableRowConfig = () => {
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
            borderRadius="100%"
          />
          <YStack width="$20">
            <SizableText size="$bodyLgMedium">
              {item.symbol.toUpperCase()}
            </SizableText>
            <SizableText size="$bodySm" color="$textSubdued">
              {item.name}
            </SizableText>
          </YStack>
          <Button
            size="small"
            onPress={async () => {
              const response =
                await backgroundApiProxy.serviceMarket.fetchPools(
                  item.symbol,
                  item.symbol,
                );
              // navigation.pushModal(EModalRoutes.SwapModal, {
              //   screen: EModalSwapRoutes.SwapMainLand,
              //   params: {
              //     importNetworkId: networkId,
              //     importFromToken: {
              //       contractAddress: tokenInfo.address,
              //       symbol: tokenInfo.symbol,
              //       networkId,
              //       isNative: tokenInfo.isNative,
              //       decimals: tokenInfo.decimals,
              //       name: tokenInfo.name,
              //       logoURI: tokenInfo.logoURI,
              //       networkLogoURI: network?.logoURI,
              //     },
              //   },
              // });
            }}
          >
            Swap
          </Button>
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
    return tableRowConfig;
  }, []);
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
      <Column key="sparkline" alignRight width={100} pl="$4">
        {sparkline?.(item)}
      </Column>
      <Column key="action" alignLeft width={200} pl="$4">
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
  dataDisplay: string;
  priceChange: string;
  onConfirm: (value: { dataDisplay: string; priceChange: string }) => void;
}) {
  const { closePopover } = usePopoverContext();
  const [dataDisplay, setDataDisplay] = useState(defaultDataDisplay);
  const [priceChange, setPriceChange] = useState(defaultPriceChange);
  return (
    <YStack px="$5" space="$5">
      <ToggleButton
        title="Data Display"
        value={dataDisplay}
        onChange={setDataDisplay}
        options={[
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
        onChange={setPriceChange}
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

export function MarketHomeList({ category }: { category: IMarketCategory }) {
  const selectOptions = useMemo(
    () => [
      { label: 'Default', value: 'Default' },
      { label: 'Last price', value: 'Last price' },
      { label: 'Most 24h volume', value: 'Most 24h volume' },
      { label: 'Most market cap', value: 'Most market cap' },
      { label: 'Price change up', value: 'Price change up' },
      { label: 'Price change down', value: 'Price change down' },
    ],
    [],
  );
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

  const tableRowConfig = useBuildTableRowConfig();
  const renderItem = useCallback(
    ({ item }: any) => (
      <TableRow tableConfig={tableRowConfig} item={item} minHeight={60} />
    ),
    [tableRowConfig],
  );

  const renderMdItem = useCallback(
    ({ item }: { item: IMarketToken }) => (
      <XStack height={60} justifyContent="space-between">
        <XStack space="$3" ai="center">
          <Image
            src={decodeURIComponent(item.image)}
            size="$10"
            borderRadius="100%"
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
            formatter="price"
            formatterOptions={{ currency: '$' }}
          >
            {item.price}
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
              formatterOptions={{ currency: '$' }}
            >
              {item.priceChangePercentage24H}
            </NumberSizeableText>
          </XStack>
        </XStack>
      </XStack>
    ),
    [],
  );
  const { gtMd } = useMedia();
  const [sortByType, setSortByType] = useState('Default');

  const renderSelectTrigger = useCallback(
    ({ label }: { label?: string }) => (
      <XStack ai="center" space="$1">
        <SizableText>{label}</SizableText>
        <Icon name="ChevronBottomSolid" size="$4" />
      </XStack>
    ),
    [],
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
                value={sortByType}
                onChange={setSortByType}
                renderTrigger={renderSelectTrigger}
              />
            </XStack>
            <Popover
              title="Settings"
              renderTrigger={
                <Icon name="SliderVerOutline" color="$iconSubdued" size="$5" />
              }
              renderContent={
                <PopoverSettingsContent
                  dataDisplay=""
                  priceChange=""
                  onConfirm={console.log}
                />
              }
            />
          </XStack>
        </YStack>
      )}

      <YStack flex={1} px="$5" py="$3">
        {gtMd ? HeaderColumns : undefined}
        <ListView
          stickyHeaderHiddenOnScroll
          estimatedItemSize={60}
          data={listData}
          renderItem={gtMd ? renderItem : renderMdItem}
        />
      </YStack>
    </>
  );
}
