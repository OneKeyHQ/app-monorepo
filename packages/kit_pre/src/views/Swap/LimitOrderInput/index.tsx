import { useCallback, useEffect, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import {
  useActiveWalletAccount,
  useAppSelector,
  useNavigation,
} from '../../../hooks';
import TokenSelector from '../components/TokenSelector';
import { TokenSelectorContext } from '../components/TokenSelector/context';
import { limitOrderNetworkIds } from '../config';

import type { Token } from '../../../store/typings';
import type { NetworkOption } from '../components/TokenSelector/context';

const Input = () => {
  const intl = useIntl();
  const navigation = useNavigation();
  const { network } = useActiveWalletAccount();
  const inputToken = useAppSelector((s) => s.limitOrder.tokenIn);
  const outputToken = useAppSelector((s) => s.limitOrder.tokenOut);
  const sendingAccount = useAppSelector((s) => s.limitOrder.activeAccount);

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
      backgroundApiProxy.serviceLimitOrder.setInputToken(token);
      navigation.goBack();
    },
    [navigation],
  );

  const limitOrderTokenList = useMemo(
    () =>
      tokenList
        ? tokenList.filter((item) =>
            limitOrderNetworkIds.includes(item.networkId),
          )
        : [],
    [tokenList],
  );

  const networkOptions = useMemo<NetworkOption[]>(() => {
    if (!limitOrderTokenList) {
      return [];
    }
    return limitOrderTokenList.map((item) => {
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
  }, [limitOrderTokenList, intl]);

  const value = useMemo(
    () => ({
      impl: network?.impl,
      networkId: networkSelectorId,
      setNetworkId: onSelectNetworkId,
      selectedToken: outputToken,
      accountId: sendingAccount?.id,
      networkOptions,
      tokenList: limitOrderTokenList,
    }),
    [
      outputToken,
      networkSelectorId,
      onSelectNetworkId,
      network?.impl,
      sendingAccount?.id,
      networkOptions,
      limitOrderTokenList,
    ],
  );

  useEffect(() => {
    backgroundApiProxy.serviceSwap.fetchSwapTokenBalance({
      accountId: sendingAccount?.id,
      networkId: networkSelectorId,
    });
  }, [networkSelectorId, sendingAccount?.id]);

  const excluded = useMemo(() => [''], []);

  return (
    <TokenSelectorContext.Provider value={value}>
      <TokenSelector onSelect={onSelect} excluded={excluded} />
    </TokenSelectorContext.Provider>
  );
};

export default Input;
