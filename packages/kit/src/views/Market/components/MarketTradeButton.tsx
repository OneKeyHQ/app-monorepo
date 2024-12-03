import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import type {
  IActionListItemProps,
  IPageNavigationProp,
} from '@onekeyhq/components';
import { ActionList, Button, IconButton, XStack } from '@onekeyhq/components';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IModalSwapParamList } from '@onekeyhq/shared/src/routes';
import { EModalRoutes } from '@onekeyhq/shared/src/routes/modal';
import { EModalSwapRoutes } from '@onekeyhq/shared/src/routes/swap';
import type { IMarketTokenDetail } from '@onekeyhq/shared/types/market';
import {
  getImportFromToken,
  getNetworkIdBySymbol,
} from '@onekeyhq/shared/types/market/marketProvider.constants';
import { ESwapTabSwitchType } from '@onekeyhq/shared/types/swap/types';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import useAppNavigation from '../../../hooks/useAppNavigation';

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

  const networkIdsMap = getNetworkIdsMap();
  const navigation =
    useAppNavigation<IPageNavigationProp<IModalSwapParamList>>();

  const sections = useMemo(
    () => [
      {
        items: [
          {
            icon: 'PlusLargeSolid',
            label: intl.formatMessage({ id: ETranslations.global_buy }),
            onPress: () => {},
          },
          {
            icon: 'MinusLargeSolid',
            label: intl.formatMessage({ id: ETranslations.global_sell }),
            onPress: () => {},
          },
        ] as IActionListItemProps[],
      },
    ],
    [intl],
  );

  const isShowStackButton = true;

  const handleOnSwap = useCallback(async () => {
    const { onekeyNetworkId, contract_address: contractAddress } =
      network || {};
    const networkId = onekeyNetworkId ?? getNetworkIdBySymbol(symbol);
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
  }, [logoURI, name, navigation, network, symbol]);
  return (
    <XStack $gtMd={{ mt: '$6' }} ai="center" gap="$4">
      <XStack gap="$2.5" flex={1}>
        <Button flex={1} variant="primary" onPress={handleOnSwap}>
          {intl.formatMessage({ id: ETranslations.global_trade })}
        </Button>
        {isShowStackButton ? (
          <Button
            flex={1}
            variant="secondary"
            onPress={() => {
              navigation.pushModal(EModalRoutes.SwapModal, {
                screen: EModalSwapRoutes.SwapMainLand,
                params: {
                  importToToken: {
                    symbol: 'ETH',
                    networkId: networkIdsMap.eth,
                    contractAddress:
                      '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
                  },
                  swapTabSwitchType: ESwapTabSwitchType.SWAP,
                },
              });
            }}
          >
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
