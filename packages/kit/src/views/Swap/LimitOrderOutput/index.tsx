import { useCallback, useEffect, useMemo } from 'react';

import type { Token } from '@onekeyhq/engine/src/types/token';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useAppSelector, useNavigation } from '../../../hooks';
import {
  selectLimitOrderActiveAccount,
  selectLimitOrderTokenIn,
  selectLimitOrderTokenOut,
  selectSwapTransactionsTokenList,
} from '../../../store/selectors';
import TokenSelector from '../components/TokenSelector';
import { TokenSelectorContext } from '../components/TokenSelector/context';
import { limitOrderNetworkIds } from '../config';

const Output = () => {
  const navigation = useNavigation();

  const inputToken = useAppSelector(selectLimitOrderTokenIn);
  const outputToken = useAppSelector(selectLimitOrderTokenOut);
  const tokenList = useAppSelector(selectSwapTransactionsTokenList);
  const activeAccount = useAppSelector(selectLimitOrderActiveAccount);
  const networkSelectorId = outputToken?.networkId;

  const onSelect = useCallback(
    (token: Token) => {
      backgroundApiProxy.serviceLimitOrder.setOutputToken(token);
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

  const value = useMemo(
    () => ({
      networkId: inputToken?.networkId,
      selectedToken: inputToken,
      accountId: activeAccount?.id,
      tokenList: limitOrderTokenList,
    }),
    [inputToken, limitOrderTokenList, activeAccount?.id],
  );

  useEffect(() => {
    backgroundApiProxy.serviceSwap.fetchSwapTokenBalance({
      accountId: activeAccount?.id,
      networkId: networkSelectorId,
    });
  }, [networkSelectorId, activeAccount?.id]);

  const excluded = useMemo(() => [''], []);

  return (
    <TokenSelectorContext.Provider value={value}>
      <TokenSelector onSelect={onSelect} excluded={excluded} />
    </TokenSelectorContext.Provider>
  );
};

export default Output;
