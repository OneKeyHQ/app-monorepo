import { useIntl } from 'react-intl';

import type { ITableColumn } from '@onekeyhq/components';
import {
  NumberSizeableText,
  Skeleton,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { TokenIdentityItem } from '../../components/TokenIdentityItem';
import { type IMarketToken } from '../../MarketTokenData';

export const useColumnsMobile = (): ITableColumn<IMarketToken>[] => {
  const [settings] = useSettingsPersistAtom();
  const currency = settings.currencyInfo.symbol;
  const intl = useIntl();

  return [
    {
      title: `${intl.formatMessage({
        id: ETranslations.global_name,
      })} / ${intl.formatMessage({
        id: ETranslations.dexmarket_turnover,
      })}`,
      titleProps: { paddingBottom: '$2', paddingLeft: '$3' },
      dataIndex: 'tokenInfo',
      columnWidth: '50%',
      render: (_, record: IMarketToken) => {
        return (
          <XStack alignItems="center" ml="$3">
            <TokenIdentityItem
              tokenLogoURI={record.tokenImageUri}
              networkLogoURI={record.networkLogoUri}
              networkId={record.networkId}
              symbol={record.symbol}
              address={record.address}
              showVolume
              volume={record.turnover}
              communityRecognized={record.communityRecognized}
            />
          </XStack>
        );
      },
      renderSkeleton: () => (
        <XStack alignItems="center" paddingLeft="$5" gap="$3">
          <XStack position="relative">
            <Skeleton width={32} height={32} borderRadius="$full" />
          </XStack>
          <YStack gap="$1">
            <Skeleton width={80} height={16} />
            <Skeleton width={60} height={12} />
          </YStack>
        </XStack>
      ),
    },
    {
      title: `${intl.formatMessage({
        id: ETranslations.global_price,
      })} / ${intl.formatMessage({
        id: ETranslations.dexmarket_token_change,
      })}`,
      titleProps: { paddingBottom: '$2', paddingRight: '$3' },
      dataIndex: 'price',
      columnWidth: '50%',
      align: 'right',
      render: (_, record: IMarketToken) => {
        return (
          <XStack justifyContent="flex-end" alignItems="center" mr="$3">
            <XStack flexDirection="column" alignItems="flex-end">
              <NumberSizeableText
                userSelect="none"
                flexShrink={1}
                numberOfLines={1}
                size="$bodyLgMedium"
                formatter="price"
                formatterOptions={{ currency }}
              >
                {record.price}
              </NumberSizeableText>
              <NumberSizeableText
                size="$bodyMd"
                color={
                  Number(record.change24h) >= 0
                    ? '$textSuccess'
                    : '$textCritical'
                }
                formatter="priceChange"
                formatterOptions={{
                  showPlusMinusSigns: true,
                }}
              >
                {record.change24h}
              </NumberSizeableText>
            </XStack>
          </XStack>
        );
      },
      renderSkeleton: () => (
        <XStack justifyContent="flex-end" alignItems="center" paddingRight="$5">
          <Skeleton width="$20" height="$8" borderRadius="$2" />
        </XStack>
      ),
    },
  ];
};
