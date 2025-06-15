import type { ITableColumn } from '@onekeyhq/components';
import { NumberSizeableText, XStack, useMedia } from '@onekeyhq/components';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { TokenIdentityItem } from '../../components/TokenIdentityItem';
import { type IMarketToken } from '../../MarketTokenData';

export const useMobileColumns = (
  networkId?: string,
  _watchlistActive = false,
): ITableColumn<IMarketToken>[] => {
  const { md } = useMedia();
  const [settings] = useSettingsPersistAtom();
  const currency = settings.currencyInfo.symbol;

  if (!md) return [];

  return [
    {
      title: '',
      dataIndex: 'tokenInfo',
      columnWidth: '50%',
      render: (_, record: IMarketToken) => {
        return (
          <XStack alignItems="center" paddingLeft="$5">
            <TokenIdentityItem
              tokenLogoURI={record.tokenImageUri}
              networkLogoURI={record.networkLogoUri}
              symbol={record.symbol}
              address={record.address}
            />
          </XStack>
        );
      },
    },
    {
      title: '',
      dataIndex: 'price',
      columnWidth: '25%',
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
    },
    {
      title: '',
      dataIndex: 'change',
      columnWidth: '25%',
      render: (_, record: IMarketToken) => {
        return (
          <XStack justifyContent="center" alignItems="center" paddingRight="$5">
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
                formatter="priceChange"
                formatterOptions={{ showPlusMinusSigns: true }}
              >
                {record.change24h}
              </NumberSizeableText>
            </XStack>
          </XStack>
        );
      },
    },
  ];
};
