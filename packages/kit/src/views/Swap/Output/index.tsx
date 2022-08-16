import React, { useCallback, useMemo } from 'react';

import { Token } from '@onekeyhq/engine/src/types/token';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useAppSelector, useNavigation } from '../../../hooks';
import TokenSelector from '../components/TokenSelector';
import { NetworkSelectorContext } from '../components/TokenSelector/context';
import { useSwapState } from '../hooks/useSwap';
import { getChainIdFromNetworkId } from '../utils';

const Output = () => {
  const navigation = useNavigation();
  const { inputToken } = useSwapState();
  const swftcSupportedTokens = useAppSelector(
    (s) => s.swap.swftcSupportedTokens,
  );
  const selectedNetworkId = useAppSelector((s) => s.swap.selectedNetworkId);
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
      selectedNetworkId &&
      selectedNetworkId !== inputToken.networkId
    ) {
      const chainId = getChainIdFromNetworkId(selectedNetworkId);
      return swftcSupportedTokens[chainId];
    }
    return undefined;
  }, [selectedNetworkId, swftcSupportedTokens, inputToken]);

  const onSelectNetworkId = useCallback((networkid?: string) => {
    backgroundApiProxy.serviceSwap.selectNetworkId(networkid);
  }, []);

  const value = useMemo(
    () => ({
      networkId: selectedNetworkId ?? '',
      setNetworkId: onSelectNetworkId,
      selectedToken: inputToken,
    }),
    [selectedNetworkId, onSelectNetworkId, inputToken],
  );

  if (!selectedNetworkId) {
    return <></>;
  }

  return (
    <NetworkSelectorContext.Provider value={value}>
      <TokenSelector included={included} onSelect={onSelect} />
    </NetworkSelectorContext.Provider>
  );
};

export default Output;
