import type { ReactElement } from 'react';
import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useBotWalletDeactivatedStatus } from '@onekeyhq/kit/src/hooks/useBotWalletDeactivatedStatus';
import { useReceiveToken } from '@onekeyhq/kit/src/hooks/useReceiveToken';
import { useUserWalletProfile } from '@onekeyhq/kit/src/hooks/useUserWalletProfile';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import {
  useAllTokenListAtom,
  useAllTokenListMapAtom,
  useTokenListStateAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/tokenList';
import { showBotWalletDisabledToast } from '@onekeyhq/kit/src/utils/botWalletDisabledToast';
import { shouldBlockBotWalletReceive } from '@onekeyhq/kit/src/utils/botWalletStatusUtils';
import { WALLET_TYPE_WATCHING } from '@onekeyhq/shared/src/consts/dbConsts';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import type { IWalletActionBaseParams } from '@onekeyhq/shared/src/logger/scopes/wallet/scenes/walletActions';

import { HomeTestIDs } from '../../testIDs';

import { RawActions } from './RawActions';

import type { IActionCustomization } from './types';

function WalletActionReceive({
  customization,
  renderTrigger,
  source,
  variant,
  sameModal,
  useSelector,
  showButtonStyle,
  highlighted,
}: {
  customization?: IActionCustomization;
  renderTrigger?: (props: {
    onPress: () => void;
    disabled: boolean;
  }) => ReactElement;
  source?: IWalletActionBaseParams['source'];
  variant?: IWalletActionBaseParams['variant'];
  sameModal?: boolean;
  useSelector?: boolean;
  showButtonStyle?: boolean;
  highlighted?: boolean;
} = {}) {
  const intl = useIntl();
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
  const { isBotWallet, isBotWalletDeactivated } = useBotWalletDeactivatedStatus(
    {
      walletId: wallet?.id,
    },
  );

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
      showBotWalletDisabledToast('receive');
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
      variant,
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
    variant,
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
      highlighted={Boolean(highlighted && !isReceiveDisabled)}
      onPress={handleReceiveOnPress}
      label={
        customization?.labelId
          ? intl.formatMessage({ id: customization.labelId })
          : undefined
      }
      icon={customization?.icon}
      showButtonStyle={showButtonStyle}
      trackID="wallet-receive"
      testID={HomeTestIDs.receiveButton}
    />
  );
}

export { WalletActionReceive };
