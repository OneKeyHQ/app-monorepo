import { useIntl } from 'react-intl';

import { NumberSizeableText } from '@onekeyhq/components';
import type { ITableColumn } from '@onekeyhq/components';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { TokenIdentityItem } from '../components/TokenIdentityItem';
import { Txns } from '../components/Txns';
import { type IMarketToken } from '../MarketTokenData';

export const useMarketTokenColumns = (): ITableColumn<IMarketToken>[] => {
  const [settings] = useSettingsPersistAtom();
  const currency = settings.currencyInfo.symbol;
  const intl = useIntl();

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
        />
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
      align: 'right',
    },
    {
      title: intl.formatMessage({ id: ETranslations.global_liquidity }),
      dataIndex: 'liquidity',
      columnWidth: 150,
      render: (text: number) => (
        <NumberSizeableText
          size="$bodyMd"
          formatter="value"
          formatterOptions={{ currency }}
        >
          {text}
        </NumberSizeableText>
      ),
      align: 'right',
    },
    {
      title: intl.formatMessage({ id: ETranslations.dexmarket_txns }),
      dataIndex: 'transactions',
      columnWidth: 100,
      render: (text: number, record) => (
        <Txns transactions={text} walletInfo={record.walletInfo} />
      ),
      align: 'right',
    },
    {
      title: intl.formatMessage({ id: ETranslations.dexmarket_traders }),
      dataIndex: 'uniqueTraders',
      columnWidth: 100,
      render: (text: number) => (
        <NumberSizeableText size="$bodyMd" formatter="balance">
          {text * 1000}
        </NumberSizeableText>
      ),
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
      align: 'right',
    },
  ];
};
