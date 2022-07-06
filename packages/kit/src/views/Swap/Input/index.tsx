import React, { useCallback, useMemo } from 'react';

import { useAppSelector, useNavigation } from '../../../hooks';
import { useRuntime } from '../../../hooks/redux';
import TokenSelector from '../components/TokenSelector';
import { NetworkSelectorContext } from '../components/TokenSelector/context';
import { useSwapActionHandlers, useSwapState } from '../hooks/useSwap';
import { getChainIdFromNetworkId } from '../utils';

import type { Token } from '../../../store/typings';

const Input = () => {
  const navigation = useNavigation();
  const { networks } = useRuntime();
  const { outputToken } = useSwapState();
  const selectedNetworkId = useAppSelector((s) => s.swap.selectedNetworkId);
  const swftcSupportedTokens = useAppSelector(
    (s) => s.swap.swftcSupportedTokens,
  );
  const { onSelectToken, onSelectNetworkId } = useSwapActionHandlers();

  const onSelect = useCallback(
    (token: Token) => {
      const network = networks.filter((n) => n.id === token.networkId)[0];
      if (network) {
        onSelectToken(token, 'INPUT', network);
      }
      navigation.goBack();
    },
    [navigation, onSelectToken, networks],
  );

  const included = useMemo(() => {
    if (
      outputToken &&
      selectedNetworkId &&
      outputToken.networkId !== selectedNetworkId
    ) {
      const chainId = getChainIdFromNetworkId(selectedNetworkId);
      return swftcSupportedTokens[chainId];
    }
    return undefined;
  }, [outputToken, selectedNetworkId, swftcSupportedTokens]);

  const excluded = useMemo(() => {
    if (outputToken && outputToken.networkId === selectedNetworkId) {
      return [outputToken.tokenIdOnNetwork];
    }
    return undefined;
  }, [selectedNetworkId, outputToken]);

  const value = useMemo(
    () => ({
      showNetworkSelector: true,
      networkId: selectedNetworkId ?? '',
      setNetworkId: onSelectNetworkId,
    }),
    [selectedNetworkId, onSelectNetworkId],
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
