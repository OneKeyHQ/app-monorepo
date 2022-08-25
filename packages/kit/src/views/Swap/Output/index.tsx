import React, { useCallback, useMemo } from 'react';

import { Token } from '@onekeyhq/engine/src/types/token';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useAppSelector, useNavigation } from '../../../hooks';
import ReceivingTokenSelector from '../components/ReceivingTokenSelector';
import { ReceivingTokenSelectorContext } from '../components/ReceivingTokenSelector/context';
import { useSwapState } from '../hooks/useSwap';
import { getChainIdFromNetworkId } from '../utils';

const Output = () => {
  const navigation = useNavigation();
  const { inputToken } = useSwapState();
  const swftcSupportedTokens = useAppSelector(
    (s) => s.swap.swftcSupportedTokens,
  );
  const receivingNetworkId = useAppSelector((s) => s.swap.receivingNetworkId);

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
      receivingNetworkId &&
      receivingNetworkId !== inputToken.networkId
    ) {
      const chainId = getChainIdFromNetworkId(receivingNetworkId);
      return swftcSupportedTokens[chainId];
    }
    return undefined;
  }, [receivingNetworkId, swftcSupportedTokens, inputToken]);

  const onSelectNetworkId = useCallback((networkid?: string) => {
    backgroundApiProxy.serviceSwap.setReceivingNetworkId(networkid);
  }, []);

  const value = useMemo(
    () => ({
      networkId: receivingNetworkId,
      setNetworkId: onSelectNetworkId,
      selectedToken: inputToken,
    }),
    [receivingNetworkId, onSelectNetworkId, inputToken],
  );

  return (
    <ReceivingTokenSelectorContext.Provider value={value}>
      <ReceivingTokenSelector included={included} onSelect={onSelect} />
    </ReceivingTokenSelectorContext.Provider>
  );
};

export default Output;
