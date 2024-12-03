import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import type {
  IActionListItemProps,
  IPageNavigationProp,
} from '@onekeyhq/components';
import {
  ActionList,
  Button,
  IconButton,
  Toast,
  XStack,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  EModalStakingRoutes,
  type IModalSwapParamList,
} from '@onekeyhq/shared/src/routes';
import { EModalRoutes } from '@onekeyhq/shared/src/routes/modal';
import { EModalSwapRoutes } from '@onekeyhq/shared/src/routes/swap';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';
import { isSupportStaking } from '@onekeyhq/shared/types/earn/earnProvider.constants';
import type { IFiatCryptoType } from '@onekeyhq/shared/types/fiatCrypto';
import type { IMarketTokenDetail } from '@onekeyhq/shared/types/market';
import {
  getImportFromToken,
  getNetworkIdBySymbol,
} from '@onekeyhq/shared/types/market/marketProvider.constants';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { useActiveAccount } from '../../../states/jotai/contexts/accountSelector';

export function MarketTradeButton({
  coinGeckoId,
  token,
}: {
  coinGeckoId: string;
  token: IMarketTokenDetail;
}) {
  const { detailPlatforms, image: logoURI, symbol, name } = token;
  console.log('MarketTradeButton---', token, coinGeckoId);
  const network = useMemo(
    () =>
      detailPlatforms.ethereum ||
      detailPlatforms.solana ||
      detailPlatforms.base ||
      Object.values(detailPlatforms)[0],
    [detailPlatforms],
  );
  const intl = useIntl();

  const navigation =
    useAppNavigation<IPageNavigationProp<IModalSwapParamList>>();

  const { activeAccount } = useActiveAccount({ num: 0 });

  const isShowStakingButton = useMemo(() => isSupportStaking(symbol), [symbol]);

  const networkId = useMemo(() => {
    const { onekeyNetworkId } = network || {};
    return onekeyNetworkId ?? getNetworkIdBySymbol(symbol);
  }, [network, symbol]);

  const contractAddress = useMemo(
    () => network?.contract_address ?? '',
    [network],
  );

  const handleBuyOrSell = useCallback(
    async (type: IFiatCryptoType) => {
      if (!activeAccount.account || !networkId) {
        return;
      }

      const deriveType =
        await backgroundApiProxy.serviceNetwork.getGlobalDeriveTypeOfNetwork({
          networkId,
        });
      const dbAccount =
        await backgroundApiProxy.serviceAccount.getNetworkAccount({
          accountId: undefined,
          indexedAccountId: activeAccount.account.indexedAccountId,
          networkId,
          deriveType,
        });
      const { url } =
        await backgroundApiProxy.serviceFiatCrypto.generateWidgetUrl({
          networkId,
          tokenAddress: contractAddress,
          accountId: dbAccount.id,
          type,
        });
      if (!url) {
        Toast.error({ title: 'Failed to get widget url' });
        return;
      }
      openUrlExternal(url);
    },
    [activeAccount.account, contractAddress, networkId],
  );

  const sections = useMemo(
    () => [
      {
        items: [
          {
            icon: 'PlusLargeSolid',
            label: intl.formatMessage({ id: ETranslations.global_buy }),
            onPress: () => handleBuyOrSell('buy'),
          },
          {
            icon: 'MinusLargeSolid',
            label: intl.formatMessage({ id: ETranslations.global_sell }),
            onPress: () => handleBuyOrSell('sell'),
          },
        ] as IActionListItemProps[],
      },
    ],
    [handleBuyOrSell, intl],
  );

  const handleOnSwap = useCallback(async () => {
    if (!networkId) {
      navigation.pushModal(EModalRoutes.SwapModal, {
        screen: EModalSwapRoutes.SwapMainLand,
        params: {},
      });
      return;
    }
    const { isSupportSwap } =
      await backgroundApiProxy.serviceSwap.checkSupportSwap({
        networkId,
        contractAddress,
      });
    const onekeyNetwork = await backgroundApiProxy.serviceNetwork.getNetwork({
      networkId,
    });
    const importFromTokenResponse = getImportFromToken({
      networkId,
      isSupportSwap,
      tokenSymbol: symbol,
      contractAddress,
    });
    const { importFromToken, swapTabSwitchType } =
      importFromTokenResponse || {};
    navigation.pushModal(EModalRoutes.SwapModal, {
      screen: EModalSwapRoutes.SwapMainLand,
      params: {
        importToToken: {
          ...onekeyNetwork,
          contractAddress,
          networkId,
          logoURI,
          networkLogoURI: onekeyNetwork.logoURI,
          symbol: symbol.toUpperCase(),
          name,
        },
        importFromToken,
        swapTabSwitchType,
      },
    });
  }, [contractAddress, logoURI, name, navigation, networkId, symbol]);

  const handleStack = useCallback(() => {
    if (networkId && activeAccount.account) {
      navigation.pushModal(EModalRoutes.StakingModal, {
        screen: EModalStakingRoutes.AssetProtocolList,
        params: {
          networkId,
          accountId: activeAccount.account?.id,
          indexedAccountId: activeAccount.indexedAccount?.id,
          symbol,
        },
      });
    }
  }, [
    activeAccount.account,
    activeAccount.indexedAccount,
    navigation,
    networkId,
    symbol,
  ]);
  return (
    <XStack $gtMd={{ mt: '$6' }} ai="center" gap="$4">
      <XStack gap="$2.5" flex={1}>
        <Button flex={1} variant="primary" onPress={handleOnSwap}>
          {intl.formatMessage({ id: ETranslations.global_trade })}
        </Button>
        {isShowStakingButton ? (
          <Button flex={1} variant="secondary" onPress={handleStack}>
            {intl.formatMessage({ id: ETranslations.earn_stake })}
          </Button>
        ) : null}
      </XStack>
      <ActionList
        title={symbol.toUpperCase() || ''}
        renderTrigger={
          <IconButton
            title={intl.formatMessage({ id: ETranslations.global_more })}
            icon="DotVerSolid"
            variant="tertiary"
            iconSize="$5"
          />
        }
        sections={sections}
      />
    </XStack>
  );
}
