import { useCallback, useEffect, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import type { Token } from '@onekeyhq/engine/src/types/token';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useAppSelector, useNavigation } from '../../../hooks';
import TokenSelector from '../components/TokenSelector';
import { TokenSelectorContext } from '../components/TokenSelector/context';
import { useSwapRecipient } from '../hooks/useSwap';

import type { NetworkOption } from '../components/TokenSelector/context';

const Output = () => {
  const intl = useIntl();
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

  const networkOptions = useMemo<NetworkOption[]>(() => {
    if (!tokenList) {
      return [];
    }
    return tokenList.map((item) => {
      const name =
        item.name.toLowerCase() === 'all'
          ? intl.formatMessage({ id: 'option__all' })
          : item.name;
      return {
        name,
        networkId:
          item.name.toLowerCase() === 'all' ? undefined : item.networkId,
        logoURI: item.logoURI,
      };
    });
  }, [tokenList, intl]);

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
      tokenList,
      networkOptions,
    }),
    [
      networkSelectorId,
      onSelectNetworkId,
      inputToken,
      recipient?.accountId,
      tokenList,
      networkOptions,
    ],
  );

  useEffect(() => {
    backgroundApiProxy.serviceSwap.fetchSwapTokenBalance({
      accountId: recipient?.accountId,
      networkId: networkSelectorId,
    });
  }, [networkSelectorId, recipient?.accountId]);

  return (
    <TokenSelectorContext.Provider value={value}>
      <TokenSelector onSelect={onSelect} />
    </TokenSelectorContext.Provider>
  );
};

export default Output;
