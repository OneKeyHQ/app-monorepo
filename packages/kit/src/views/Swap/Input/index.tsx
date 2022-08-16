import React, { useCallback, useMemo } from 'react';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useAppSelector, useNavigation } from '../../../hooks';
import TokenSelector from '../components/TokenSelector';
import { NetworkSelectorContext } from '../components/TokenSelector/context';
import { useSwapState } from '../hooks/useSwap';
import { getChainIdFromNetworkId } from '../utils';

import type { Token } from '../../../store/typings';

const Input = () => {
  const navigation = useNavigation();
  const { outputToken } = useSwapState();
  const swftcSupportedTokens = useAppSelector(
    (s) => s.swap.swftcSupportedTokens,
  );
  const selectedNetworkId = useAppSelector((s) => s.swap.selectedNetworkId);
  const onSelect = useCallback(
    (token: Token) => {
      backgroundApiProxy.serviceSwap.setInputToken(token);
      navigation.goBack();
    },
    [navigation],
  );

  const included = useMemo(() => {
    if (
      outputToken &&
      selectedNetworkId &&
      selectedNetworkId !== outputToken.networkId
    ) {
      const chainId = getChainIdFromNetworkId(selectedNetworkId);
      return swftcSupportedTokens[chainId];
    }
    return undefined;
  }, [selectedNetworkId, swftcSupportedTokens, outputToken]);

  const onSelectNetworkId = useCallback((networkid?: string) => {
    backgroundApiProxy.serviceSwap.selectNetworkId(networkid);
  }, []);

  const value = useMemo(
    () => ({
      networkId: selectedNetworkId ?? '',
      setNetworkId: onSelectNetworkId,
      selectedToken: outputToken,
    }),
    [outputToken, selectedNetworkId, onSelectNetworkId],
  );

  return (
    <NetworkSelectorContext.Provider value={value}>
      <TokenSelector included={included} onSelect={onSelect} />
    </NetworkSelectorContext.Provider>
  );
};

export default Input;
