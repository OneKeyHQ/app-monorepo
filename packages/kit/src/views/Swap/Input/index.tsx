import React, { useCallback, useMemo, useState } from 'react';

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

  const inputToken = useAppSelector((s) => s.swap.inputToken);
  const [networkSelectorId, onSelectNetworkId] = useState<string | undefined>(
    inputToken?.networkId,
  );

  const onSelect = useCallback(
    (token: Token) => {
      backgroundApiProxy.serviceSwap.setInputToken(token);
      navigation.goBack();
    },
    [navigation],
  );

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
      <TokenSelector onSelect={onSelect} />
    </TokenSelectorContext.Provider>
  );
};

export default Input;
