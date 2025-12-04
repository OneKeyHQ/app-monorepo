import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import {
  NumberSizeableText,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useCurrency } from '@onekeyhq/kit/src/components/Currency';
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
import type { IPopularTrading } from '@onekeyhq/shared/types/swap/types';
import {
  ESwapSource,
  ESwapTabSwitchType,
} from '@onekeyhq/shared/types/swap/types';

import { RichBlock } from '../RichBlock/RichBlock';
import { RichTable } from '../RichTable';

function PopularTrading() {
  const intl = useIntl();
  const currencyInfo = useCurrency();
  const {
    activeAccount: { wallet },
  } = useActiveAccount({ num: 0 });
  const { isSoftwareWalletOnlyUser } = useUserWalletProfile();
  const navigation = useAppNavigation();

  const columns = useMemo(() => {
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
                tokenImageUri={record.tokenDetail.info.logoURI}
                networkId={record.networkId}
                showNetworkIcon
              />
              <YStack>
                <SizableText size="$bodyMdMedium">{record.symbol}</SizableText>
                <SizableText size="$bodyMd" color="$textSubdued">
                  {record.tokenDetail.info.name}
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
            {record.tokenDetail.price}
          </NumberSizeableText>
        ),
      },
      {
        dataIndex: 'priceChange24h',
        title: 'change / 24h',
        render: (_: unknown, record: IPopularTrading) => {
          const { changeColor, showPlusMinusSigns } = getTokenPriceChangeStyle({
            priceChange: record.tokenDetail.price24h ?? 0,
          });
          return (
            <NumberSizeableText
              formatter="priceChange"
              formatterOptions={{ showPlusMinusSigns }}
              color={changeColor}
              size="$bodyMdMedium"
            >
              {record.tokenDetail.price24h}
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
            {marketCap}
          </NumberSizeableText>
        ),
      },
    ];
  }, [intl, currencyInfo?.symbol]);

  const { result: popularTrading } = usePromiseResult(
    async () => {
      const result = await backgroundApiProxy.serviceSwap.fetchPopularTrading();
      return result;
    },
    [],
    {
      initResult: [],
      watchLoading: true,
      debounced: POLLING_DEBOUNCE_INTERVAL,
    },
  );

  const renderContent = useCallback(() => {
    return (
      <RichTable<IPopularTrading>
        dataSource={popularTrading}
        columns={columns}
        keyExtractor={(item) => `${item.networkId}-${item.address}`}
        estimatedItemSize={56}
        onRow={(record) => ({
          onPress: () => {
            defaultLogger.wallet.walletActions.actionTrade({
              walletType: wallet?.type ?? '',
              networkId: record.networkId,
              source: 'homePopularTrading',
              tradeType: ESwapTabSwitchType.SWAP,
              isSoftwareWalletOnlyUser,
            });
            navigation.pushModal(EModalRoutes.SwapModal, {
              screen: EModalSwapRoutes.SwapMainLand,
              params: {
                importNetworkId: record.networkId,
                importToToken: {
                  contractAddress: record.address,
                  symbol: record.symbol,
                  networkId: record.networkId,
                  isNative: record.tokenDetail.info.isNative,
                  decimals: record.tokenDetail.info.decimals,
                  name: record.tokenDetail.info.name,
                  logoURI: record.tokenDetail.info.logoURI,
                },
                swapTabSwitchType: ESwapTabSwitchType.SWAP,
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
    isSoftwareWalletOnlyUser,
    navigation,
    wallet?.type,
  ]);

  return (
    <RichBlock
      title={intl.formatMessage({ id: ETranslations.global_popular_trading })}
      content={renderContent()}
      contentContainerProps={{
        px: '$2',
      }}
    />
  );
}

export { PopularTrading };
