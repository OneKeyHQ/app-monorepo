import React, { useCallback, useMemo } from 'react';

import { Token } from '@onekeyhq/engine/src/types/token';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useAppSelector, useNavigation } from '../../../hooks';
import ReceivingTokenSelector from '../components/ReceivingTokenSelector';
import { ReceivingTokenSelectorContext } from '../components/ReceivingTokenSelector/context';
import { networkSupportedTokens, swftOnlyNetwork } from '../config';
import { useSwapState } from '../hooks/useSwap';

const Output = () => {
  const navigation = useNavigation();
  const { inputToken } = useSwapState();
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
      return networkSupportedTokens[receivingNetworkId];
    }
    if (receivingNetworkId && swftOnlyNetwork.includes(receivingNetworkId)) {
      return networkSupportedTokens[receivingNetworkId];
    }
    return undefined;
  }, [receivingNetworkId, inputToken]);

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
