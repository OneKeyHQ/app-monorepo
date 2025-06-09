import { useIntl } from 'react-intl';

import type { ITableColumn } from '@onekeyhq/components';
import {
  NumberSizeableText,
  Skeleton,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { TokenIdentityItem } from '../../components/TokenIdentityItem';
import { Txns } from '../../components/Txns';

import type { IMarketToken } from '../../MarketTokenData';

export const useDesktopColumns = (): ITableColumn<IMarketToken>[] => {
  const { md } = useMedia();

  const [settings] = useSettingsPersistAtom();
  const currency = settings.currencyInfo.symbol;
  const intl = useIntl();

  if (md) return [];

  return [
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
          <YStack space="$1">
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
        <YStack space="$1" alignItems="flex-end">
          <Skeleton width={50} height={14} />
          <XStack space="$1">
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
      columnWidth: 180,
      render: (text: number) => (
        <NumberSizeableText
          size="$bodyMd"
          formatter="value"
          formatterOptions={{ currency }}
        >
          {text}
        </NumberSizeableText>
      ),
      renderSkeleton: () => <Skeleton width={120} height={16} />,
      align: 'right',
    },
  ];
};
