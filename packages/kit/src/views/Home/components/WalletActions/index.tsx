import { useCallback } from 'react';

import type { IPageNavigationProp, IXStackProps } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ReviewControl } from '@onekeyhq/kit/src/components/ReviewControl';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import {
  useAllTokenListAtom,
  useAllTokenListMapAtom,
  useTokenListStateAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/tokenList';
import type {
  IModalSendParamList,
  IModalSwapParamList,
} from '@onekeyhq/shared/src/routes';
import {
  EAssetSelectorRoutes,
  EModalRoutes,
  EModalSendRoutes,
  EModalSwapRoutes,
} from '@onekeyhq/shared/src/routes';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type { IToken } from '@onekeyhq/shared/types/token';

import { RawActions } from './RawActions';
import { WalletActionBuy } from './WalletActionBuy';
import { WalletActionMore } from './WalletActionMore';
import { WalletActionReceive } from './WalletActionReceive';

function WalletActionSend() {
  const navigation =
    useAppNavigation<IPageNavigationProp<IModalSendParamList>>();
  const {
    activeAccount: { account, network },
  } = useActiveAccount({ num: 0 });

  const [allTokens] = useAllTokenListAtom();
  const [map] = useAllTokenListMapAtom();
  const [tokenListState] = useTokenListStateAtom();

  const vaultSettings = usePromiseResult(async () => {
    const settings = await backgroundApiProxy.serviceNetwork.getVaultSettings({
      networkId: network?.id ?? '',
    });
    return settings;
  }, [network?.id]).result;

  const handleOnSend = useCallback(async () => {
    if (!account || !network) return;
    if (vaultSettings?.isSingleToken) {
      const nativeToken = await backgroundApiProxy.serviceToken.getNativeToken({
        networkId: network.id,
        accountId: account.id,
      });
      navigation.pushModal(EModalRoutes.SendModal, {
        screen: EModalSendRoutes.SendDataInput,
        params: {
          accountId: account.id,
          networkId: network.id,
          isNFT: false,
          token: nativeToken,
        },
      });
      return;
    }

    navigation.pushModal(EModalRoutes.AssetSelectorModal, {
      screen: EAssetSelectorRoutes.TokenSelector,
      params: {
        networkId: network.id,
        accountId: account.id,
        networkName: network.name,
        tokens: {
          data: allTokens.tokens,
          keys: allTokens.keys,
          map,
        },
        onSelect: async (token: IToken) => {
          await timerUtils.wait(600);
          navigation.pushModal(EModalRoutes.SendModal, {
            screen: EModalSendRoutes.SendDataInput,
            params: {
              accountId: account.id,
              networkId: network.id,
              isNFT: false,
              token,
            },
          });
        },
      },
    });
  }, [
    account,
    allTokens.keys,
    allTokens.tokens,
    vaultSettings,
    map,
    navigation,
    network,
  ]);

  return (
    <RawActions.Send
      onPress={handleOnSend}
      disabled={
        vaultSettings?.disabledSendAction || !tokenListState.initialized
      }
    />
  );
}

function WalletActionSwap({ networkId }: { networkId?: string }) {
  const navigation =
    useAppNavigation<IPageNavigationProp<IModalSwapParamList>>();
  const vaultSettings = usePromiseResult(async () => {
    const settings = await backgroundApiProxy.serviceNetwork.getVaultSettings({
      networkId: networkId ?? '',
    });
    return settings;
  }, [networkId]).result;
  const handleOnSwap = useCallback(() => {
    navigation.pushModal(EModalRoutes.SwapModal, {
      screen: EModalSwapRoutes.SwapMainLand,
      params: { importNetworkId: networkId },
    });
  }, [navigation, networkId]);
  return (
    <RawActions.Swap
      onPress={handleOnSwap}
      disabled={vaultSettings?.disabledSwapAction}
    />
  );
}

function WalletActions({ ...rest }: IXStackProps) {
  const {
    activeAccount: { network, account },
  } = useActiveAccount({ num: 0 });

  return (
    <RawActions {...rest}>
      <ReviewControl>
        <WalletActionBuy />
      </ReviewControl>
      <WalletActionSwap networkId={network?.id} />
      <WalletActionSend />
      <WalletActionReceive />
      <WalletActionMore />
    </RawActions>
  );
}

export { WalletActions };
