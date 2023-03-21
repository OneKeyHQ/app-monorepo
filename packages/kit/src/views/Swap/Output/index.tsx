import { useCallback, useEffect, useMemo, useState } from 'react';

import type { Token } from '@onekeyhq/engine/src/types/token';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useAppSelector, useNavigation } from '../../../hooks';
import TokenSelector from '../components/TokenSelector';
import { TokenSelectorContext } from '../components/TokenSelector/context';
import { useSwapRecipient } from '../hooks/useSwap';
import { useSwapTokenList } from '../hooks/useSwapTokenUtils';

const Output = () => {
  const navigation = useNavigation();

  const inputToken = useAppSelector((s) => s.swap.inputToken);
  const outputToken = useAppSelector((s) => s.swap.outputToken);
  const tokenList = useAppSelector((s) => s.swapTransactions.tokenList);
  const recipient = useSwapRecipient();

  const [networkSelectorId, onSelectNetworkId] = useState<string | undefined>(
    () => {
      const networkIds = (tokenList ?? []).map((item) => item.networkId);
      if (outputToken && networkIds.includes(outputToken.networkId)) {
        return outputToken.networkId;
      }
      return undefined;
    },
  );

  const tokens = useSwapTokenList(networkSelectorId);

  const onSelect = useCallback(
    (token: Token) => {
      backgroundApiProxy.serviceSwap.setOutputToken(token);
      navigation.goBack();
    },
    [navigation],
  );

  const value = useMemo(
    () => ({
      networkId: networkSelectorId,
      setNetworkId: onSelectNetworkId,
      selectedToken: inputToken,
      accountId: recipient?.accountId,
    }),
    [networkSelectorId, onSelectNetworkId, inputToken, recipient?.accountId],
  );

  useEffect(() => {
    backgroundApiProxy.serviceSwap.fetchSwapTokenBalance({
      accountId: recipient?.accountId,
      networkId: networkSelectorId,
    });
  }, [networkSelectorId, recipient?.accountId]);

  useEffect(() => {
    if (networkSelectorId && recipient?.accountId) {
      backgroundApiProxy.servicePrice.fetchSimpleTokenPrice({
        accountId: recipient?.accountId,
        networkId: networkSelectorId,
        tokenIds: tokens.map((item) => item.tokenIdOnNetwork),
      });
    }
  }, [tokens, networkSelectorId, recipient?.accountId]);

  return (
    <TokenSelectorContext.Provider value={value}>
      <TokenSelector onSelect={onSelect} />
    </TokenSelectorContext.Provider>
  );
};

export default Output;
