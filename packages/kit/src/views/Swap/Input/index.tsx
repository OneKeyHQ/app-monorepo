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

import type { Token } from '../../../store/typings';
import type { NetworkOption } from '../components/TokenSelector/context';

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

  const onSelect = useCallback(
    (token: Token) => {
      backgroundApiProxy.serviceSwap.setInputToken(token);
      navigation.goBack();
    },
    [navigation],
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

  const value = useMemo(
    () => ({
      impl: network?.impl,
      networkId: networkSelectorId,
      setNetworkId: onSelectNetworkId,
      selectedToken: outputToken,
      accountId: sendingAccount?.id,
      tokenList,
      networkOptions,
    }),
    [
      outputToken,
      networkSelectorId,
      onSelectNetworkId,
      network?.impl,
      sendingAccount?.id,
      tokenList,
      networkOptions,
    ],
  );

  useEffect(() => {
    backgroundApiProxy.serviceSwap.fetchSwapTokenBalance({
      accountId: sendingAccount?.id,
      networkId: networkSelectorId,
    });
  }, [networkSelectorId, sendingAccount?.id]);

  return (
    <TokenSelectorContext.Provider value={value}>
      <TokenSelector onSelect={onSelect} />
    </TokenSelectorContext.Provider>
  );
};

export default Input;
