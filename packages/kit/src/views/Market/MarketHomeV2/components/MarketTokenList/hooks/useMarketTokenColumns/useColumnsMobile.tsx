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
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { TokenIdentityItem } from '../../components/TokenIdentityItem';
import { type IMarketToken } from '../../MarketTokenData';

export const useColumnsMobile = (
  networkId?: string,
  _watchlistActive = false,
): ITableColumn<IMarketToken>[] => {
  const [settings] = useSettingsPersistAtom();
  const currency = settings.currencyInfo.symbol;
  const intl = useIntl();

  return [
    {
      title: `${intl.formatMessage({
        id: ETranslations.global_name,
      })} / ${intl.formatMessage({
        id: ETranslations.dexmarket_mobiletitle_mcap,
      })}`,
      titleProps: { paddingLeft: '$5' },
      dataIndex: 'tokenInfo',
      columnWidth: '40%',
      render: (_, record: IMarketToken) => {
        return (
          <XStack alignItems="center" paddingLeft="$5">
            <TokenIdentityItem
              tokenLogoURI={record.tokenImageUri}
              networkLogoURI={record.networkLogoUri}
              symbol={record.symbol}
              address={record.address}
              showVolume
              volume={record.turnover}
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
      title: intl.formatMessage({ id: ETranslations.global_price }),
      dataIndex: 'price',
      columnWidth: '30%',
      align: 'right',
      render: (_, record: IMarketToken) => {
        return (
          <XStack justifyContent="center" alignItems="center">
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
          </XStack>
        );
      },
      renderSkeleton: () => (
        <XStack justifyContent="center" alignItems="center">
          <Skeleton width={70} height={20} />
        </XStack>
      ),
    },
    {
      title: `${intl.formatMessage({
        id: ETranslations.dexmarket_token_change,
      })}(%)`,
      titleProps: { paddingRight: '$5' },
      dataIndex: 'change',
      columnWidth: '30%',
      align: 'right',
      render: (_, record: IMarketToken) => {
        return (
          <XStack
            justifyContent="flex-end"
            alignItems="center"
            paddingRight="$5"
          >
            <XStack
              width="$20"
              height="$8"
              justifyContent="center"
              alignItems="center"
              backgroundColor={
                Number(record.change24h) > 0
                  ? '$bgSuccessStrong'
                  : '$bgCriticalStrong'
              }
              borderRadius="$2"
            >
              <NumberSizeableText
                adjustsFontSizeToFit
                numberOfLines={platformEnv.isNative ? 1 : 2}
                paddingHorizontal="$1"
                userSelect="none"
                size="$bodyMdMedium"
                color="white"
                formatter="priceChangeCapped"
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
