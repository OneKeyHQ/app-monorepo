import React, { useCallback, useMemo } from 'react';

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
import { getChainIdFromNetworkId } from '../utils';

import type { Token } from '../../../store/typings';

const Output = () => {
  const navigation = useNavigation();
  const { accountId, networkId } = useActiveWalletAccount();
  const { inputToken } = useSwapState();
  const { onSelectToken, onSelectNetwork } = useSwapActionHandlers();
  const swftcSupportedTokens = useAppSelector(
    (s) => s.swap.swftcSupportedTokens,
  );
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

  const included = useMemo(() => {
    if (activeNetwork?.id && activeNetwork?.id !== networkId) {
      const chainId = getChainIdFromNetworkId(activeNetwork.id);
      return swftcSupportedTokens[chainId];
    }
    return undefined;
  }, [activeNetwork, swftcSupportedTokens, networkId]);

  const excluded = useMemo(() => {
    if (networkId === activeNetwork?.id && inputToken) {
      return [inputToken.tokenIdOnNetwork];
    }
    return undefined;
  }, [activeNetwork, inputToken, networkId]);

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

  if (!activeNetwork) {
    return <></>;
  }

  return (
    <TokenSelector
      showNetworkSelector
      activeNetworkId={activeNetwork.id}
      included={included}
      excluded={excluded}
      onSelectToken={onPress}
      onSelectNetwork={onSelect}
    />
  );
};

export default Output;
