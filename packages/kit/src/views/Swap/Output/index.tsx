import { useCallback, useEffect, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import type { Token } from '@onekeyhq/engine/src/types/token';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useAppSelector, useNavigation } from '../../../hooks';
import TokenSelectorControl from '../components/TokenSelectorControl';
import { TokenSelectorControlContext } from '../components/TokenSelectorControl/context';
import { useSwapRecipient } from '../hooks/useSwap';

import type { NetworkOption } from '../components/TokenSelectorControl/context';

const all = 'all';

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

  const [previousNetworkSelectorId, setPreviousNetworkSelectorId] = useState<
    string | undefined
  >(
    inputToken?.networkId === outputToken?.networkId
      ? undefined
      : outputToken?.networkId,
  );

  useEffect(() => {
    if (networkSelectorId && networkSelectorId !== inputToken?.networkId) {
      setPreviousNetworkSelectorId(networkSelectorId);
    }
  }, [networkSelectorId, inputToken]);

  const data = useMemo<{
    actives: NetworkOption[];
    inactives: NetworkOption[];
  }>(() => {
    if (!tokenList) {
      return { actives: [], inactives: [] };
    }
    let items = tokenList
      .filter((item) => item.name && item.networkId)
      .map((item) => {
        const name =
          item.name.toLowerCase() === all
            ? intl.formatMessage({ id: 'option__all' })
            : item.name;
        const networkId =
          item.name.toLowerCase() === all ? undefined : item.networkId;
        return {
          name,
          networkId,
          logoURI: item.logoURI,
        };
      }) as NetworkOption[];

    const getScore = (item: NetworkOption): number => {
      if (!item.networkId) {
        return -10;
      }
      if (item.networkId === inputToken?.networkId) {
        return -9;
      }
      if (
        previousNetworkSelectorId &&
        item.networkId === previousNetworkSelectorId
      ) {
        return -8;
      }
      return 0;
    };

    items = items.sort((a, b) => {
      const numA = getScore(a);
      const numB = getScore(b);
      return numA - numB;
    });
    const len = previousNetworkSelectorId ? 3 : 2;
    const actives: NetworkOption[] = items.slice(0, len);
    const inactives: NetworkOption[] = items.slice(len);

    return { actives, inactives };
  }, [tokenList, intl, inputToken, previousNetworkSelectorId]);

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
      networkOptions: data.actives,
      more: data.inactives.length,
    }),
    [
      networkSelectorId,
      onSelectNetworkId,
      inputToken,
      recipient?.accountId,
      tokenList,
      data,
    ],
  );

  useEffect(() => {
    backgroundApiProxy.serviceSwap.fetchSwapTokenBalance({
      accountId: recipient?.accountId,
      networkId: networkSelectorId,
    });
  }, [networkSelectorId, recipient?.accountId]);

  return (
    <TokenSelectorControlContext.Provider value={value}>
      <TokenSelectorControl onSelect={onSelect} />
    </TokenSelectorControlContext.Provider>
  );
};

export default Output;
