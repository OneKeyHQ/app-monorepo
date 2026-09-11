import { useCallback, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import type { ITableColumn } from '@onekeyhq/components';
import {
  Icon,
  NumberSizeableText,
  SizableText,
  Skeleton,
  Table,
  View,
  XStack,
  YStack,
  useInPageDialog,
  useIsOverlayPage,
  useMedia,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IServerNetwork } from '@onekeyhq/shared/types';
import type {
  IMarketDetailPlatform,
  IMarketDetailPool,
  IMarketDetailTicker,
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
    <XStack
      gap="$2"
      px="$5"
      pb="$2"
      mt="$5"
      $gtMd={{ pr: 0 }}
      py="$2"
      flexWrap="wrap"
    >
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

function SkeletonRow() {
  return (
    <XStack>
      <XStack flex={1}>
        <Skeleton w="$24" h="$3" />
      </XStack>
      <XStack flex={1} jc="flex-end">
        <Skeleton w="$16" h="$3" />
      </XStack>
      <XStack flex={1} jc="flex-end">
        <Skeleton w="$16" h="$3" />
      </XStack>
      <XStack flex={1} jc="flex-end">
        <Skeleton w="$16" h="$3" />
      </XStack>
      <XStack flex={1} jc="flex-end">
        <Skeleton w="$16" h="$3" />
      </XStack>
    </XStack>
  );
}

function MdSkeletonRow() {
  return (
    <XStack>
      <XStack flex={1}>
        <Skeleton w="$24" h="$3" />
      </XStack>
      <XStack flex={1} jc="flex-end">
        <Skeleton w="$16" h="$3" />
      </XStack>
      <XStack flex={1} jc="flex-end">
        <Skeleton w="$16" h="$3" />
      </XStack>
    </XStack>
  );
}

function MarketDetailPoolsSkeletonRow() {
  const { md } = useMedia();
  return md ? (
    <YStack gap="$10" px="$5" pt="$11">
      <MdSkeletonRow />
      <MdSkeletonRow />
      <MdSkeletonRow />
      <MdSkeletonRow />
    </YStack>
  ) : (
    <YStack gap="$6" px="$5" pt="$11">
      <SkeletonRow />
      <SkeletonRow />
      <SkeletonRow />
      <SkeletonRow />
    </YStack>
  );
}

export function MarketDetailPools({
  detailPlatforms,
  tickers,
}: {
  tickers?: IMarketDetailTicker[];
  detailPlatforms: IMarketDetailPlatform;
}) {
  const currency = '$';
  const intl = useIntl();
  const { gtXl: gtXlMedia } = useMedia();
  const isOverlayPage = useIsOverlayPage();
  const gtXl = gtXlMedia && !isOverlayPage;

  const { result: pools } = usePromiseResult(
    async () => {
      const response =
        await backgroundApiProxy.serviceMarket.fetchPools(detailPlatforms);
      return response;
    },
    [detailPlatforms],
    {
      initResult: [],
    },
  );

  // Resolve the OneKey networks that still exist locally. The server pools API
  // may return networks that have already been delisted/removed from the
  // client; getNetworksByIds simply filters those out instead of throwing.
  const { result: existingNetworks, isLoading: isExistingNetworksLoading } =
    usePromiseResult(
      async () => {
        const networkIds = pools
          .map((i) => i.onekeyNetworkId)
          .filter((i): i is string => Boolean(i));
        if (!networkIds.length) {
          return [];
        }
        const { networks } =
          await backgroundApiProxy.serviceNetwork.getNetworksByIds({
            networkIds,
          });
        return networks;
      },
      [pools],
      {
        initResult: [],
        watchLoading: true,
      },
    );

  const existingNetworkMap = useMemo(
    () =>
      new Map<string, IServerNetwork>(
        existingNetworks.map((network) => [network.id, network]),
      ),
    [existingNetworks],
  );

  // Drop pools whose network has been delisted. Previously a single stale
  // networkId broke the entire selector row: getNetwork throws for unknown
  // networks and the symbols Promise.all rejected as a whole, leaving every
  // network icon blank.
  // While the existing-network set is still loading, keep all pools so the
  // selector doesn't momentarily collapse to the CEX tab; delisted networks are
  // filtered out once existingNetworks resolves.
  const validPools = useMemo(
    () =>
      isExistingNetworksLoading
        ? pools
        : pools.filter(
            (i) =>
              i.onekeyNetworkId && existingNetworkMap.has(i.onekeyNetworkId),
          ),
    [pools, isExistingNetworksLoading, existingNetworkMap],
  );

  const oneKeyNetworkIds = useMemo(() => {
    const result = validPools
      .map((i) => i.onekeyNetworkId)
      .filter((i) => Boolean(i)) as string[];
    if (tickers?.length) {
      result.push(CEX);
    }
    return result;
  }, [validPools, tickers?.length]);

  const oneKeyNetworkSymbols = useMemo(() => {
    const symbols: {
      logoURI?: string;
      networkName?: string;
    }[] = validPools.map((i) => {
      const network = i.onekeyNetworkId
        ? existingNetworkMap.get(i.onekeyNetworkId)
        : undefined;
      return { logoURI: network?.logoURI };
    });
    if (tickers?.length) {
      symbols.push({ networkName: CEX });
    }
    return symbols;
  }, [validPools, existingNetworkMap, tickers?.length]);
  // Identify the selected tab by a stable key (pool localId, or the CEX
  // sentinel) instead of a positional index. validPools changes asynchronously:
  // it holds every pool while existingNetworks is loading, then drops delisted
  // pools once it resolves. A raw index could fall out of range (silently
  // switching to CEX) or point at a pool that shifted into that slot. Deriving
  // the index from the selected key keeps the selection pinned to the same tab,
  // and falls back to the first tab when the selected pool was delisted.
  const tabKeys = useMemo(() => {
    const keys = validPools.map((i) => i.onekeyNetworkId ?? i.localId);
    if (tickers?.length) {
      keys.push(CEX);
    }
    return keys;
  }, [validPools, tickers?.length]);

  const [selectedKey, setSelectedKey] = useState<string | undefined>(undefined);

  const index = useMemo(() => {
    const found = selectedKey ? tabKeys.indexOf(selectedKey) : -1;
    return found >= 0 ? found : 0;
  }, [selectedKey, tabKeys]);

  const isCEXSelected = !validPools[index];

  const formatListData = isCEXSelected
    ? (tickers ?? []).map((item) => ({
        ...item,
        price: item.last,
        logUrl: item.logo,
        title: `${item.base} / ${item.target}`,
        description: item.market.name,
        plus2PercentDepth: item.depth_data?.['+2%'],
        minus2PercentDepth: item.depth_data?.['-2%'],
        volumeUsdH24: item.volume,
      }))
    : (validPools[index]?.data ?? []).map((item) => ({
        ...item,
        logUrl: item.dexLogoUrl,
        title: item.attributes.name,
        description: item.dexName,
        price: Number(item.attributes.baseTokenPriceUsd),
        txTotal: Number(
          item.attributes.transactions.h24.buys +
            item.attributes.transactions.h24.sells,
        ),
        volumeUsdH24: Number(item.attributes.volumeUsd.h24),
        reserveInUsd: Number(item.attributes.reserveInUsd),
      }));
  const handleChange = useCallback(
    (selectedIndex: number) => {
      setSelectedKey(tabKeys[selectedIndex]);
    },
    [tabKeys],
  );

  type IDataSource = typeof formatListData;
  type IDataSourceItem = IDataSource[0];

  const { sortedListData, handleSortTypeChange } = useSortType(
    formatListData,
    index,
  );

  const onHeaderRow = useCallback(
    (column: ITableColumn<IDataSourceItem>) => {
      if (!column.title) {
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

  const inPageDialog = useInPageDialog();

  const onRow = useCallback(
    (item: IMarketDetailPool | IMarketDetailTicker) => ({
      onPress: () => {
        inPageDialog.show({
          showFooter: false,
          title: intl.formatMessage({
            id: ETranslations.dexmarket_pool_details,
          }),
          renderContent: isCEXSelected ? (
            <PairDetailDialog item={item as IMarketDetailTicker} />
          ) : (
            <PoolDetailDialog item={item as IMarketDetailPool} />
          ),
        });
      },
    }),
    [inPageDialog, intl, isCEXSelected],
  );

  const poolColumns = useMemo<(ITableColumn<IDataSourceItem> | undefined)[]>(
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
                formatterOptions={{ currency }}
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
            formatterOptions={{ currency }}
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
            formatterOptions={{ currency }}
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

  const cexColumns = useMemo<(ITableColumn<IDataSourceItem> | undefined)[]>(
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
                <SizableText size="$bodyMd">-</SizableText>
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
                <SizableText size="$bodyMd">-</SizableText>
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
            formatterOptions={{ currency }}
            textAlign="right"
          >
            {volumeUsdH24}
          </NumberSizeableText>
        ),
      },
    ],
    [currency, gtXl, intl],
  );

  const columns = useMemo<ITableColumn<IDataSourceItem>[]>(
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
        render: (
          _: unknown,
          { logUrl, title, description }: IDataSourceItem,
        ) => (
          <HeaderColumn
            logoUrl={logUrl}
            title={title}
            description={description}
          />
        ),
      },
      ...(isCEXSelected ? cexColumns : poolColumns).filter(
        (column): column is ITableColumn<IDataSourceItem> => Boolean(column),
      ),
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
      contentContainerStyle={{
        pb: '$10',
      }}
      scrollEnabled={false}
      TableHeaderComponent={
        <NetworkIdSelect
          options={oneKeyNetworkIds}
          oneKeyNetworkSymbols={oneKeyNetworkSymbols}
          value={index}
          onChange={handleChange}
        />
      }
      TableEmptyComponent={<MarketDetailPoolsSkeletonRow />}
      onRow={onRow}
      onHeaderRow={onHeaderRow}
      rowProps={{
        px: '$3',
        mx: '$2',
        minHeight: '$12',
      }}
      estimatedItemSize="$12"
      headerRowProps={{ py: '$2', minHeight: 36 }}
      dataSource={(sortedListData ?? []) as IDataSource}
      columns={columns}
      extraData={index}
      keyExtractor={(item) => item.localId}
    />
  );
}
