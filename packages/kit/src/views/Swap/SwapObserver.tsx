import React, { useEffect } from 'react';

import { Network } from '@onekeyhq/engine/src/types/network';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { usePrevious } from '../../hooks';
import { useActiveWalletAccount } from '../../hooks/redux';
import {
  setSelectedNetworkId,
  setSwftcSupportedTokens,
} from '../../store/reducers/swap';

import { useEnabledEvmNetworks } from './hooks/useSwap';
import { SwapQuoter } from './quoter';
import { refs } from './refs';

const AccountObserver = () => {
  const { account } = useActiveWalletAccount();
  useEffect(() => {
    backgroundApiProxy.serviceSwap.setApprovalSubmitted(false);
  }, [account]);
  return <></>;
};

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
      backgroundApiProxy.dispatch(setSelectedNetworkId(baseNetwork.id));
    }
    function main() {
      if (network) {
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
          // Empty block
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

const PreparatoryWork = () => {
  const { accountId } = useActiveWalletAccount();
  const enabledEvmNetworks = useEnabledEvmNetworks();
  useEffect(() => {
    async function main() {
      const supportedTokens = await SwapQuoter.client.getSupportedTokens();
      backgroundApiProxy.dispatch(setSwftcSupportedTokens(supportedTokens));
    }
    main();
  }, []);
  useEffect(() => {
    async function main() {
      for (let i = 0; i < enabledEvmNetworks.length; i += 1) {
        const network = enabledEvmNetworks[i];
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
  }, [accountId, enabledEvmNetworks]);
  return null;
};

const SwapListener = () => (
  <>
    <AccountObserver />
    <NetworkObserver />
    <PreparatoryWork />
  </>
);

export default SwapListener;
