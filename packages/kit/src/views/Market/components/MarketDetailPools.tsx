import type { PropsWithChildren } from 'react';
import { useCallback, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import type { ITabPageProps, ITableColumn } from '@onekeyhq/components';
import {
  Dialog,
  Icon,
  NumberSizeableText,
  SizableText,
  Stack,
  Table,
  View,
  XStack,
  YStack,
  renderNestedScrollView,
  useMedia,
} from '@onekeyhq/components';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  IMarketDetailPool,
  IMarketDetailTicker,
  IMarketResponsePool,
} from '@onekeyhq/shared/types/market';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { NetworksFilterItem } from '../../../components/NetworksFilterItem';
import { usePromiseResult } from '../../../hooks/usePromiseResult';

import { MarketPoolIcon } from './MarketPoolIcon';
import { PairDetailDialog } from './PairDetailDialog';
import { PoolDetailDialog } from './PoolDetailDialog';
import { useSortType } from './useSortType';

const CEX = 'CEX';

function NetworkIdSelect({
  value,
  onChange,
  options,
  oneKeyNetworkSymbols,
}: {
  options: string[];
  value: number;
  oneKeyNetworkSymbols: { logoURI?: string; networkName?: string }[];
  onChange: (selectedIndex: number) => void;
}) {
  return (
    <XStack gap="$2" px="$5" pb="$2" mt="$5" $gtMd={{ pr: 0 }} py="$2">
      {options.map((networkId, index) => (
        <NetworksFilterItem
          key={networkId}
          networkImageUri={oneKeyNetworkSymbols[index]?.logoURI}
          networkName={oneKeyNetworkSymbols[index]?.networkName}
          isSelected={value === index}
          onPress={() => onChange(index)}
        />
      ))}
    </XStack>
  );
}

function HeaderColumn({
  logoUrl,
  title,
  description,
}: {
  logoUrl: string;
  title: string;
  description: string;
}) {
  return (
    <XStack gap="$2.5" ai="center">
      <MarketPoolIcon uri={logoUrl} />
      <YStack flexShrink={1}>
        <SizableText size="$bodyMdMedium" numberOfLines={1} userSelect="none">
          {title}
        </SizableText>
        <SizableText
          userSelect="none"
          size="$bodySm"
          color="$textSubdued"
          numberOfLines={1}
        >
          {description}
        </SizableText>
      </YStack>
    </XStack>
  );
}

