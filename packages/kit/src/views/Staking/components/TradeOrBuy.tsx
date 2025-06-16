import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { Button, SizableText, XStack } from '@onekeyhq/components';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IToken } from '@onekeyhq/shared/types/token';

import { useActiveAccount } from '../../../states/jotai/contexts/accountSelector';
import ActionBuy from '../../AssetDetails/pages/TokenDetails/ActionBuy';
import { HomeTokenListProviderMirror } from '../../Home/components/HomeTokenListProvider/HomeTokenListProviderMirror';
import { useHandleSwap } from '../hooks/useHandleSwap';

function BasicTradeOrBuy({
  token,
  accountId,
  networkId,
}: {
  token: IToken;
  accountId: string;
  networkId: string;
}) {
  const {
    activeAccount: { wallet },
  } = useActiveAccount({ num: 0 });
  const networkIdsMap = getNetworkIdsMap();
  const intl = useIntl();
  const { handleSwap } = useHandleSwap();

  const handleOnSwap = useCallback(async () => {
    await handleSwap({ token, networkId });
  }, [handleSwap, token, networkId]);

  const isHiddenComponent = networkId === networkIdsMap.cosmoshub;

  if (isHiddenComponent) {
    return null;
  }

  return (
    <XStack ai="center" jc="space-between" pt="$5">
      <SizableText size="$bodyMd" color="$textSubdued">
        {intl.formatMessage(
          { id: ETranslations.earn_not_enough_token },
          { token: token.symbol },
        )}
      </SizableText>
      <XStack gap="$2">
        <Button size="small" onPress={handleOnSwap}>
          {intl.formatMessage({ id: ETranslations.global_trade })}
        </Button>
        <ActionBuy
          hiddenIfDisabled
          showButtonStyle
          size="small"
          networkId={networkId}
          accountId={accountId}
          walletType={wallet?.type}
          walletId={wallet?.id ?? ''}
          tokenAddress={token.address}
          tokenSymbol={token.symbol}
          source="earn"
        />
      </XStack>
    </XStack>
  );
}

export function TradeOrBuy({
  token,
  accountId,
  networkId,
}: {
  token: IToken;
  accountId: string;
  networkId: string;
}) {
  return (
    <HomeTokenListProviderMirror>
      <BasicTradeOrBuy
        token={token}
        accountId={accountId}
        networkId={networkId}
      />
    </HomeTokenListProviderMirror>
  );
}
