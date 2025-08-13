import { useIntl } from 'react-intl';

import type { ITableColumn } from '@onekeyhq/components';
import { NumberSizeableText, XStack, useMedia } from '@onekeyhq/components';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { TokenIdentityItem } from '../../components/TokenIdentityItem';
import { type IMarketToken } from '../../MarketTokenData';

export const useColumnsMobile = (
  networkId?: string,
  _watchlistActive = false,
): ITableColumn<IMarketToken>[] => {
  const { md } = useMedia();
  const [settings] = useSettingsPersistAtom();
  const currency = settings.currencyInfo.symbol;
  const intl = useIntl();

  if (!md) return [];

  return [
    {
      title: intl.formatMessage({ id: ETranslations.global_name }),
      titleProps: { paddingBottom: '$2', paddingLeft: '$3' },
      dataIndex: 'tokenInfo',
      columnWidth: '50%',
      render: (_, record: IMarketToken) => {
        return (
          <XStack alignItems="center" ml="$3">
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
    },
  ];
};
