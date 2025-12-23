import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import BigNumber from 'bignumber.js';
import { isEmpty } from 'lodash';
import { useIntl } from 'react-intl';

import {
  NumberSizeableText,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useCurrency } from '@onekeyhq/kit/src/components/Currency';
import { ListLoading } from '@onekeyhq/kit/src/components/Loading';
import { Token } from '@onekeyhq/kit/src/components/Token';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useUserWalletProfile } from '@onekeyhq/kit/src/hooks/useUserWalletProfile';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { POLLING_DEBOUNCE_INTERVAL } from '@onekeyhq/shared/src/consts/walletConsts';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { EModalRoutes } from '@onekeyhq/shared/src/routes';
import { EModalSwapRoutes } from '@onekeyhq/shared/src/routes/swap';
import { getTokenPriceChangeStyle } from '@onekeyhq/shared/src/utils/tokenUtils';
import { getImportFromToken } from '@onekeyhq/shared/types/earn/earnProvider.constants';
import type { IPopularTrading } from '@onekeyhq/shared/types/swap/types';
import { ESwapSource } from '@onekeyhq/shared/types/swap/types';

import { RichBlock } from '../RichBlock/RichBlock';
import { RichTable } from '../RichTable';

function PopularTrading({ tableLayout }: { tableLayout?: boolean }) {
  const intl = useIntl();
  const currencyInfo = useCurrency();
  const {
    activeAccount: { wallet },
  } = useActiveAccount({ num: 0 });
  const { isSoftwareWalletOnlyUser } = useUserWalletProfile();
  const navigation = useAppNavigation();
  const [popularTrading, setPopularTrading] = useState<IPopularTrading[]>([]);

  const initializedRef = useRef(false);

  const columns = useMemo(() => {
    if (tableLayout) {
      return [
        {
          dataIndex: 'symbol',
          title: intl.formatMessage({ id: ETranslations.global_name }),
          render: (_: unknown, record: IPopularTrading, index: number) => (
            <XStack alignItems="center" gap="$2">
              <SizableText size="$bodyLgMedium" color="$textSubdued">
                {index + 1}
              </SizableText>
              <XStack alignItems="center" gap="$2">
                <Token
                  size="md"
                  tokenImageUri={record.tokenDetail?.info?.logoURI ?? ''}
                  networkId={record.networkId}
                  showNetworkIcon
                />
                <YStack>
                  <SizableText size="$bodyMdMedium">
                    {record.symbol}
                  </SizableText>
                  <SizableText size="$bodyMd" color="$textSubdued">
                    {record.tokenDetail?.info?.name ?? '-'}
                  </SizableText>
                </YStack>
              </XStack>
            </XStack>
          ),
        },
        {
          dataIndex: 'price',
          title: intl.formatMessage({ id: ETranslations.global_price }),
          render: (_: unknown, record: IPopularTrading) => (
            <NumberSizeableText
              size="$bodyMdMedium"
              formatter="price"
              formatterOptions={{ currency: currencyInfo?.symbol }}
            >
              {record.tokenDetail?.price ?? '-'}
            </NumberSizeableText>
          ),
        },
        {
          dataIndex: 'priceChange24h',
          title: 'change / 24h',
          render: (_: unknown, record: IPopularTrading) => {
            const { changeColor, showPlusMinusSigns } =
              getTokenPriceChangeStyle({
                priceChange: record.tokenDetail?.price24h ?? 0,
              });
            return (
              <NumberSizeableText
                formatter="priceChange"
                formatterOptions={{ showPlusMinusSigns }}
                color={changeColor}
                size="$bodyMdMedium"
              >
                {record.tokenDetail?.price24h ?? '-'}
              </NumberSizeableText>
            );
          },
        },
        {
          dataIndex: 'marketCap',
          title: intl.formatMessage({ id: ETranslations.global_market_cap }),
          render: (marketCap: number) => (
            <NumberSizeableText
              size="$bodyMdMedium"
              formatter="marketCap"
              formatterOptions={{ currency: currencyInfo?.symbol }}
            >
              {new BigNumber(marketCap).isNaN() ? '-' : marketCap}
            </NumberSizeableText>
          ),
        },
      ];
    }

    return [
      {
        dataIndex: 'symbol',
        title: intl.formatMessage({ id: ETranslations.global_name }),
        render: (_: unknown, record: IPopularTrading, index: number) => (
          <XStack alignItems="center" gap="$2" justifyContent="flex-end">
            <SizableText size="$bodyLgMedium" color="$textSubdued">
              {index + 1}
            </SizableText>
            <XStack alignItems="center" gap="$2">
              <Token
                size="lg"
                tokenImageUri={record.tokenDetail?.info?.logoURI ?? ''}
                networkId={record.networkId}
                showNetworkIcon
              />
              <YStack>
                <SizableText size="$bodyLgMedium">{record.symbol}</SizableText>
                <NumberSizeableText
                  size="$bodyMd"
                  formatter="marketCap"
                  formatterOptions={{ currency: currencyInfo?.symbol }}
                >
                  {new BigNumber(record.marketCap).isNaN()
                    ? '-'
                    : record.marketCap}
                </NumberSizeableText>
              </YStack>
            </XStack>
          </XStack>
        ),
      },
      {
        dataIndex: 'price',
        title: intl.formatMessage({ id: ETranslations.global_price }),
        render: (_: unknown, record: IPopularTrading) => {
          const { changeColor, showPlusMinusSigns } = getTokenPriceChangeStyle({
            priceChange: record.tokenDetail?.price24h ?? 0,
          });
          return (
            <YStack alignItems="flex-end">
              <NumberSizeableText
                size="$bodyLgMedium"
                formatter="price"
                formatterOptions={{ currency: currencyInfo?.symbol }}
              >
                {record.tokenDetail?.price ?? '-'}
              </NumberSizeableText>
              <NumberSizeableText
                formatter="priceChange"
                formatterOptions={{ showPlusMinusSigns }}
                color={changeColor}
                size="$bodyMd"
              >
                {record.tokenDetail?.price24h ?? '-'}
              </NumberSizeableText>
            </YStack>
          );
        },
      },
    ];
  }, [intl, currencyInfo?.symbol, tableLayout]);

  const { isLoading } = usePromiseResult(
    async () => {
      const result = await backgroundApiProxy.serviceSwap.fetchPopularTrading({
        limit: 3,
        saveToLocal: true,
      });
      setPopularTrading(result);
      initializedRef.current = true;
    },
    [],
    {
      watchLoading: true,
      debounced: POLLING_DEBOUNCE_INTERVAL,
    },
  );

  const renderContent = useCallback(() => {
    if (!initializedRef.current && isLoading) {
      return (
        <ListLoading
          listCount={3}
          listContainerProps={{ py: '$0' }}
          listHeaderProps={{ px: '$3' }}
          itemProps={{ px: tableLayout ? '$3' : '$0', mx: '$0' }}
        />
      );
    }

    return (
      <RichTable<IPopularTrading>
        showHeader={!!tableLayout}
        dataSource={popularTrading}
        columns={columns}
        keyExtractor={(item) => `${item.networkId}-${item.address}`}
        estimatedItemSize={56}
        rowProps={
          tableLayout
            ? undefined
            : {
                py: '$0',
                px: '$0',
              }
        }
        onRow={(record) => ({
          onPress: async () => {
            const { importFromToken, swapTabSwitchType } = getImportFromToken({
              networkId: record.networkId,
              tokenAddress: record.address,
              isSupportSwap: true,
            });

            defaultLogger.wallet.walletActions.actionTrade({
              walletType: wallet?.type ?? '',
              networkId: record.networkId,
              source: 'homePopularTrading',
              tradeType: swapTabSwitchType,
              isSoftwareWalletOnlyUser,
            });
            navigation.pushModal(EModalRoutes.SwapModal, {
              screen: EModalSwapRoutes.SwapMainLand,
              params: {
                importNetworkId: record.networkId,
                importFromToken,
                importToToken: {
                  contractAddress: record.address,
                  symbol: record.symbol,
                  networkId: record.networkId,
                  isNative: record.tokenDetail?.info?.isNative ?? false,
                  decimals: record.tokenDetail?.info?.decimals ?? 0,
                  name: record.tokenDetail?.info?.name ?? '-',
                  logoURI: record.tokenDetail?.info?.logoURI ?? '',
                },
                swapTabSwitchType,
                swapSource: ESwapSource.WALLET_HOME_POPULAR_TRADING,
              },
            });
          },
        })}
      />
    );
  }, [
    columns,
    popularTrading,
    isLoading,
    isSoftwareWalletOnlyUser,
    navigation,
    wallet?.type,
    tableLayout,
  ]);

  const initPopularTrading = useCallback(async () => {
    const result =
      await backgroundApiProxy.serviceSwap.getLocalPopularTrading();

    if (result && result.length > 0) {
      setPopularTrading(result);
      initializedRef.current = true;
    }
  }, []);

  useEffect(() => {
    void initPopularTrading();
  }, [initPopularTrading]);

  if (initializedRef.current && isEmpty(popularTrading)) {
    return null;
  }

  return (
    <RichBlock
      title={intl.formatMessage({ id: ETranslations.global_popular_trading })}
      content={renderContent()}
      contentContainerProps={{
        px: tableLayout ? '$2' : '$0',
      }}
      plainContentContainer={!tableLayout}
    />
  );
}

export { PopularTrading };
