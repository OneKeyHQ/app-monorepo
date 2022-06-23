import React, { useCallback, useEffect } from 'react';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import {
  useAccountTokens,
  useAppSelector,
  useManageTokens,
  useNetworkTokens,
} from '../../hooks';
import { useActiveWalletAccount } from '../../hooks/redux';
import {
  reset,
  setNoSupportCoins,
  setSwftcSupportedTokens,
} from '../../store/reducers/swap';

import { swapClient } from './client';
import { useSwapActionHandlers, useSwapEnabled } from './hooks/useSwap';
import { refs } from './refs';

const AccountGuard = () => {
  const { account } = useActiveWalletAccount();
  useEffect(() => {
    backgroundApiProxy.dispatch(reset());
  }, [account]);

  return <></>;
};

const NetworkGuard = () => {
  const { network, accountId } = useActiveWalletAccount();
  const { nativeToken } = useManageTokens();
  const { onSelectToken } = useSwapActionHandlers();
  const isSwapEnabled = useSwapEnabled();
  useEffect(() => {
    backgroundApiProxy.dispatch(reset());
    if (!isSwapEnabled || !network) {
      return;
    }
    if (nativeToken) {
      onSelectToken(nativeToken, 'INPUT', network);
    } else {
      backgroundApiProxy.serviceToken
        .fetchAccountTokens({
          activeAccountId: accountId,
          activeNetworkId: network.id,
        })
        .then((tokens) => {
          const native = tokens?.filter((token) => !token.tokenIdOnNetwork)[0];
          if (native && refs.inputIsDirty === false) {
            onSelectToken(native, 'INPUT', network);
          }
        });
    }
    return () => {
      refs.inputIsDirty = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [network]);
  return <></>;
};

const ActiveNetworkGuard = () => {
  const { network, accountId } = useActiveWalletAccount();

  const activeNetwork = useAppSelector((s) => s.swap.activeNetwork);
  const networkId = activeNetwork?.id ?? '';

  const networkTokens = useNetworkTokens(networkId);
  const accountTokens = useAccountTokens(networkId, accountId);

  const { onSelectNetwork } = useSwapActionHandlers();

  useEffect(() => {
    if (!activeNetwork && network) {
      onSelectNetwork(network);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onNetworkChange = useCallback(() => {
    if (networkId) {
      if (!networkTokens.length) {
        backgroundApiProxy.serviceToken.fetchTokens({
          activeAccountId: accountId,
          activeNetworkId: networkId,
        });
      }
      if (!accountTokens.length) {
        backgroundApiProxy.serviceToken.fetchAccountTokens({
          activeAccountId: accountId,
          activeNetworkId: networkId,
        });
      }
    }
  }, [accountId, networkId, accountTokens, networkTokens]);

  useEffect(() => {
    onNetworkChange();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeNetwork]);
  return <></>;
};

const TokensFilters = () => {
  useEffect(() => {
    async function main() {
      const { tokens, noSuportedTokens } = await swapClient.getBaseInfo();
      backgroundApiProxy.dispatch(setSwftcSupportedTokens(tokens));
      backgroundApiProxy.dispatch(setNoSupportCoins(noSuportedTokens));
    }
    main();
  }, []);
  return null;
};

const SwapGuard = () => (
  <>
    <AccountGuard />
    <NetworkGuard />
    <ActiveNetworkGuard />
    <TokensFilters />
  </>
);

export default SwapGuard;
