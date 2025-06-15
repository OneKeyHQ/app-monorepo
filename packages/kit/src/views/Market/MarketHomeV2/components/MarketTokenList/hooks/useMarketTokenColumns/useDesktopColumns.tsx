import { useIntl } from 'react-intl';

import type { ITableColumn } from '@onekeyhq/components';
import {
  NumberSizeableText,
  Skeleton,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import { MarketStarV2 } from '@onekeyhq/kit/src/views/Market/components/MarketStarV2';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EWatchlistFrom } from '@onekeyhq/shared/src/logger/scopes/market/scenes/token';

import { TokenIdentityItem } from '../../components/TokenIdentityItem';
import { Txns } from '../../components/Txns';

import type { IMarketToken } from '../../MarketTokenData';

export const useDesktopColumns = (
  networkId?: string,
): ITableColumn<IMarketToken>[] => {
  const { md } = useMedia();

  const [settings] = useSettingsPersistAtom();
  const currency = settings.currencyInfo.symbol;
  const intl = useIntl();

  if (md) return [];

  return [
    {
      title: '',
      dataIndex: 'star',
      columnWidth: 50,
      render: (_, record) => (
        <MarketStarV2
          chainId={networkId || ''}
          contractAddress={record.address}
          from={EWatchlistFrom.catalog}
          size="small"
        />
      ),
      renderSkeleton: () => (
        <Skeleton width={24} height={24} borderRadius="$full" />
      ),
      align: 'center',
    },
    {
      title: intl.formatMessage({ id: ETranslations.global_name }),
      dataIndex: 'name',
      columnWidth: 200,
      render: (_, record) => (
        <TokenIdentityItem
          tokenLogoURI={record.tokenImageUri}
          networkLogoURI={record.networkLogoUri}
          symbol={record.symbol}
          address={record.address}
          showCopyButton
        />
      ),
      renderSkeleton: () => (
        <XStack alignItems="center" space="$3">
          <XStack position="relative">
            <Skeleton width={32} height={32} borderRadius="$full" />
            <Skeleton
              width={16}
              height={16}
              borderRadius="$full"
              position="absolute"
              right={-4}
              bottom={-4}
            />
          </XStack>
          <YStack gap="$1">
            <Skeleton width={80} height={16} />
            <Skeleton width={60} height={12} />
          </YStack>
        </XStack>
      ),
    },
    {
      title: intl.formatMessage({ id: ETranslations.global_price }),
      dataIndex: 'price',
      columnWidth: 100,
      render: (text: number) => (
        <NumberSizeableText
          size="$bodyMd"
          formatter="price"
          formatterOptions={{ currency }}
        >
          {text}
        </NumberSizeableText>
      ),
      renderSkeleton: () => <Skeleton width={70} height={16} />,
      align: 'right',
    },
    {
      title: intl.formatMessage({ id: ETranslations.dexmarket_token_change }),
      dataIndex: 'change24h',
      columnWidth: 100,
      render: (text: number) => (
        <NumberSizeableText
          size="$bodyMd"
          formatter="priceChange"
          color={text >= 0 ? '$textSuccess' : '$textCritical'}
          formatterOptions={{ showPlusMinusSigns: true }}
        >
          {text}
        </NumberSizeableText>
      ),
      renderSkeleton: () => <Skeleton width={60} height={16} />,
      align: 'right',
    },
    {
      title: intl.formatMessage({ id: ETranslations.global_market_cap }),
      dataIndex: 'marketCap',
      columnWidth: 100,
      render: (text: number) => (
        <NumberSizeableText
          size="$bodyMd"
          formatter="marketCap"
          formatterOptions={{ currency }}
        >
          {text}
        </NumberSizeableText>
      ),
      renderSkeleton: () => <Skeleton width={80} height={16} />,
      align: 'right',
    },
    {
      title: intl.formatMessage({ id: ETranslations.global_liquidity }),
      dataIndex: 'liquidity',
      columnWidth: 150,
      render: (text: number) => (
        <NumberSizeableText
          size="$bodyMd"
          formatter="marketCap"
          formatterOptions={{ currency }}
        >
          {text}
        </NumberSizeableText>
      ),
      renderSkeleton: () => <Skeleton width={100} height={16} />,
      align: 'right',
    },
    {
      title: intl.formatMessage({ id: ETranslations.dexmarket_txns }),
      dataIndex: 'transactions',
      columnWidth: 100,
      render: (text: number, record) => (
        <Txns transactions={text} walletInfo={record.walletInfo} />
      ),
      renderSkeleton: () => (
        <YStack gap="$1" alignItems="flex-end">
          <Skeleton width={50} height={14} />
          <XStack gap="$1">
            <Skeleton width={20} height={12} />
            <Skeleton width={20} height={12} />
          </XStack>
        </YStack>
      ),
      align: 'right',
    },
    {
      title: intl.formatMessage({ id: ETranslations.dexmarket_traders }),
      dataIndex: 'uniqueTraders',
      columnWidth: 100,
      render: (text: number) => (
        <NumberSizeableText size="$bodyMd" formatter="balance">
          {text}
        </NumberSizeableText>
      ),
      renderSkeleton: () => <Skeleton width={60} height={16} />,
      align: 'right',
    },
    {
      title: 'Holders',
      dataIndex: 'holders',
      columnWidth: 100,
      render: (text: number) => (
        <NumberSizeableText size="$bodyMd" formatter="balance">
          {text}
        </NumberSizeableText>
      ),
      renderSkeleton: () => <Skeleton width={60} height={16} />,
      align: 'right',
    },
    {
      title: intl.formatMessage({ id: ETranslations.dexmarket_turnover }),
      dataIndex: 'turnover',
      columnWidth: 120,
      render: (text: number) => (
        <NumberSizeableText
          size="$bodyMd"
          formatter="value"
          formatterOptions={{ currency }}
        >
          {text}
        </NumberSizeableText>
      ),
      renderSkeleton: () => <Skeleton width={100} height={16} />,
      align: 'right',
    },
  ];
};
