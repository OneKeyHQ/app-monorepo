import React, { useEffect } from 'react';

import { Network } from '@onekeyhq/engine/src/types/network';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { useAppSelector, usePrevious } from '../../hooks';
import { useActiveWalletAccount } from '../../hooks/redux';

import { useEnabledSwappableNetworks } from './hooks/useSwap';
import { refs } from './refs';
import { isNetworkEnabled } from './utils';

const NetworkObserver = () => {
  const { network } = useActiveWalletAccount();
  const prevNetowrk = usePrevious(network);
  useEffect(() => {
    async function resetNativeToken(baseNetwork: Network) {
      const nativeToken = await backgroundApiProxy.serviceToken.getNativeToken(
        baseNetwork.id,
      );
      if (nativeToken && refs.inputIsDirty === false) {
        backgroundApiProxy.serviceSwap.selectToken(
          'INPUT',
          baseNetwork,
          nativeToken,
        );
        backgroundApiProxy.serviceSwap.setSendingAccountByNetwork(baseNetwork);
      }
      backgroundApiProxy.serviceSwap.setNetworkSelectorId(baseNetwork.id);
    }
    function main() {
      if (network && isNetworkEnabled(network)) {
        if (prevNetowrk === undefined) {
          resetNativeToken(network);
        }
      }
    }
    main();
    return () => {
      refs.inputIsDirty = false;
    };
  }, [network, prevNetowrk]);
  return null;
};

const AccountsObserver = () => {
  const accounts = useAppSelector((s) => s.runtime.accounts);
  useEffect(() => {
    backgroundApiProxy.serviceSwap.refreshSendingAccount();
  }, [accounts]);
  return null;
};

const TokenUpdater = () => {
  const { accountId } = useActiveWalletAccount();
  const enabledNetworks = useEnabledSwappableNetworks();
  useEffect(() => {
    backgroundApiProxy.serviceToken.getEnabledNativeTokens({
      forceUpdate: true,
    });
  }, []);
  useEffect(() => {
    async function main() {
      for (let i = 0; i < enabledNetworks.length; i += 1) {
        const network = enabledNetworks[i];
        await backgroundApiProxy.serviceToken.fetchTokensIfEmpty({
          activeAccountId: accountId,
          activeNetworkId: network.id,
        });
        await backgroundApiProxy.serviceToken.fetchAccountTokensIfEmpty({
          activeAccountId: accountId,
          activeNetworkId: network.id,
        });
      }
    }
    main();
  }, [accountId, enabledNetworks]);
  return null;
};

const SwapListener = () => (
  <>
    <NetworkObserver />
    <AccountsObserver />
    <TokenUpdater />
  </>
);

export default SwapListener;
