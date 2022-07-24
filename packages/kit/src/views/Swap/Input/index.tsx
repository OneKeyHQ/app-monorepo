import React, { useCallback, useMemo } from 'react';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useAppSelector, useNavigation } from '../../../hooks';
import { useActiveWalletAccount, useRuntime } from '../../../hooks/redux';
import TokenSelector from '../components/TokenSelector';
import { NetworkSelectorContext } from '../components/TokenSelector/context';
import { useSwapState } from '../hooks/useSwap';
import { getChainIdFromNetworkId } from '../utils';

import type { Token } from '../../../store/typings';

const Input = () => {
  const navigation = useNavigation();
  const { networks } = useRuntime();
  const { outputToken } = useSwapState();
  const { networkId } = useActiveWalletAccount();
  const selectedNetworkId = useAppSelector((s) => s.swap.selectedNetworkId);
  const swftcSupportedTokens = useAppSelector(
    (s) => s.swap.swftcSupportedTokens,
  );
  const onSelect = useCallback(
    (token: Token) => {
      const network = networks.filter((n) => n.id === token.networkId)[0];
      if (network) {
        backgroundApiProxy.serviceSwap.selectToken('INPUT', network, token);
      }
      navigation.goBack();
    },
    [navigation, networks],
  );

  const included = useMemo(() => {
    if (outputToken && outputToken.networkId !== networkId) {
      const chainId = getChainIdFromNetworkId(networkId);
      return swftcSupportedTokens[chainId];
    }
    return undefined;
  }, [outputToken, networkId, swftcSupportedTokens]);

  const excluded = useMemo(() => {
    if (selectedNetworkId === networkId && outputToken) {
      return [outputToken.tokenIdOnNetwork];
    }
    return undefined;
  }, [networkId, selectedNetworkId, outputToken]);

  const value = useMemo(
    () => ({ showNetworkSelector: false, networkId }),
    [networkId],
  );

  return (
    <NetworkSelectorContext.Provider value={value}>
      <TokenSelector
        included={included}
        excluded={excluded}
        onSelect={onSelect}
      />
    </NetworkSelectorContext.Provider>
  );
};

export default Input;
