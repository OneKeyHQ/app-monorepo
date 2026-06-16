import { memo, useCallback, useEffect, useState } from 'react';

import { useIntl } from 'react-intl';

import { Button, XStack } from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
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
import type { IAccountToken, ITokenFiat } from '@onekeyhq/shared/types/token';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { useAccountData } from '../../hooks/useAccountData';
import { useUserWalletProfile } from '../../hooks/useUserWalletProfile';
import { useActiveAccount } from '../../states/jotai/contexts/accountSelector';

import { useTokenListViewContext } from './TokenListViewContext';

import type { XStackProps } from 'tamagui';

// Stable module-level empty default so the non-home fallback does not hand a
// fresh `{}` to the sort effect's deps every render.
const EMPTY_FIAT_MAP: Record<string, ITokenFiat> = {};

type IProps = {
  token: IAccountToken;
} & XStackProps;

function TokenActionsView(props: IProps) {
  const { token, ...rest } = props;
  const intl = useIntl();
  const { activeAccount } = useActiveAccount({ num: 0 });
  const { tokenListMap: contextTokenListMap, ownedAggregateTokenListMap } =
    useTokenListViewContext();
  // PR-6/PR-7: the legacy `tokenListMapAtom` / `aggregateTokensListMapAtom` are
  // deleted; the wrapper threads the visible map + the owned aggregate sub-token
  // list-map through context instead.
  const tokenListMap = contextTokenListMap ?? EMPTY_FIAT_MAP;

  const [activeToken, setActiveToken] = useState<IAccountToken>(token);

  const { network, deriveType } = useAccountData({
    accountId: activeToken.accountId,
    networkId: activeToken.networkId,
  });

  useEffect(() => {
    let isStale = false;
    const setActiveAggregateToken = async () => {
      if (!token.isAggregateToken) {
        if (!isStale) {
          setActiveToken(token);
        }
        return;
      }

      const aggregateTokens = ownedAggregateTokenListMap?.[token.$key]?.tokens;
      if (!aggregateTokens?.length) {
        if (!isStale) {
          setActiveToken(token);
        }
        return;
      }

      const sortedAggregateTokens = sortTokensCommon({
        tokens: aggregateTokens,
        tokenListMap,
      });

      let _activeToken = sortedAggregateTokens[0];
      let firstCrossChainToken: IAccountToken | undefined;
      let foundSwapToken = false;

      for (const _token of sortedAggregateTokens) {
        try {
          const { isSupportSwap, isSupportCrossChain } =
            await backgroundApiProxy.serviceSwap.checkSupportSwap({
              networkId: _token.networkId ?? '',
            });
          if (isStale) {
            return;
          }
          if (isSupportSwap) {
            _activeToken = _token;
            foundSwapToken = true;
            break;
          }
          if (!firstCrossChainToken && isSupportCrossChain) {
            firstCrossChainToken = _token;
          }
        } catch {
          // Use the next candidate if a capability refresh fails.
        }
      }

      if (!foundSwapToken && firstCrossChainToken) {
        _activeToken = firstCrossChainToken;
      }

      if (!isStale && _activeToken) {
        setActiveToken(_activeToken);
      }
    };
    void setActiveAggregateToken();
    return () => {
      isStale = true;
    };
  }, [token, ownedAggregateTokenListMap, tokenListMap]);

  const { isSoftwareWalletOnlyUser } = useUserWalletProfile();
  const navigation = useAppNavigation();

  const handleTokenOnSwap = useCallback(() => {
    void (async () => {
      const networkId =
        activeToken.networkId ?? activeAccount?.network?.id ?? '';
      const isBtcNativeToken =
        networkId === getNetworkIdsMap().btc &&
        activeToken.isNative &&
        activeToken.symbol?.toUpperCase() === 'BTC' &&
        !activeToken.address;
      const importFromToken: ISwapToken | undefined = !isBtcNativeToken
        ? {
            contractAddress: activeToken.address,
            symbol: activeToken.symbol,
            networkId,
            isNative: activeToken.isNative,
            decimals: activeToken.decimals,
            name: activeToken.name,
            logoURI: activeToken.logoURI,
            networkLogoURI: network?.logoURI ?? activeAccount?.network?.logoURI,
          }
        : undefined;
      let importToToken: ISwapToken | undefined;
      if (networkId && importFromToken) {
        try {
          const { isSupportSwap, isSupportCrossChain } =
            await backgroundApiProxy.serviceSwap.checkSupportSwap({
              networkId,
            });
          if (!isSupportSwap && isSupportCrossChain) {
            importToToken = getSwapBridgeDefaultToToken(importFromToken);
          }
        } catch {
          // Keep the existing Swap fallback if capability refresh fails.
        }
      }

      defaultLogger.wallet.walletActions.actionTrade({
        walletType: activeAccount?.wallet?.type ?? '',
        networkId,
        source: 'homeTokenList',
        tradeType: ESwapTabSwitchType.SWAP,
        isSoftwareWalletOnlyUser,
      });
      navigation.pushModal(EModalRoutes.SwapModal, {
        screen: EModalSwapRoutes.SwapMainLand,
        params: {
          importNetworkId: networkId,
          importFromToken,
          importToToken,
          importDeriveType: deriveType,
          swapTabSwitchType: ESwapTabSwitchType.SWAP,
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
