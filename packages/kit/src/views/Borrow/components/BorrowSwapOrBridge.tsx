import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import { Button, SizableText, XStack } from '@onekeyhq/components';
import type { IXStackProps } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IBorrowToken } from '@onekeyhq/shared/types/staking';
import type { IToken } from '@onekeyhq/shared/types/token';

import { useSupplyActions } from '../hooks/useSupplyActions';

type IBorrowSwapOrBridgeProps = {
  token: IToken;
  accountId: string;
  networkId: string;
  containerStyle?: IXStackProps;
};

const defaultSwapConfig = {
  isSupportSwap: false,
  isSupportCrossChain: false,
};

export function BorrowSwapOrBridge({
  token,
  accountId,
  networkId,
  containerStyle,
}: IBorrowSwapOrBridgeProps) {
  const intl = useIntl();
  const {
    activeAccount: { wallet, indexedAccount },
  } = useActiveAccount({ num: 0 });

  const { result: swapConfig = defaultSwapConfig } = usePromiseResult(
    async () => {
      if (!networkId) {
        return defaultSwapConfig;
      }
      return backgroundApiProxy.serviceSwap.checkSupportSwap({ networkId });
    },
    [networkId],
    { initResult: defaultSwapConfig },
  );

  const showSwap = swapConfig.isSupportSwap || swapConfig.isSupportCrossChain;
  const showBridge = swapConfig.isSupportCrossChain;

  const borrowToken = useMemo<IBorrowToken>(
    () => ({
      networkId,
      address: token.address,
      name: token.name,
      symbol: token.symbol,
      decimals: token.decimals,
      logoURI: token.logoURI ?? '',
    }),
    [
      networkId,
      token.address,
      token.decimals,
      token.logoURI,
      token.name,
      token.symbol,
    ],
  );

  const { handleSwap, handleBridge } = useSupplyActions({
    accountId,
    walletId: wallet?.id ?? '',
    networkId,
    indexedAccountId: indexedAccount?.id,
    swapConfig,
  });

  const handleSwapPress = useCallback(() => {
    if (!showSwap) return;
    void handleSwap?.({ token: borrowToken });
  }, [borrowToken, handleSwap, showSwap]);

  const handleBridgePress = useCallback(() => {
    if (!showBridge) return;
    void handleBridge?.({ token: borrowToken });
  }, [borrowToken, handleBridge, showBridge]);

  return (
    <XStack ai="center" jc="space-between" pt="$5" {...containerStyle}>
      <SizableText size="$bodyMd" color="$textSubdued">
        {intl.formatMessage(
          { id: ETranslations.earn_not_enough_token },
          { token: token.symbol },
        )}
      </SizableText>
      <XStack gap="$2">
        <Button size="small" onPress={handleSwapPress} disabled={!showSwap}>
          {intl.formatMessage({ id: ETranslations.global_swap })}
        </Button>
        <Button size="small" onPress={handleBridgePress} disabled={!showBridge}>
          {intl.formatMessage({ id: ETranslations.swap_page_bridge })}
        </Button>
      </XStack>
    </XStack>
  );
}
