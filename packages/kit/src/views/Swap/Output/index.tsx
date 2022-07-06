import React, { useCallback, useMemo } from 'react';

import { Token } from '@onekeyhq/engine/src/types/token';

import { useAppSelector, useNavigation } from '../../../hooks';
import { useRuntime } from '../../../hooks/redux';
import TokenSelector from '../components/TokenSelector';
import { NetworkSelectorContext } from '../components/TokenSelector/context';
import { useSwapActionHandlers, useSwapState } from '../hooks/useSwap';
import { getChainIdFromNetworkId } from '../utils';

const Output = () => {
  const navigation = useNavigation();
  const { networks } = useRuntime();
  const { inputToken } = useSwapState();
  const { onSelectToken, onSelectNetworkId } = useSwapActionHandlers();
  const swftcSupportedTokens = useAppSelector(
    (s) => s.swap.swftcSupportedTokens,
  );
  const selectedNetworkId = useAppSelector((s) => s.swap.selectedNetworkId);
  const onSelect = useCallback(
    (token: Token) => {
      const network = networks.filter((n) => n.id === token.networkId)[0];
      if (network) {
        onSelectToken(token, 'OUTPUT', network);
      }
      navigation.goBack();
    },
    [navigation, onSelectToken, networks],
  );

  const included = useMemo(() => {
    if (
      selectedNetworkId &&
      inputToken &&
      selectedNetworkId !== inputToken.networkId
    ) {
      const chainId = getChainIdFromNetworkId(selectedNetworkId);
      return swftcSupportedTokens[chainId];
    }
    return undefined;
  }, [selectedNetworkId, swftcSupportedTokens, inputToken]);

  const excluded = useMemo(() => {
    if (inputToken && inputToken.networkId === selectedNetworkId) {
      return [inputToken.tokenIdOnNetwork];
    }
    return undefined;
  }, [selectedNetworkId, inputToken]);

  const value = useMemo(
    () => ({
      showNetworkSelector: true,
      networkId: selectedNetworkId ?? '',
      setNetworkId: onSelectNetworkId,
    }),
    [selectedNetworkId, onSelectNetworkId],
  );

  if (!selectedNetworkId) {
    return <></>;
  }

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

export default Output;
