import { useCallback, useEffect, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import {
  useActiveWalletAccount,
  useAppSelector,
  useNavigation,
  usePrevious,
} from '../../../hooks';
import TokenSelectorControl from '../components/TokenSelectorControl';
import { TokenSelectorControlContext } from '../components/TokenSelectorControl/context';

import type { Token } from '../../../store/typings';
import type {
  NetworkOption,
  TokenSelectorControlValues,
} from '../components/TokenSelectorControl/context';

const all = 'all';

const Input = () => {
  const intl = useIntl();
  const navigation = useNavigation();
  const { network } = useActiveWalletAccount();
  const outputToken = useAppSelector((s) => s.swap.outputToken);
  const inputToken = useAppSelector((s) => s.swap.inputToken);
  const tokenList = useAppSelector((s) => s.swapTransactions.tokenList);
  const sendingAccount = useAppSelector((s) => s.swap.sendingAccount);
  const [networkSelectorId, onSelectNetworkId] = useState<string | undefined>(
    () => {
      const networkIds = (tokenList ?? []).map((item) => item.networkId);
      if (inputToken && networkIds.includes(inputToken.networkId)) {
        return inputToken.networkId;
      }
      return undefined;
    },
  );
  const previousNetworkSelectorId = usePrevious(networkSelectorId);

  const onSelect = useCallback(
    (token: Token) => {
      backgroundApiProxy.serviceSwap.setInputToken(token);
      navigation.goBack();
    },
    [navigation],
  );

  const data = useMemo<{
    actives: NetworkOption[];
    inactives: NetworkOption[];
  }>(() => {
    if (!tokenList) {
      return { actives: [], inactives: [] };
    }
    const items = tokenList
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
      });
    const actives: NetworkOption[] = [];
    const inactives: NetworkOption[] = [];
    for (let i = 0; i < items.length; i += 1) {
      const item = items[i];

      const otherNetworkId = !networkSelectorId
        ? previousNetworkSelectorId
        : networkSelectorId;

      if (!item.networkId || item.networkId === otherNetworkId) {
        actives.push(item);
      } else {
        inactives.push(item);
      }
    }

    return { actives, inactives };
  }, [tokenList, intl, networkSelectorId, previousNetworkSelectorId]);

  const value = useMemo(
    () =>
      ({
        impl: network?.impl,
        networkId: networkSelectorId,
        setNetworkId: onSelectNetworkId,
        selectedToken: outputToken,
        accountId: sendingAccount?.id,
        tokenList,
        networkOptions: data.actives,
        otherNetworkOptions: data.inactives,
      } as TokenSelectorControlValues),
    [
      outputToken,
      networkSelectorId,
      onSelectNetworkId,
      network?.impl,
      sendingAccount?.id,
      tokenList,
      data,
    ],
  );

  useEffect(() => {
    backgroundApiProxy.serviceSwap.fetchSwapTokenBalance({
      accountId: sendingAccount?.id,
      networkId: networkSelectorId,
    });
  }, [networkSelectorId, sendingAccount?.id]);

  return (
    <TokenSelectorControlContext.Provider value={value}>
      <TokenSelectorControl onSelect={onSelect} />
    </TokenSelectorControlContext.Provider>
  );
};

export default Input;
