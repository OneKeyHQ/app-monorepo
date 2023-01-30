import { useEffect, useMemo } from 'react';

import { useIsFocused } from '@react-navigation/native';

import type { Account } from '@onekeyhq/engine/src/types/account';
import { OnekeyNetwork } from '@onekeyhq/shared/src/config/networkIds';
import {
  AppUIEventBusNames,
  appUIEventBus,
} from '@onekeyhq/shared/src/eventBus/appUIEventBus';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { useAppSelector, useNavigation, usePrevious } from '../../hooks';
import { ModalRoutes, RootRoutes } from '../../routes/types';
import { useRpcMeasureStatus } from '../ManageNetworks/hooks';

import { SwapError, SwapRoutes } from './typings';
import { stringifyTokens } from './utils';

const AccountsObserver = () => {
  useEffect(() => {
    const fn = (account: Account) => {
      backgroundApiProxy.serviceSwap.handleAccountRemoved(account);
    };
    appUIEventBus.on(AppUIEventBusNames.RemoveAccount, fn);
    return function () {
      appUIEventBus.off(AppUIEventBusNames.RemoveAccount, fn);
    };
  }, []);
  const accounts = useAppSelector((s) => s.runtime.accounts);
  useEffect(() => {
    backgroundApiProxy.serviceSwap.refreshSendingAccount();
  }, [accounts]);
  return null;
};

const UserSelectedQuoterObserver = () => {
  const inputToken = useAppSelector((s) => s.swap.inputToken);
  const outputToken = useAppSelector((s) => s.swap.outputToken);
  const tokensHash = useMemo(
    () => stringifyTokens(inputToken, outputToken),
    [inputToken, outputToken],
  );
  const prevTokensHash = usePrevious(tokensHash);
  useEffect(() => {
    if (tokensHash !== prevTokensHash) {
      backgroundApiProxy.serviceSwap.clearUserSelectedQuoter();
    }
  }, [tokensHash, prevTokensHash]);
  return null;
};

const WelcomeObserver = () => {
  const navigation = useNavigation();
  const isFocused = useIsFocused();
  useEffect(() => {
    async function main() {
      const swapWelcomeShown =
        await backgroundApiProxy.serviceSwap.getSwapWelcomeShown();
      if (swapWelcomeShown || !isFocused) {
        return;
      }
      navigation.navigate(RootRoutes.Modal, {
        screen: ModalRoutes.Swap,
        params: {
          screen: SwapRoutes.Welcome,
        },
      });
    }
    const timer = setTimeout(main, 1000);
    return () => clearTimeout(timer);
  }, [navigation, isFocused]);
  return null;
};

const NetworkStatusObserver = () => {
  const networkStatus = useRpcMeasureStatus(OnekeyNetwork.eth);
  const responseTime = networkStatus.status?.responseTime;
  const prevResponseTime = usePrevious(responseTime);

  useEffect(() => {
    if (prevResponseTime === undefined && networkStatus.status?.responseTime) {
      backgroundApiProxy.serviceSwap.getSwapError().then((error) => {
        if (error === SwapError.QuoteFailed) {
          appUIEventBus.emit(AppUIEventBusNames.SwapRefresh);
        }
      });
    }
  }, [networkStatus.status?.responseTime, prevResponseTime, responseTime]);
  return null;
};

const PriceObserver = () => {
  const inputToken = useAppSelector((s) => s.swap.inputToken);
  const outputToken = useAppSelector((s) => s.swap.outputToken);

  useEffect(() => {
    if (inputToken) {
      backgroundApiProxy.servicePrice.getSimpleTokenPrice({
        networkId: inputToken.networkId,
        tokenId: inputToken.tokenIdOnNetwork,
      });
    }
  }, [inputToken]);

  useEffect(() => {
    if (outputToken) {
      backgroundApiProxy.servicePrice.getSimpleTokenPrice({
        networkId: outputToken.networkId,
        tokenId: outputToken.tokenIdOnNetwork,
      });
    }
  }, [outputToken]);

  return null;
};

const SwapObserver = () => (
  <>
    <AccountsObserver />
    <UserSelectedQuoterObserver />
    <WelcomeObserver />
    <NetworkStatusObserver />
    <PriceObserver />
  </>
);

export default SwapObserver;
