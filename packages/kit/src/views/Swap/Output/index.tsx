import React, { useCallback } from 'react';

import { useFocusEffect } from '@react-navigation/core';

import { Network } from '@onekeyhq/engine/src/types/network';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import {
  setHaptics,
  useActiveWalletAccount,
  useAppSelector,
  useNavigation,
} from '../../../hooks';
import TokenSelector from '../components/TokenSelector';
import { useSwapActionHandlers, useSwapState } from '../hooks/useSwap';

import type { Token } from '../../../store/typings';

const Output = () => {
  const navigation = useNavigation();
  const { accountId, networkId } = useActiveWalletAccount();
  const { inputToken } = useSwapState();
  const { onSelectToken, onSelectNetwork } = useSwapActionHandlers();
  const activeNetwork = useAppSelector((s) => s.swap.activeNetwork);
  const onPress = useCallback(
    (token: Token) => {
      if (activeNetwork) {
        onSelectToken(token, 'OUTPUT', activeNetwork);
      }
      navigation.goBack();
    },
    [navigation, onSelectToken, activeNetwork],
  );
  const onSelect = useCallback(
    (network: Network) => {
      setHaptics();
      onSelectNetwork(network);
    },
    [onSelectNetwork],
  );

  useFocusEffect(
    useCallback(() => {
      backgroundApiProxy.serviceToken.fetchAccountTokens({
        activeAccountId: accountId,
        activeNetworkId: networkId,
        withBalance: true,
      });
      backgroundApiProxy.serviceToken.fetchTokens({
        activeAccountId: accountId,
        activeNetworkId: networkId,
        withBalance: true,
      });
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  return (
    <TokenSelector
      showNetworkSelector
      excluded={networkId === activeNetwork?.id ? inputToken : undefined}
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      activeNetwork={activeNetwork!}
      onSelectToken={onPress}
      onSelectNetwork={onSelect}
    />
  );
};

export default Output;
