import type { ReactElement } from 'react';
import { useCallback, useMemo } from 'react';

import { Toast } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useReceiveToken } from '@onekeyhq/kit/src/hooks/useReceiveToken';
import { useUserWalletProfile } from '@onekeyhq/kit/src/hooks/useUserWalletProfile';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import {
  useAllTokenListAtom,
  useAllTokenListMapAtom,
  useTokenListStateAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/tokenList';
import { shouldBlockBotWalletReceive } from '@onekeyhq/kit/src/utils/botWalletStatusUtils';
import { WALLET_TYPE_WATCHING } from '@onekeyhq/shared/src/consts/dbConsts';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import type { IWalletActionBaseParams } from '@onekeyhq/shared/src/logger/scopes/wallet/scenes/walletActions';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

import { RawActions } from './RawActions';

import type { IActionCustomization } from './types';

function WalletActionReceive({
  customization,
  renderTrigger,
  source,
  sameModal,
  useSelector,
  showButtonStyle,
}: {
  customization?: IActionCustomization;
  renderTrigger?: (props: {
    onPress: () => void;
    disabled: boolean;
  }) => ReactElement;
  source?: IWalletActionBaseParams['source'];
  sameModal?: boolean;
  useSelector?: boolean;
  showButtonStyle?: boolean;
} = {}) {
  const {
    activeAccount: {
      network,
      account,
      wallet,
      deriveInfoItems,
      indexedAccount,
    },
  } = useActiveAccount({ num: 0 });

  const [allTokens] = useAllTokenListAtom();
  const [map] = useAllTokenListMapAtom();
  const [tokenListState] = useTokenListStateAtom();
  const isBotWallet = useMemo(
    () => accountUtils.isBotWallet({ walletId: wallet?.id }),
    [wallet?.id],
  );
  const { result: isBotWalletDeactivatedResult } = usePromiseResult(
    async () => {
      if (!wallet?.id || !isBotWallet) {
        return false;
      }

      return backgroundApiProxy.serviceAccount.isBotWalletDeactivated({
        walletId: wallet.id,
      });
    },
    [wallet?.id, isBotWallet],
    {
      checkIsFocused: false,
    },
  );
  const isBotWalletDeactivated = !!isBotWalletDeactivatedResult;

  const isReceiveDisabled = useMemo(() => {
    if (wallet?.type === WALLET_TYPE_WATCHING) {
      return true;
    }
    return shouldBlockBotWalletReceive({
      isBotWallet,
      isBotWalletDeactivated,
    });
  }, [wallet?.type, isBotWallet, isBotWalletDeactivated]);

  const { handleOnReceive } = useReceiveToken({
    accountId: account?.id ?? '',
    networkId: network?.id ?? '',
    walletId: wallet?.id ?? '',
    indexedAccountId: indexedAccount?.id ?? '',
    tokens: {
      data: allTokens.tokens,
      keys: allTokens.keys,
      map,
    },
    tokenListState,
    isMultipleDerive: deriveInfoItems.length > 1,
  });

  const { isSoftwareWalletOnlyUser } = useUserWalletProfile();
  const handleReceiveOnPress = useCallback(async () => {
    if (
      shouldBlockBotWalletReceive({
        isBotWallet,
        isBotWalletDeactivated,
      })
    ) {
      Toast.error({
        title: '该钱包已停用，无法接收资产',
      });
      return;
    }

    if (
      await backgroundApiProxy.serviceAccount.checkIsWalletNotBackedUp({
        walletId: wallet?.id ?? '',
      })
    ) {
      return;
    }
    defaultLogger.wallet.walletActions.actionReceive({
      walletType: wallet?.type ?? '',
      networkId: network?.id ?? '',
      source: source ?? 'homePage',
      isSoftwareWalletOnlyUser,
    });
    if (customization?.onPress) {
      void customization.onPress();
    } else {
      void handleOnReceive({
        withAllAggregateTokens: network?.isAllNetworks,
        sameModal,
        useSelector,
      });
    }
  }, [
    wallet?.id,
    wallet?.type,
    network?.id,
    network?.isAllNetworks,
    isBotWallet,
    isBotWalletDeactivated,
    source,
    isSoftwareWalletOnlyUser,
    customization,
    handleOnReceive,
    sameModal,
    useSelector,
  ]);

  if (renderTrigger) {
    return renderTrigger({
      disabled: customization?.disabled ?? isReceiveDisabled,
      onPress: handleReceiveOnPress,
    });
  }

  return (
    <RawActions.Receive
      disabled={customization?.disabled ?? isReceiveDisabled}
      allowPressWhenDisabled={isBotWalletDeactivated}
      onPress={handleReceiveOnPress}
      label={customization?.label}
      icon={customization?.icon}
      showButtonStyle={showButtonStyle}
      trackID="wallet-receive"
    />
  );
}

export { WalletActionReceive };
