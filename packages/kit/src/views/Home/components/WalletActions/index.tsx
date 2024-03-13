import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import type { IPageNavigationProp } from '@onekeyhq/components';
import { useClipboard } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import {
  useAllTokenListAtom,
  useAllTokenListMapAtom,
  useTokenListStateAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/tokenList';
import { openUrl } from '@onekeyhq/kit/src/utils/openUrl';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  EAssetSelectorRoutes,
  EModalReceiveRoutes,
  EModalRoutes,
  EModalSendRoutes,
} from '@onekeyhq/shared/src/routes';
import type { IModalSendParamList } from '@onekeyhq/shared/src/routes';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import { buildExplorerAddressUrl } from '@onekeyhq/shared/src/utils/uriUtils';
import type { IToken } from '@onekeyhq/shared/types/token';

import { RawActions } from './RawActions';

function WalletActionBuy() {
  return <RawActions.Buy onPress={() => {}} />;
}

function WalletActionSend() {
  const navigation =
    useAppNavigation<IPageNavigationProp<IModalSendParamList>>();
  const {
    activeAccount: { account, network },
  } = useActiveAccount({ num: 0 });

  const [allTokens] = useAllTokenListAtom();
  const [map] = useAllTokenListMapAtom();
  const [tokenListState] = useTokenListStateAtom();

  const isSingleToken = usePromiseResult(async () => {
    const settings = await backgroundApiProxy.serviceNetwork.getVaultSettings({
      networkId: network?.id ?? '',
    });
    return settings.isSingleToken;
  }, [network?.id]).result;

  const handleOnSend = useCallback(async () => {
    if (!account || !network) return;
    if (isSingleToken) {
      const nativeToken = await backgroundApiProxy.serviceToken.getNativeToken({
        networkId: network.id,
        accountAddress: account.address,
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
    isSingleToken,
    map,
    navigation,
    network,
  ]);

  return (
    <RawActions.Send
      onPress={handleOnSend}
      disabled={!tokenListState.initialized}
    />
  );
}

function WalletActionReceive() {
  const {
    activeAccount: { account, network },
  } = useActiveAccount({ num: 0 });
  const navigation =
    useAppNavigation<IPageNavigationProp<IModalSendParamList>>();

  const handleOnReceive = useCallback(() => {
    if (!account || !network) return;
    navigation.pushModal(EModalRoutes.ReceiveModal, {
      screen: EModalReceiveRoutes.ReceiveToken,
      params: {
        networkId: network.id,
        accountId: account.id,
      },
    });
  }, [account, navigation, network]);

  return (
    <RawActions.Receive
      onPress={platformEnv.isDev ? handleOnReceive : () => {}}
    />
  );
}

function WalletActionSwap() {
  const handleOnSwap = useCallback(() => {}, []);
  return <RawActions.Swap onPress={handleOnSwap} />;
}

function ActionMore() {
  const {
    activeAccount: { account, network },
  } = useActiveAccount({ num: 0 });
  const intl = useIntl();
  const { copyText } = useClipboard();

  return (
    <RawActions.More
      sections={[
        {
          items: [
            {
              label: intl.formatMessage({ id: 'action__sell_crypto' }),
              icon: 'MinusLargeOutline',
              onPress: () => {},
            },
          ],
        },
        {
          items: [
            {
              label: intl.formatMessage({ id: 'action__view_in_explorer' }),
              icon: 'GlobusOutline',
              onPress: () =>
                openUrl(
                  buildExplorerAddressUrl({
                    network,
                    address: account?.address,
                  }),
                ),
            },
            {
              label: intl.formatMessage({ id: 'action__copy_address' }),
              icon: 'Copy1Outline',
              onPress: () => copyText(account?.address || ''),
            },
          ],
        },
      ]}
    />
  );
}

function WalletActions() {
  return (
    <RawActions>
      <WalletActionSend />
      <WalletActionReceive />
      <WalletActionBuy />
      <WalletActionSwap />
      <ActionMore />
    </RawActions>
  );
}

export { WalletActions };
