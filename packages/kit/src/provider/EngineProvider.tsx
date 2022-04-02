import React, { FC, useCallback, useEffect } from 'react';

import * as SplashScreen from 'expo-splash-screen';
import useSWR from 'swr';

import { Box } from '@onekeyhq/components';
import {
  useActiveWalletAccount,
  useAppSelector,
  useSettings,
} from '@onekeyhq/kit/src/hooks/redux';
import { updateFiatMoneyMap } from '@onekeyhq/kit/src/store/reducers/fiatMoney';
import { setAutoRefreshTimeStamp } from '@onekeyhq/kit/src/store/reducers/settings';
import { updateWallets } from '@onekeyhq/kit/src/store/reducers/wallet';

import backgroundApiProxy from '../background/instance/backgroundApiProxy';
import { passwordSet } from '../store/reducers/data';

const EngineApp: FC = ({ children }) => {
  const networks = useAppSelector((s) => s.network.network);
  const { activeNetwork } = useAppSelector((s) => s.general);
  const { refreshTimeStamp } = useSettings();
  const { account } = useActiveWalletAccount();

  const { dispatch } = backgroundApiProxy;

  const handleFiatMoneyUpdate = useCallback(async () => {
    const fiatMoney = await backgroundApiProxy.engine.listFiats();
    dispatch(updateFiatMoneyMap(fiatMoney));
  }, [dispatch]);

  useSWR('fiat-money', () => handleFiatMoneyUpdate(), {
    refreshInterval: 1 * 60 * 1000,
  });

  useSWR('auto-refresh', () => dispatch(setAutoRefreshTimeStamp()), {
    refreshInterval: 1 * 60 * 1000,
  });

  const hideSplashScreen = useCallback(async () => {
    await SplashScreen.hideAsync();
  }, []);

  useEffect(() => {
    backgroundApiProxy.serviceApp.initNetworks();
  }, []);

  useEffect(() => {
    async function main() {
      const walletsFromBE = await backgroundApiProxy.engine.getWallets();
      dispatch(updateWallets(walletsFromBE));

      // waiting activeNetwork loaded
      if (!activeNetwork) {
        return;
      }

      if (account) return;
      const hasAccountsWallet = walletsFromBE.find(
        (wallet) => !!wallet.accounts.length,
      );

      if (hasAccountsWallet) {
        backgroundApiProxy.engine
          .getAccounts(hasAccountsWallet.accounts, activeNetwork?.network.id)
          .then((accountDetailList) => {
            backgroundApiProxy.serviceAccount.changeActiveAccount({
              account: accountDetailList?.[0] ?? null,
              wallet: hasAccountsWallet,
            });
          });
      } else {
        // none wallet, return the first wallet or none
        const wallet =
          walletsFromBE.find(
            (w) => w.type !== 'watching' && w.type !== 'imported',
          ) ?? null;

        const accountId = wallet?.accounts?.[0];
        if (accountId) {
          backgroundApiProxy.engine
            .getAccounts([accountId], activeNetwork?.network.id)
            .then(([activeAccount]) => {
              backgroundApiProxy.serviceAccount.changeActiveAccount({
                account: activeAccount,
                wallet,
              });
            });
        } else {
          // TODO async actions to backgroundApi
          backgroundApiProxy.serviceAccount.changeActiveAccount({
            account: null,
            wallet,
          });
        }
      }
    }
    main();
  }, [dispatch, refreshTimeStamp, account, activeNetwork]);

  useEffect(() => {
    if (!networks || !networks?.[0]) return;
    if (activeNetwork?.network) return;
    const defaultNetwork =
      networks.filter(
        (network) => network.impl === 'evm' && network.id === 'evm--1',
      )[0] || networks[0];
    const sharedChainName = defaultNetwork.impl;
    backgroundApiProxy.serviceNetwork.changeActiveNetwork({
      network: defaultNetwork,
      sharedChainName,
    });
  }, [dispatch, networks, activeNetwork]);

  useEffect(() => {
    async function main() {
      try {
        const isMasterPasswordSet =
          await backgroundApiProxy.engine.isMasterPasswordSet();
        if (isMasterPasswordSet) {
          dispatch(passwordSet());
        }
      } finally {
        hideSplashScreen();
      }
    }
    main();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <Box flex="1">{children}</Box>;
};

export default EngineApp;
