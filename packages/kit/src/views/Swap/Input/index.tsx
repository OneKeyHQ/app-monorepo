import React, { useCallback, useMemo } from 'react';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import {
  useActiveWalletAccount,
  useAppSelector,
  useNavigation,
} from '../../../hooks';
import TokenSelector from '../components/TokenSelector';
import { TokenSelectorContext } from '../components/TokenSelector/context';
import { useSwapState } from '../hooks/useSwap';

import type { Token } from '../../../store/typings';

const Input = () => {
  const navigation = useNavigation();
  const { network } = useActiveWalletAccount();
  const { outputToken } = useSwapState();
  const swftcSupportedTokens = useAppSelector(
    (s) => s.swap.swftcSupportedTokens,
  );
  const sendingNetworkId = useAppSelector((s) => s.swap.sendingNetworkId);
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
      sendingNetworkId &&
      sendingNetworkId !== outputToken.networkId
    ) {
      return swftcSupportedTokens[sendingNetworkId];
    }
    if (sendingNetworkId && sendingNetworkId === 'sol--101') {
      return swftcSupportedTokens[sendingNetworkId];
    }
    return undefined;
  }, [sendingNetworkId, swftcSupportedTokens, outputToken]);

  const onSelectNetworkId = useCallback((networkid?: string) => {
    backgroundApiProxy.serviceSwap.setSendingNetworkId(networkid);
  }, []);

  const value = useMemo(
    () => ({
      impl: network?.impl,
      networkId: sendingNetworkId,
      setNetworkId: onSelectNetworkId,
      selectedToken: outputToken,
    }),
    [outputToken, sendingNetworkId, onSelectNetworkId, network?.impl],
  );

  return (
    <TokenSelectorContext.Provider value={value}>
      <TokenSelector included={included} onSelect={onSelect} />
    </TokenSelectorContext.Provider>
  );
};

export default Input;
