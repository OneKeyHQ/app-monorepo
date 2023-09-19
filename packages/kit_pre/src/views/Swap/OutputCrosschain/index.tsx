import { useCallback, useEffect, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import type { Token } from '@onekeyhq/engine/src/types/token';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useAppSelector, useNavigation } from '../../../hooks';
import { useSwapRecipient } from '../hooks/useSwap';

import OutputCrosschainTokenSelector from './OutputCrosschainTokenSelector';
import { OutputCrosschainTokenSelectorContext } from './OutputCrosschainTokenSelector/context';

import type { NetworkOption } from './OutputCrosschainTokenSelector/context';

const all = 'all';

const OutputCrosschain = () => {
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
      return 0;
    };

    items = items.sort((a, b) => {
      const numA = getScore(a);
      const numB = getScore(b);
      return numA - numB;
    });

    const actives: NetworkOption[] = items.slice(0, 2);
    const inactives: NetworkOption[] = items.slice(2);

    if (networkSelectorId && networkSelectorId !== inputToken?.networkId) {
      const nIndex = inactives.findIndex(
        (o) => o.networkId === networkSelectorId,
      );
      if (nIndex >= 0) {
        const networks = inactives.splice(nIndex, 1);
        const option = networks[0];
        if (option) {
          option.name = intl.formatMessage(
            { id: 'form__cross_chain_str' },
            { '0': option.name },
          );
          option.isCrosschain = true;
          actives.push(option);
        }
      }
    } else {
      const option: NetworkOption = {
        name: intl.formatMessage({ id: 'form__cross_chain_desc' }),
        isCrosschain: true,
        networkId: 'cross-chain',
      };
      actives.push(option);
    }

    return { actives, inactives };
  }, [tokenList, intl, inputToken, networkSelectorId]);

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
      crosschainOptions: data.inactives,
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
    <OutputCrosschainTokenSelectorContext.Provider value={value}>
      <OutputCrosschainTokenSelector onSelect={onSelect} />
    </OutputCrosschainTokenSelectorContext.Provider>
  );
};

export default OutputCrosschain;
