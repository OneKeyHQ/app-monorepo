import { memo, useCallback, useEffect, useState } from 'react';

import { useIntl } from 'react-intl';

import { Button, XStack } from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { EModalRoutes, EModalSwapRoutes } from '@onekeyhq/shared/src/routes';
import deriveTypeCollapseUtils from '@onekeyhq/shared/src/utils/deriveTypeCollapseUtils';
import { buildSwapSelectedTokensColdStartAccountKey } from '@onekeyhq/shared/src/utils/swapColdStartCacheSnapshotUtils';
import { isSwapEntryDisabledToken } from '@onekeyhq/shared/src/utils/swapEntryUtils';
import { sortTokensCommon } from '@onekeyhq/shared/src/utils/tokenUtils';
import {
  ESwapSource,
  ESwapTabSwitchType,
} from '@onekeyhq/shared/types/swap/types';
import type { IAccountToken, ITokenFiat } from '@onekeyhq/shared/types/token';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { useAccountData } from '../../hooks/useAccountData';
import { useUserWalletProfile } from '../../hooks/useUserWalletProfile';
import { useActiveAccount } from '../../states/jotai/contexts/accountSelector';

import {
  buildTokenActionSwapFromToken,
  getResolvedTokenActionToken,
  isResolvedTokenActionReady,
} from './TokenActionsView.utils';
import { useTokenListViewContext } from './TokenListViewContext';

import type { XStackProps } from 'tamagui';

// Stable module-level empty default so the non-home fallback does not hand a
// fresh `{}` to the sort effect's deps every render.
const EMPTY_FIAT_MAP: Record<string, ITokenFiat> = {};

type IProps = {
  token: IAccountToken;
  nativeActionState?: (state: {
    disabled: boolean;
    onPress: () => void;
  }) => void;
} & XStackProps;

function TokenActionsView(props: IProps) {
  const { token, nativeActionState, ...rest } = props;
  const intl = useIntl();
  const { activeAccount } = useActiveAccount({ num: 0 });
  const { tokenListMap: contextTokenListMap, ownedAggregateTokenListMap } =
    useTokenListViewContext();
  // PR-6/PR-7: the legacy `tokenListMapAtom` / `aggregateTokensListMapAtom` are
  // deleted; the wrapper threads the visible map + the owned aggregate sub-token
  // list-map through context instead.
  const tokenListMap = contextTokenListMap ?? EMPTY_FIAT_MAP;
  const aggregateTokens = ownedAggregateTokenListMap?.[token.$key]?.tokens;

  const [activeToken, setActiveToken] = useState<IAccountToken>(token);
  const resolvedActiveToken = getResolvedTokenActionToken({
    token,
    activeToken,
    aggregateTokens,
  });
  const accountDataToken = resolvedActiveToken ?? token;

  const { account, network, deriveType } = useAccountData({
    accountId: accountDataToken.accountId,
    networkId: accountDataToken.networkId,
  });
  const isTokenActionReady = isResolvedTokenActionReady({
    token,
    resolvedToken: resolvedActiveToken,
    resolvedAccountId: account?.id,
    resolvedNetworkId: network?.id,
  });
  const networkId =
    resolvedActiveToken?.networkId ?? activeAccount?.network?.id ?? '';
  const isSwapEntryDisabled = isSwapEntryDisabledToken({
    contractAddress: resolvedActiveToken?.address,
    isNative: resolvedActiveToken?.isNative,
    networkId: resolvedActiveToken?.networkId,
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
  }, [aggregateTokens, token, tokenListMap]);

  const { isSoftwareWalletOnlyUser } = useUserWalletProfile();
  const navigation = useAppNavigation();

  const handleTokenOnSwap = useCallback(() => {
    if (!resolvedActiveToken || !isTokenActionReady || isSwapEntryDisabled) {
      return;
    }

    const importAccountKey =
      buildSwapSelectedTokensColdStartAccountKey(activeAccount);
    const importFromToken = buildTokenActionSwapFromToken({
      token: resolvedActiveToken,
      networkId,
      networkLogoURI: network?.logoURI ?? activeAccount?.network?.logoURI,
    });
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
        importAccountKey,
        importFromToken,
        // A merged Bitcoin row carries whichever derive type answered
        // first, so it must not decide the type Swap uses (or the default).
        importDeriveType:
          deriveTypeCollapseUtils.isDeriveTypeCollapseSupportedNetwork({
            networkId,
          })
            ? undefined
            : deriveType,
        swapTabSwitchType: ESwapTabSwitchType.SWAP,
        swapSource: ESwapSource.WALLET_HOME_TOKEN_LIST,
      },
    });
  }, [
    activeAccount,
    isSoftwareWalletOnlyUser,
    navigation,
    network,
    deriveType,
    isTokenActionReady,
    isSwapEntryDisabled,
    networkId,
    resolvedActiveToken,
  ]);

  const swapDisabled = !isTokenActionReady || isSwapEntryDisabled;
  useEffect(() => {
    nativeActionState?.({
      disabled: swapDisabled,
      onPress: handleTokenOnSwap,
    });
  }, [nativeActionState, swapDisabled, handleTokenOnSwap]);

  if (!token) {
    return null;
  }

  if (nativeActionState) {
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
        disabled={swapDisabled}
      >
        {intl.formatMessage({ id: ETranslations.global_swap })}
      </Button>
    </XStack>
  );
}

export default memo(TokenActionsView);
