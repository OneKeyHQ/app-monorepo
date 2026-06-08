import { memo, useCallback, useEffect, useState } from 'react';

import { useIntl } from 'react-intl';

import { Button, XStack } from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { EModalRoutes, EModalSwapRoutes } from '@onekeyhq/shared/src/routes';
import { sortTokensCommon } from '@onekeyhq/shared/src/utils/tokenUtils';
import { getSwapBridgeDefaultToToken } from '@onekeyhq/shared/types/swap/SwapProvider.constants';
import {
  ESwapSource,
  ESwapTabSwitchType,
  type ISwapToken,
} from '@onekeyhq/shared/types/swap/types';
import type { IAccountToken } from '@onekeyhq/shared/types/token';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { useAccountData } from '../../hooks/useAccountData';
import { useUserWalletProfile } from '../../hooks/useUserWalletProfile';
import { useActiveAccount } from '../../states/jotai/contexts/accountSelector';
import {
  useAggregateTokensListMapAtom,
  useTokenListMapAtom,
} from '../../states/jotai/contexts/tokenList';

import { useTokenListViewContext } from './TokenListViewContext';

import type { XStackProps } from 'tamagui';

type IProps = {
  token: IAccountToken;
} & XStackProps;

function TokenActionsView(props: IProps) {
  const { token, ...rest } = props;
  const intl = useIntl();
  const { activeAccount } = useActiveAccount({ num: 0 });
  const { tokenListMap: contextTokenListMap } = useTokenListViewContext();
  const [globalTokenListMap] = useTokenListMapAtom();
  const tokenListMap = contextTokenListMap ?? globalTokenListMap;
  const [aggregateTokenListMapAtom] = useAggregateTokensListMapAtom();

  const [activeToken, setActiveToken] = useState<IAccountToken>(token);

  const { network, deriveType } = useAccountData({
    accountId: activeToken.accountId,
    networkId: activeToken.networkId,
  });

  useEffect(() => {
    const setActiveAggregateToken = async () => {
      if (!token.isAggregateToken) {
        setActiveToken(token);
        return;
      }

      const aggregateTokens = aggregateTokenListMapAtom[token.$key]?.tokens;
      if (aggregateTokens) {
        const sortedAggregateTokens = sortTokensCommon({
          tokens: aggregateTokens,
          tokenListMap,
        });

        let _activeToken = sortedAggregateTokens[0];
        let firstCrossChainToken: IAccountToken | undefined;
        let foundSwapToken = false;

        for (const _token of sortedAggregateTokens) {
          const { isSupportSwap, isSupportCrossChain } =
            await backgroundApiProxy.serviceSwap.checkSupportSwap({
              networkId: _token.networkId ?? '',
            });
          if (isSupportSwap) {
            _activeToken = _token;
            foundSwapToken = true;
            break;
          }
          if (!firstCrossChainToken && isSupportCrossChain) {
            firstCrossChainToken = _token;
          }
        }

        if (!foundSwapToken && firstCrossChainToken) {
          _activeToken = firstCrossChainToken;
        }

        if (_activeToken) {
          setActiveToken(_activeToken);
        }
      }
    };
    void setActiveAggregateToken();
  }, [token, aggregateTokenListMapAtom, tokenListMap]);

  const { isSoftwareWalletOnlyUser } = useUserWalletProfile();
  const navigation = useAppNavigation();

  const handleTokenOnSwap = useCallback(() => {
    void (async () => {
      const activeNetworkId =
        activeToken.networkId ?? activeAccount?.network?.id ?? '';
      const importFromToken: ISwapToken = {
        contractAddress: activeToken.address,
        symbol: activeToken.symbol,
        networkId: activeNetworkId,
        isNative: activeToken.isNative,
        decimals: activeToken.decimals,
        name: activeToken.name,
        logoURI: activeToken.logoURI,
        networkLogoURI: network?.logoURI ?? activeAccount?.network?.logoURI,
      };
      let importToToken: ISwapToken | undefined;
      if (activeNetworkId) {
        try {
          const { isSupportSwap, isSupportCrossChain } =
            await backgroundApiProxy.serviceSwap.checkSupportSwap({
              networkId: activeNetworkId,
            });
          if (!isSupportSwap && isSupportCrossChain) {
            importToToken = getSwapBridgeDefaultToToken(importFromToken);
          }
        } catch {
          // Keep the existing Swap fallback if capability refresh fails.
        }
      }

      const swapTabSwitchType = ESwapTabSwitchType.SWAP;
      defaultLogger.wallet.walletActions.actionTrade({
        walletType: activeAccount?.wallet?.type ?? '',
        networkId: activeNetworkId,
        source: 'homeTokenList',
        tradeType: swapTabSwitchType,
        isSoftwareWalletOnlyUser,
      });

      navigation.pushModal(EModalRoutes.SwapModal, {
        screen: EModalSwapRoutes.SwapMainLand,
        params: {
          importNetworkId: activeNetworkId,
          importFromToken,
          importToToken,
          importDeriveType: deriveType,
          swapTabSwitchType,
          swapSource: ESwapSource.WALLET_HOME_TOKEN_LIST,
        },
      });
    })();
  }, [
    activeAccount,
    activeToken,
    isSoftwareWalletOnlyUser,
    navigation,
    network,
    deriveType,
  ]);

  if (!token) {
    return null;
  }

  return (
    <XStack {...rest}>
      <Button
        testID="token-actions-swap-btn"
        size="small"
        variant="secondary"
        cursor="pointer"
        onPress={handleTokenOnSwap}
      >
        {intl.formatMessage({ id: ETranslations.global_swap })}
      </Button>
    </XStack>
  );
}

export default memo(TokenActionsView);
