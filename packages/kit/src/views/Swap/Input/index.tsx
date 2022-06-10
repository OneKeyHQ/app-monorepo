import React, { useCallback } from 'react';

import { useFocusEffect } from '@react-navigation/core';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useAppSelector, useNavigation } from '../../../hooks';
import { useActiveWalletAccount } from '../../../hooks/redux';
import TokenSelector from '../components/TokenSelector';
import { useSwapActionHandlers, useSwapState } from '../hooks/useSwap';

import type { Token } from '../../../store/typings';

const Input = () => {
  const navigation = useNavigation();
  const { outputToken } = useSwapState();
  const { onSelectToken } = useSwapActionHandlers();
  const activeNetwork = useAppSelector((s) => s.swap.activeNetwork);
  const { network, accountId, networkId } = useActiveWalletAccount();
  const onPress = useCallback(
    (token: Token) => {
      if (network) {
        onSelectToken(token, 'INPUT', network);
      }
      navigation.goBack();
    },
    [navigation, onSelectToken, network],
  );
  useFocusEffect(
    useCallback(() => {
      backgroundApiProxy.serviceToken.fetchAccountTokensWithId(
        accountId,
        networkId,
      );
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );
  return (
    <TokenSelector
      excluded={networkId === activeNetwork?.id ? outputToken : undefined}
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      activeNetwork={network!}
      onSelectToken={onPress}
      showNetworkSelector={false}
    />
  );
};

export default Input;
