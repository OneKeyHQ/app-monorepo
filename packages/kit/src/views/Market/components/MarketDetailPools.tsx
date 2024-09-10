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
  IMarketResponsePool,
} from '@onekeyhq/shared/types/market';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { NetworkAvatar } from '../../../components/NetworkAvatar';
import { NetworksFilterItem } from '../../../components/NetworksFilterItem';
import { usePromiseResult } from '../../../hooks/usePromiseResult';

import { MarketPoolIcon } from './MarketPoolIcon';
import { PoolDetailDialog } from './PoolDetailDialog';
import { useSortType } from './useSortType';

function NetworkIdSelect({
  value,
  onChange,
  options,
  oneKeyNetworkImages,
}: {
  options: string[];
  value: number;
  oneKeyNetworkImages: { logoURI: string }[];
  onChange: (selectedIndex: number) => void;
}) {
  return (
    <XStack gap="$2" px="$5" pb="$2" mt="$5" $gtMd={{ pr: 0 }} py="$2">
      {options.map((networkId, index) => (
        <NetworksFilterItem
          key={networkId}
          networkImageUri={oneKeyNetworkImages[index]?.logoURI}
          isSelected={value === index}
          onPress={() => onChange(index)}
        />
      ))}
    </XStack>
  );
}

export function MarketDetailPools({
  pools,
}: ITabPageProps & { pools: IMarketResponsePool[] }) {
  const [settings] = useSettingsPersistAtom();
  const currency = settings.currencyInfo.symbol;
  const intl = useIntl();
  const { gtXl } = useMedia();
  const oneKeyNetworkIds = useMemo(
    () =>
      pools.map((i) => i.onekeyNetworkId).filter((i) => Boolean(i)) as string[],
    [pools],
  );

  const { result: oneKeyNetworkImages } = usePromiseResult(
    () =>
      Promise.all(
        oneKeyNetworkIds.map((networkId) =>
          networkId
            ? backgroundApiProxy.serviceNetwork.getNetwork({ networkId })
            : Promise.resolve({ logoURI: '' }),
        ),
      ),
    [oneKeyNetworkIds],
    {
      initResult: [],
    },
  );
  const [index, selectIndex] = useState(0);
  const listData = useMemo(() => pools[index], [index, pools]);
  const formatListData = listData.data.map((i) => ({
    ...i,
    dexDataName: i.dexName,
    price: Number(i.attributes.baseTokenPriceUsd),
    txTotal: Number(
      i.attributes.transactions.h24.buys + i.attributes.transactions.h24.sells,
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
    (item: IMarketDetailPool) => ({
      onPress: () => {
        Dialog.show({
          showFooter: false,
          title: intl.formatMessage({
            id: ETranslations.market_pool_details,
          }),
          renderContent: <PoolDetailDialog item={item} />,
        });
      },
    }),
    [intl],
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
        render: (
          _: any,
          { dexLogoUrl, attributes, dexDataName }: IDataSourceItem,
        ) => (
          <XStack gap="$2.5" ai="center">
            <MarketPoolIcon uri={dexLogoUrl} />
            <YStack flexShrink={1}>
              <SizableText
                size="$bodyMdMedium"
                numberOfLines={1}
                userSelect="none"
              >
                {attributes.name}
              </SizableText>
              <SizableText
                userSelect="none"
                size="$bodySm"
                color="$textSubdued"
                numberOfLines={1}
              >
                {dexDataName}
              </SizableText>
            </YStack>
          </XStack>
        ),
      },
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
    [currency, gtXl, intl],
  );

  return (
    <Table
      stickyHeader={false}
      TableHeaderComponent={
        <NetworkIdSelect
          options={oneKeyNetworkIds}
          oneKeyNetworkImages={oneKeyNetworkImages}
          value={index}
          onChange={handleChange}
        />
      }
      renderScrollComponent={renderNestedScrollView}
      onRow={onRow}
      onHeaderRow={onHeaderRow}
      rowProps={{
        px: '$3',
        mx: '$2',
        minHeight: '$12',
      }}
      estimatedItemSize="$12"
      headerRowProps={{ py: '$2', minHeight: 36 }}
      dataSource={sortedListData as unknown as IDataSource}
      columns={columns as any}
      extraData={index}
    />
  );
}