export function MarketDetailPools({
  pools,
  tickers,
}: ITabPageProps & {
  pools: IMarketResponsePool[];
  tickers?: IMarketDetailTicker[];
}) {
  const [settings] = useSettingsPersistAtom();
  const currency = settings.currencyInfo.symbol;
  const intl = useIntl();
  const { gtXl } = useMedia();
  const oneKeyNetworkIds = useMemo(() => {
    const result = pools
      .map((i) => i.onekeyNetworkId)
      .filter((i) => Boolean(i)) as string[];
    if (tickers?.length) {
      result.push(CEX);
    }
    return result;
  }, [pools, tickers?.length]);

  const { result: oneKeyNetworkSymbols } = usePromiseResult(
    async () => {
      const symbols: {
        logoURI?: string;
        networkName?: string;
      }[] = await Promise.all(
        oneKeyNetworkIds.map((networkId) => {
          if (networkId === CEX) {
            return Promise.resolve({ networkName: CEX });
          }
          return networkId
            ? backgroundApiProxy.serviceNetwork.getNetwork({ networkId })
            : Promise.resolve({ logoURI: '' });
        }),
      );
      return symbols;
    },
    [oneKeyNetworkIds],
    {
      initResult: [],
    },
  );
  const [index, selectIndex] = useState(0);
  const isCEXSelected = !pools[index];

  const listData = useMemo(
    () => (isCEXSelected ? tickers : pools[index]) ?? [],
    [index, isCEXSelected, pools, tickers],
  );

  const formatListData = isCEXSelected
    ? (listData as IMarketDetailTicker[]).map((i) => ({
        ...i,
        price: i.last,
        logUrl: i.logo,
        title: `${i.base} / ${i.target}`,
        description: i.market.name,
        plus2PercentDepth: i.depth_data?.['+2%'],
        minus2PercentDepth: i.depth_data?.['-2%'],
        volumeUsdH24: i.volume,
      }))
    : (listData as IMarketResponsePool).data.map((i) => ({
        ...i,
        logUrl: i.dexLogoUrl,
        title: i.attributes.name,
        description: i.dexName,
        price: Number(i.attributes.baseTokenPriceUsd),
        txTotal: Number(
          i.attributes.transactions.h24.buys +
            i.attributes.transactions.h24.sells,
        ),
        volumeUsdH24: Number(i.attributes.volumeUsd.h24),
        reserveInUsd: Number(i.attributes.reserveInUsd),
      }));
  const handleChange = useCallback((selectedIndex: number) => {
    selectIndex(selectedIndex);
  }, []);

  type IDataSource = typeof formatListData;
  type IDataSourceItem = IDataSource[0];

  const { sortedListData, handleSortTypeChange } = useSortType(
    formatListData as Record<string, any>[],
    index,
  );

  const onHeaderRow = useCallback(
    (column: ITableColumn<IDataSourceItem>) => ({
      onSortTypeChange: (order: 'asc' | 'desc' | undefined) => {
        handleSortTypeChange?.({
          columnName: column.dataIndex,
          order,
        });
      },
    }),
    [handleSortTypeChange],
  );
  const onRow = useCallback(
    (item: IMarketDetailPool | IMarketDetailTicker) => ({
      onPress: () => {
        Dialog.show({
          showFooter: false,
          title: intl.formatMessage({
            id: ETranslations.market_pool_details,
          }),
          renderContent: isCEXSelected ? (
            <PairDetailDialog item={item as IMarketDetailTicker} />
          ) : (
            <PoolDetailDialog item={item as IMarketDetailPool} />
          ),
        });
      },
    }),
    [intl, isCEXSelected],
  );

  const poolColumns = useMemo(
    () => [
      gtXl
        ? {
            title: intl.formatMessage({
              id: ETranslations.global_price,
            }),
            titleProps: {
              size: '$bodySmMedium',
              color: '$textSubdued',
            },
            align: 'right',
            dataIndex: 'price',
            columnProps: {
              flexGrow: 2,
              flexBasis: 0,
            },
            render: (price: string) => (
              <NumberSizeableText
                userSelect="none"
                size="$bodyMd"
                formatter="price"
                formatterOptions={{ currency }}
                textAlign="right"
              >
                {price}
              </NumberSizeableText>
            ),
          }
        : undefined,
      gtXl
        ? {
            title: intl.formatMessage({
              id: ETranslations.market_24h_txns,
            }),
            titleProps: {
              size: '$bodySmMedium',
              color: '$textSubdued',
            },
            align: 'right',
            dataIndex: 'txTotal',
            columnProps: {
              flexGrow: 2,
              flexBasis: 0,
            },
            render: (txTotal: string) => (
              <NumberSizeableText
                userSelect="none"
                size="$bodyMd"
                formatter="marketCap"
                textAlign="right"
              >
                {txTotal}
              </NumberSizeableText>
            ),
          }
        : undefined,
      {
        title: intl.formatMessage({
          id: ETranslations.market_twenty_four_hour_volume,
        }),
        titleProps: {
          size: '$bodySmMedium',
          color: '$textSubdued',
        },
        align: 'right',
        dataIndex: 'volumeUsdH24',
        columnProps: {
          flexGrow: 2,
          flexBasis: 0,
        },
        render: (volumeUsdH24: string) => (
          <NumberSizeableText
            userSelect="none"
            size="$bodyMd"
            formatter="marketCap"
            textAlign="right"
          >
            {volumeUsdH24}
          </NumberSizeableText>
        ),
      },
      {
        title: intl.formatMessage({
          id: ETranslations.global_liquidity,
        }),
        titleProps: {
          size: '$bodySmMedium',
          color: '$textSubdued',
        },
        align: 'right',
        dataIndex: 'reserveInUsd',
        columnProps: {
          flexGrow: 2,
          flexBasis: 0,
        },
        render: (reserveInUsd: string) => (
          <NumberSizeableText
            userSelect="none"
            size="$bodyMd"
            formatter="marketCap"
            textAlign="right"
          >
            {reserveInUsd}
          </NumberSizeableText>
        ),
      },
    ],
    [currency, gtXl, intl],
  );

  const cexColumns = useMemo(
    () => [
      {
        title: intl.formatMessage({
          id: ETranslations.global_price,
        }),
        titleProps: {
          size: '$bodySmMedium',
          color: '$textSubdued',
        },
        align: 'right',
        dataIndex: 'price',
        columnProps: {
          flexGrow: 2,
          flexBasis: 0,
        },
        render: (price: string) => (
          <NumberSizeableText
            userSelect="none"
            size="$bodyMd"
            formatter="price"
            formatterOptions={{ currency }}
            textAlign="right"
          >
            {price}
          </NumberSizeableText>
        ),
      },
      gtXl
        ? {
            title: intl.formatMessage({
              id: ETranslations.market_plus_2_percent_depth,
            }),
            titleProps: {
              size: '$bodySmMedium',
              color: '$textSubdued',
            },
            align: 'right',
            dataIndex: 'plus2PercentDepth',
            columnProps: {
              flexGrow: 2,
              flexBasis: 0,
            },
            render: (price: string) =>
              price ? (
                <NumberSizeableText
                  userSelect="none"
                  size="$bodyMd"
                  formatter="price"
                  formatterOptions={{ currency }}
                  textAlign="right"
                >
                  {price}
                </NumberSizeableText>
              ) : (
                '-'
              ),
          }
        : undefined,
      gtXl
        ? {
            title: intl.formatMessage({
              id: ETranslations.market_minus_2_percent_depth,
            }),
            titleProps: {
              size: '$bodySmMedium',
              color: '$textSubdued',
            },
            align: 'right',
            dataIndex: 'minus2PercentDepth',
            columnProps: {
              flexGrow: 2,
              flexBasis: 0,
            },
            render: (price: string) =>
              price ? (
                <NumberSizeableText
                  userSelect="none"
                  size="$bodyMd"
                  formatter="price"
                  formatterOptions={{ currency }}
                  textAlign="right"
                >
                  {price}
                </NumberSizeableText>
              ) : (
                '-'
              ),
          }
        : undefined,
      {
        title: intl.formatMessage({
          id: ETranslations.market_twenty_four_hour_volume,
        }),
        titleProps: {
          size: '$bodySmMedium',
          color: '$textSubdued',
        },
        align: 'right',
        dataIndex: 'volumeUsdH24',
        columnProps: {
          flexGrow: 2,
          flexBasis: 0,
        },
        render: (volumeUsdH24: string) => (
          <NumberSizeableText
            userSelect="none"
            size="$bodyMd"
            formatter="marketCap"
            textAlign="right"
          >
            {volumeUsdH24}
          </NumberSizeableText>
        ),
      },
    ],
    [currency, gtXl, intl],
  );

  const columns = useMemo(
    () => [
      {
        title: intl.formatMessage({
          id: ETranslations.global_pair,
        }),
        titleProps: {
          size: '$bodySmMedium',
          color: '$textSubdued',
        },
        columnProps: {
          flexGrow: 3,
          flexBasis: 0,
        },
        dataIndex: 'dexDataName',
        render: (_: any, { logUrl, title, description }: IDataSourceItem) => (
          <HeaderColumn
            logoUrl={logUrl}
            title={title}
            description={description}
          />
        ),
      },
      ...(isCEXSelected ? cexColumns : poolColumns),
      {
        title: '',
        align: 'right',
        dataIndex: 'action',
        columnProps: {
          width: 24,
        },
        render: () => (
          <View left={4} $gtMd={{ pl: '$7', pr: '$1' }}>
            <Icon name="ChevronRightSmallOutline" size="$4" />
          </View>
        ),
      },
    ],
    [cexColumns, intl, isCEXSelected, poolColumns],
  );

  return (
    <Table
      stickyHeader={false}
      TableHeaderComponent={
        <NetworkIdSelect
          options={oneKeyNetworkIds}
          oneKeyNetworkSymbols={oneKeyNetworkSymbols}
          value={index}
          onChange={handleChange}
        />
      }
      renderScrollComponent={renderNestedScrollView}
      onRow={onRow}
      onHeaderRow={onHeaderRow as any}
      rowProps={{
        px: '$3',
        mx: '$2',
        minHeight: '$12',
      }}
      estimatedItemSize="$12"
      headerRowProps={{ py: '$2', minHeight: 36 }}
      dataSource={sortedListData as any}
      columns={columns as any}
      extraData={index}
    />
  );
}
