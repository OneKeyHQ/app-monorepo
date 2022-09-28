import React, { useCallback, useMemo } from 'react';

import { Token } from '@onekeyhq/engine/src/types/token';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useAppSelector, useNavigation } from '../../../hooks';
import TokenSelector from '../components/TokenSelector';
import { TokenSelectorContext } from '../components/TokenSelector/context';
import { networkSupportedTokens, swftOnlyNetwork } from '../config';
import { useSwapState } from '../hooks/useSwap';

const Output = () => {
  const navigation = useNavigation();
  const { inputToken } = useSwapState();
  const networkSelectorId = useAppSelector((s) => s.swap.networkSelectorId);

  const onSelect = useCallback(
    (token: Token) => {
      backgroundApiProxy.serviceSwap.setOutputToken(token);
      navigation.goBack();
    },
    [navigation],
  );

  const included = useMemo(() => {
    if (
      inputToken &&
      networkSelectorId &&
      networkSelectorId !== inputToken.networkId
    ) {
      return networkSupportedTokens[networkSelectorId];
    }
    if (networkSelectorId && swftOnlyNetwork.includes(networkSelectorId)) {
      return networkSupportedTokens[networkSelectorId];
    }
    return undefined;
  }, [networkSelectorId, inputToken]);

  const onSelectNetworkId = useCallback((networkid?: string) => {
    backgroundApiProxy.serviceSwap.setNetworkSelectorId(networkid);
  }, []);

  const value = useMemo(
    () => ({
      networkId: networkSelectorId,
      setNetworkId: onSelectNetworkId,
      selectedToken: inputToken,
    }),
    [networkSelectorId, onSelectNetworkId, inputToken],
  );

  return (
    <TokenSelectorContext.Provider value={value}>
      <TokenSelector included={included} onSelect={onSelect} />
    </TokenSelectorContext.Provider>
  );
};

export default Output;
