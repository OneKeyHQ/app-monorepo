import React, { useCallback, useMemo } from 'react';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import {
  useActiveWalletAccount,
  useAppSelector,
  useNavigation,
} from '../../../hooks';
import TokenSelector from '../components/TokenSelector';
import { TokenSelectorContext } from '../components/TokenSelector/context';
import { networkSupportedTokens, swftOnlyNetwork } from '../config';
import { useSwapState } from '../hooks/useSwap';

import type { Token } from '../../../store/typings';

const Input = () => {
  const navigation = useNavigation();
  const { network } = useActiveWalletAccount();
  const { outputToken } = useSwapState();

  const networkSelectorId = useAppSelector((s) => s.swap.networkSelectorId);
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
      networkSelectorId &&
      networkSelectorId !== outputToken.networkId
    ) {
      return networkSupportedTokens[networkSelectorId];
    }
    if (networkSelectorId && swftOnlyNetwork.includes(networkSelectorId)) {
      return networkSupportedTokens[networkSelectorId];
    }
    return undefined;
  }, [networkSelectorId, outputToken]);

  const onSelectNetworkId = useCallback((networkid?: string) => {
    backgroundApiProxy.serviceSwap.setNetworkSelectorId(networkid);
  }, []);

  const value = useMemo(
    () => ({
      impl: network?.impl,
      networkId: networkSelectorId,
      setNetworkId: onSelectNetworkId,
      selectedToken: outputToken,
    }),
    [outputToken, networkSelectorId, onSelectNetworkId, network?.impl],
  );

  return (
    <TokenSelectorContext.Provider value={value}>
      <TokenSelector included={included} onSelect={onSelect} />
    </TokenSelectorContext.Provider>
  );
};

export default Input;
