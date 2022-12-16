import { useCallback, useMemo, useState } from 'react';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import {
  useActiveWalletAccount,
  useAppSelector,
  useNavigation,
} from '../../../hooks';
import TokenSelector from '../components/TokenSelector';
import { TokenSelectorContext } from '../components/TokenSelector/context';

import type { Token } from '../../../store/typings';

const Input = () => {
  const navigation = useNavigation();
  const { network } = useActiveWalletAccount();
  const outputToken = useAppSelector((s) => s.swap.outputToken);
  const inputToken = useAppSelector((s) => s.swap.inputToken);
  const tokenList = useAppSelector((s) => s.swapTransactions.tokenList);
  const [networkSelectorId, onSelectNetworkId] = useState<string | undefined>(
    () => {
      const networkIds = (tokenList ?? []).map((item) => item.networkId);
      if (inputToken && networkIds.includes(inputToken.networkId)) {
        return inputToken.networkId;
      }
      return undefined;
    },
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
