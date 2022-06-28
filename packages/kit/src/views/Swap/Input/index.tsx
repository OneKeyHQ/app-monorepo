import React, { useCallback, useMemo } from 'react';

import { useAppSelector, useNavigation } from '../../../hooks';
import { useActiveWalletAccount, useRuntime } from '../../../hooks/redux';
import TokenSelector from '../components/TokenSelector';
import { NetworkSelectorContext } from '../components/TokenSelector/context';
import { useSwapActionHandlers, useSwapState } from '../hooks/useSwap';
import { getChainIdFromNetworkId, nativeTokenAddress } from '../utils';

import type { Token } from '../../../store/typings';

const Input = () => {
  const navigation = useNavigation();
  const { networks } = useRuntime();
  const { outputToken } = useSwapState();
  const { networkId } = useActiveWalletAccount();
  const selectedNetworkId = useAppSelector((s) => s.swap.selectedNetworkId);
  const noSupportCoins = useAppSelector((s) => s.swap.noSupportCoins);
  const swftcSupportedTokens = useAppSelector(
    (s) => s.swap.swftcSupportedTokens,
  );
  const { onSelectToken } = useSwapActionHandlers();

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
    if (selectedNetworkId && selectedNetworkId !== networkId && outputToken) {
      const outputTokenNetworkId = outputToken.networkId;
      const inputChainId = getChainIdFromNetworkId(networkId);
      const outputChainId = getChainIdFromNetworkId(outputTokenNetworkId);
      const address = outputToken.tokenIdOnNetwork || nativeTokenAddress;
      return noSupportCoins[outputChainId]?.[address]?.[inputChainId];
    }
    return undefined;
  }, [networkId, selectedNetworkId, outputToken, noSupportCoins]);

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
