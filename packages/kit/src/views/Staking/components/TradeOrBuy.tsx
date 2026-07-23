import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { Button, SizableText, XStack } from '@onekeyhq/components';
import type { IXStackProps } from '@onekeyhq/components';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IToken } from '@onekeyhq/shared/types/token';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { usePromiseResult } from '../../../hooks/usePromiseResult';
import { useActiveAccount } from '../../../states/jotai/contexts/accountSelector';
import ActionBuy from '../../AssetDetails/pages/TokenDetails/ActionBuy';
import { HomeTokenListProviderMirror } from '../../Home/components/HomeTokenListProvider/HomeTokenListProviderMirror';
import { useHandleSwap } from '../hooks/useHandleSwap';

function BasicTradeOrBuy({
  token,
  accountId,
  networkId,
  containerStyle,
}: {
  token: IToken;
  accountId: string;
  networkId: string;
  containerStyle?: IXStackProps;
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

  // Whether swap is available on this network. Some networks (e.g. Katana) are
  // not swap-supported yet, so the "Trade" button must not route to an empty
  // swap page. Treat the button as disabled until the backend confirms support
  // (default-disabled while resolving) so an unsupported network never flashes
  // an enabled state before settling to disabled.
  const { result: swapSupport } = usePromiseResult(
    () => backgroundApiProxy.serviceSwap.checkSupportSwap({ networkId }),
    [networkId],
  );
  const isSwapUnsupported = swapSupport?.isSupportSwap !== true;

  const isHiddenComponent = networkId === networkIdsMap.cosmoshub;

  if (isHiddenComponent) {
    return null;
  }

  return (
    <XStack ai="center" jc="space-between" pt="$5" {...containerStyle}>
      <SizableText size="$bodyMd" color="$textSubdued">
        {intl.formatMessage(
          { id: ETranslations.earn_not_enough_token },
          { token: token.symbol },
        )}
      </SizableText>
      <XStack gap="$2">
        <Button
          size="small"
          onPress={handleOnSwap}
          disabled={isSwapUnsupported}
          testID="staking-is-hidden-component-btn"
        >
          {intl.formatMessage({ id: ETranslations.global_trade })}
        </Button>
        <ActionBuy
          hiddenIfDisabled
          showButtonStyle
          size="small"
          label={intl.formatMessage({ id: ETranslations.global_buy })}
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
  containerStyle,
}: {
  token: IToken;
  accountId: string;
  networkId: string;
  containerStyle?: IXStackProps;
}) {
  return (
    <HomeTokenListProviderMirror>
      <BasicTradeOrBuy
        token={token}
        accountId={accountId}
        networkId={networkId}
        containerStyle={containerStyle}
      />
    </HomeTokenListProviderMirror>
  );
}
