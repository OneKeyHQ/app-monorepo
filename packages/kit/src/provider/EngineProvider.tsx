import React, { FC, useEffect } from 'react';

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
import { updateWallets } from '@onekeyhq/kit/src/store/reducers/wallet';

const EngineApp: FC = ({ children }) => {
  const networks = useAppSelector((s) => s.network.network);
  const { activeNetwork } = useAppSelector((s) => s.general);
  const { refreshTimeStamp } = useSettings();
  const { account } = useActiveWalletAccount();

  const dispatch = useAppDispatch();

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
      if (!hasAccountsWallet) return;
      const accountId = hasAccountsWallet.accounts[0];

      engine.getAccounts([accountId]).then(([activeAccount]) => {
        dispatch(
          changeActiveAccount({
            account: activeAccount,
            wallet: hasAccountsWallet,
          }),
        );
      });
    }
    main();
  }, [dispatch, refreshTimeStamp, account]);

  useEffect(() => {
    async function main() {
      const fiatMoney = await engine.listFiats();
      dispatch(updateFiatMoneyMap(fiatMoney));
    }
    main();
  }, [dispatch]);

  useEffect(() => {
    if (!networks) return;
    if (activeNetwork?.network) return;
    const sharedChainName = Object.keys(networks)[0];
    const defaultNetwork = networks[sharedChainName][0];
    dispatch(changeActiveNetwork({ network: defaultNetwork, sharedChainName }));
  }, [dispatch, networks, activeNetwork]);

  return <>{children}</>;
};

export default EngineApp;
