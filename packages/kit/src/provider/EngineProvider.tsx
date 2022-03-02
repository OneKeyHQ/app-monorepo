import React, { FC, useCallback, useEffect } from 'react';

import * as SplashScreen from 'expo-splash-screen';
import useSWR from 'swr';

import { Box } from '@onekeyhq/components';
import engine from '@onekeyhq/kit/src/engine/EngineProvider';
import {
  useActiveWalletAccount,
  useAppDispatch,
  useAppSelector,
  useSettings,
} from '@onekeyhq/kit/src/hooks/redux';
import { updateFiatMoneyMap } from '@onekeyhq/kit/src/store/reducers/fiatMoney';
import {
  changeActiveAccount,
  changeActiveNetwork,
} from '@onekeyhq/kit/src/store/reducers/general';
import { updateNetworkMap } from '@onekeyhq/kit/src/store/reducers/network';
import { setAutoRefreshTimeStamp } from '@onekeyhq/kit/src/store/reducers/settings';
import { updateWallets } from '@onekeyhq/kit/src/store/reducers/wallet';

const EngineApp: FC = ({ children }) => {
  const networks = useAppSelector((s) => s.network.network);
  const { activeNetwork } = useAppSelector((s) => s.general);
  const { refreshTimeStamp } = useSettings();
  const { account } = useActiveWalletAccount();

  const dispatch = useAppDispatch();

  const handleFiatMoneyUpdate = useCallback(async () => {
    const fiatMoney = await engine.listFiats();
    dispatch(updateFiatMoneyMap(fiatMoney));
  }, [dispatch]);

  useSWR('fiat-money', () => handleFiatMoneyUpdate(), {
    refreshInterval: 1 * 60 * 60 * 1000,
  });

  useSWR('auto-refresh', () => dispatch(setAutoRefreshTimeStamp()), {
    refreshInterval: 1 * 60 * 60 * 1000,
  });

  const hideSplashScreen = useCallback(async () => {
    await SplashScreen.hideAsync();
  }, []);

  useEffect(() => {
    async function main() {
      const networksFromBE = await engine.listNetworks();
      dispatch(updateNetworkMap(networksFromBE));
    }
    main();
  }, [dispatch]);

  useEffect(() => {
    async function main() {
      const walletsFromBE = await engine.getWallets();
      dispatch(updateWallets(walletsFromBE));

      if (account) return;
      const hasAccountsWallet = walletsFromBE.find(
        (wallet) => !!wallet.accounts.length,
      );

      if (hasAccountsWallet) {
        engine
          .getAccounts(hasAccountsWallet.accounts, activeNetwork?.network.id)
          .then((accountDetailList) => {
            dispatch(
              changeActiveAccount({
                account: accountDetailList?.[0] ?? null,
                wallet: hasAccountsWallet,
              }),
            );
          });
      } else {
        // none wallet, return the first wallet or none
        const wallet = walletsFromBE.find((w) => w.type !== 'watching') ?? null;
        const accountId = wallet?.accounts?.[0];
        if (accountId) {
          engine
            .getAccounts([accountId], activeNetwork?.network.id)
            .then(([activeAccount]) => {
              dispatch(
                changeActiveAccount({
                  account: activeAccount,
                  wallet,
                }),
              );
            });
        } else {
          dispatch(
            changeActiveAccount({
              account: null,
              wallet,
            }),
          );
        }
      }
    }
    main();
  }, [dispatch, refreshTimeStamp, account, activeNetwork]);

  useEffect(() => {
    if (!networks || !networks?.[0]) return;
    if (activeNetwork?.network) return;
    const sharedChainName = networks[0].impl;
    const defaultNetwork = networks[0];
    dispatch(changeActiveNetwork({ network: defaultNetwork, sharedChainName }));
  }, [dispatch, networks, activeNetwork]);

  return (
    <Box flex="1" onLayout={hideSplashScreen}>
      {children}
    </Box>
  );
};

export default EngineApp;
