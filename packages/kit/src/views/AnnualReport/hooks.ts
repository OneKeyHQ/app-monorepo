import { useCallback, useEffect, useState } from 'react';

import { isCoinTypeCompatibleWithImpl } from '@onekeyhq/engine/src/managers/impl';
import type { Account } from '@onekeyhq/engine/src/types/account';
import type { Wallet } from '@onekeyhq/engine/src/types/wallet';
import {
  WALLET_TYPE_EXTERNAL,
  WALLET_TYPE_WATCHING,
} from '@onekeyhq/engine/src/types/wallet';
import { OnekeyNetwork } from '@onekeyhq/shared/src/config/networkIds';
import { IMPL_EVM } from '@onekeyhq/shared/src/engine/engineConsts';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { useActiveWalletAccount } from '../../hooks';
import { useRuntime } from '../../hooks/redux';
import { appSelector } from '../../store';

const isCompatibleWallet = (w: Wallet) =>
  appSelector((s) => s.settings.devMode?.enable)
    ? true
    : ![WALLET_TYPE_EXTERNAL, WALLET_TYPE_WATCHING].includes(w.type);

export const useEvmAccount = () => {
  const { account } = useActiveWalletAccount();
  const { wallets } = useRuntime();
  const [firstEvmAccount, setFistEvmAccount] = useState<Account>();

  const getFirstEvmAccount = useCallback(async () => {
    const accounts = await backgroundApiProxy.engine.getAccounts(
      wallets
        .filter(isCompatibleWallet)
        .map((w) => w.accounts)
        .flat(),
      OnekeyNetwork.eth,
    );
    if (accounts?.length > 0) setFistEvmAccount(accounts?.[0]);
  }, [wallets]);

  useEffect(() => {
    getFirstEvmAccount();
  }, [getFirstEvmAccount]);

  if (
    account?.coinType &&
    isCoinTypeCompatibleWithImpl(account?.coinType, IMPL_EVM)
  ) {
    const wallet = wallets.find((w) => w.accounts.includes(account?.id));
    if (wallet && isCompatibleWallet(wallet)) {
      return account;
    }
  }

  return firstEvmAccount;
};
