import React, { useEffect } from 'react';

import { Network } from '@onekeyhq/engine/src/types/network';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { usePrevious } from '../../hooks';
import { useActiveWalletAccount } from '../../hooks/redux';
import {
  setSendingNetworkId,
  setSwftcSupportedTokens,
} from '../../store/reducers/swap';

import { useEnabledSwappableNetworks } from './hooks/useSwap';
import { SwapQuoter } from './quoter';
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
      }
      backgroundApiProxy.dispatch(setSendingNetworkId(baseNetwork.id));
    }
    async function main() {
      if (network && isNetworkEnabled(network)) {
        if (prevNetowrk === undefined) {
          // initial, select default native token
          resetNativeToken(network);
        } else if (network.impl === 'evm' && prevNetowrk?.impl !== 'evm') {
          backgroundApiProxy.serviceSwap.resetState();
          resetNativeToken(network);
        } else if (network.impl !== 'evm' && prevNetowrk?.impl === 'evm') {
          backgroundApiProxy.serviceSwap.resetState();
          resetNativeToken(network);
        } else if (network.impl === 'evm' && prevNetowrk?.impl === 'evm') {
          const inputToken =
            await backgroundApiProxy.serviceSwap.getSwapInputToken();
          if (!inputToken) {
            resetNativeToken(network);
          }
        } else {
          backgroundApiProxy.serviceSwap.resetState();
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

const PreWorker = () => {
  const { accountId } = useActiveWalletAccount();
  const enabledNetworks = useEnabledSwappableNetworks();
  useEffect(() => {
    async function main() {
      const supportedTokens = await SwapQuoter.client.getSupportedTokens();
      backgroundApiProxy.dispatch(setSwftcSupportedTokens(supportedTokens));
    }
    main();
  }, []);
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
    <PreWorker />
  </>
);

export default SwapListener;
