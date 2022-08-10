import React, { useCallback, useMemo } from 'react';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useAppSelector, useNavigation } from '../../../hooks';
import { useActiveWalletAccount } from '../../../hooks/redux';
import TokenSelector from '../components/TokenSelector';
import { NetworkSelectorContext } from '../components/TokenSelector/context';
import { useSwapState } from '../hooks/useSwap';
import { getChainIdFromNetworkId } from '../utils';

import type { Token } from '../../../store/typings';

const Input = () => {
  const navigation = useNavigation();
  const { outputToken } = useSwapState();
  const { networkId } = useActiveWalletAccount();
  const swftcSupportedTokens = useAppSelector(
    (s) => s.swap.swftcSupportedTokens,
  );
  const onSelect = useCallback(
    (token: Token) => {
      backgroundApiProxy.serviceSwap.setInputToken(token);
      navigation.goBack();
    },
    [navigation],
  );

  const included = useMemo(() => {
    if (outputToken && outputToken.networkId !== networkId) {
      const chainId = getChainIdFromNetworkId(networkId);
      return swftcSupportedTokens[chainId];
    }
    return undefined;
  }, [outputToken, networkId, swftcSupportedTokens]);

  const value = useMemo(
    () => ({
      showNetworkSelector: false,
      networkId,
      selectedToken: outputToken,
    }),
    [networkId, outputToken],
  );

  return (
    <NetworkSelectorContext.Provider value={value}>
      <TokenSelector included={included} onSelect={onSelect} />
    </NetworkSelectorContext.Provider>
  );
};

export default Input;
