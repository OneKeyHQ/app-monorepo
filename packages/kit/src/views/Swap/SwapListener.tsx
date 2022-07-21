import React, { useEffect } from 'react';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { useNativeToken } from '../../hooks';
import { useActiveWalletAccount } from '../../hooks/redux';
import {
  reset,
  setSelectedNetworkId,
  setSwftcSupportedTokens,
} from '../../store/reducers/swap';

import { useSwapActionHandlers, useSwapEnabled } from './hooks/useSwap';
import { SwapQuoter } from './quoter';
import { refs } from './refs';

const AccountListener = () => {
  const { account } = useActiveWalletAccount();
  useEffect(() => {
    backgroundApiProxy.dispatch(reset());
  }, [account]);
  return <></>;
};

const NetworkListener = () => {
  const { network, accountId, networkId } = useActiveWalletAccount();
  const nativeToken = useNativeToken(networkId, accountId);
  const { onSelectToken } = useSwapActionHandlers();
  const isSwapEnabled = useSwapEnabled();
  useEffect(() => {
    backgroundApiProxy.dispatch(reset());
    if (!isSwapEnabled || !network) {
      return;
    }
    backgroundApiProxy.dispatch(setSelectedNetworkId(network.id));
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

const SwapTokensFetcher = () => {
  useEffect(() => {
    async function main() {
      const tokens = await SwapQuoter.client.getSwftcSupportedTokens();
      backgroundApiProxy.dispatch(setSwftcSupportedTokens(tokens));
    }
    main();
  }, []);
  return null;
};

const SwapListener = () => (
  <>
    <AccountListener />
    <NetworkListener />
    <SwapTokensFetcher />
  </>
);

export default SwapListener;
