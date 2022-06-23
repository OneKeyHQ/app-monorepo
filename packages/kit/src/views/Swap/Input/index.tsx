import React, { useCallback, useMemo } from 'react';

import { useFocusEffect } from '@react-navigation/core';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useAppSelector, useNavigation } from '../../../hooks';
import { useActiveWalletAccount } from '../../../hooks/redux';
import TokenSelector from '../components/TokenSelector';
import { useSwapActionHandlers, useSwapState } from '../hooks/useSwap';
import { getChainIdFromNetworkId, nativeTokenAddress } from '../utils';

import type { Token } from '../../../store/typings';

const Input = () => {
  const navigation = useNavigation();
  const { outputToken } = useSwapState();
  const activeNetwork = useAppSelector((s) => s.swap.activeNetwork);
  const noSupportCoins = useAppSelector((s) => s.swap.noSupportCoins);
  const swftcSupportedTokens = useAppSelector(
    (s) => s.swap.swftcSupportedTokens,
  );
  const { onSelectToken } = useSwapActionHandlers();
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

  const included = useMemo(() => {
    if (outputToken && outputToken.networkId !== networkId) {
      const chainId = getChainIdFromNetworkId(networkId);
      return swftcSupportedTokens[chainId];
    }
    return undefined;
  }, [outputToken, networkId, swftcSupportedTokens]);

  const excluded = useMemo(() => {
    if (activeNetwork?.id === networkId && outputToken) {
      return [outputToken.tokenIdOnNetwork];
    }
    if (activeNetwork && activeNetwork?.id !== networkId && outputToken) {
      const outputTokenNetworkId = outputToken.networkId;
      const inputChainId = getChainIdFromNetworkId(networkId);
      const outputChainId = getChainIdFromNetworkId(outputTokenNetworkId);
      const address = outputToken.tokenIdOnNetwork || nativeTokenAddress;
      return noSupportCoins[outputChainId]?.[address]?.[inputChainId];
    }
    return undefined;
  }, [networkId, activeNetwork, outputToken, noSupportCoins]);

  if (!network) {
    return <></>;
  }

  return (
    <TokenSelector
      activeNetworkId={network.id}
      included={included}
      excluded={excluded}
      onSelectToken={onPress}
      showNetworkSelector={false}
    />
  );
};

export default Input;
