import { useEffect, useRef } from 'react';

import BigNumber from 'bignumber.js';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  useAccountOverviewActions,
  useAccountWorthAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/accountOverview';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { convertFiat } from '@onekeyhq/kit/src/utils/fiatConvert';
import {
  useCurrencyPersistAtom,
  useSettingsPersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { USD_CURRENCY_ID } from '@onekeyhq/shared/src/consts/currencyConsts';
import { WALLET_TYPE_HD } from '@onekeyhq/shared/src/consts/dbConsts';
import { SHOW_WALLET_FUNCTION_BLOCK_VALUE_THRESHOLD_USD } from '@onekeyhq/shared/src/consts/walletConsts';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

export function HomeAccountValuePersistenceController() {
  const {
    activeAccount: { account, network, wallet },
  } = useActiveAccount({ num: 0 });
  const [accountWorth] = useAccountWorthAtom();
  const [{ currencyMap }] = useCurrencyPersistAtom();
  const [settings] = useSettingsPersistAtom();
  const { updateAccountWorth, updateAccountDeFiOverview } =
    useAccountOverviewActions().current;
  const currencyMapRef = useRef(currencyMap);
  useEffect(() => {
    currencyMapRef.current = currencyMap;
  }, [currencyMap]);

  const previousWalletIdRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!account?.id || !network?.id || !wallet?.id) {
      return;
    }
    const walletChanged =
      previousWalletIdRef.current !== undefined &&
      previousWalletIdRef.current !== wallet.id;
    previousWalletIdRef.current = wallet.id;
    if (
      !walletChanged &&
      !network.isAllNetworks &&
      !(wallet.type === WALLET_TYPE_HD && !wallet.backuped)
    ) {
      return;
    }
    updateAccountWorth({
      accountId: account.id,
      worth: {},
      initialized: false,
    });
    updateAccountDeFiOverview({
      accountId: account.id,
      networkId: network.id,
      overview: {
        totalValue: 0,
        totalDebt: 0,
        totalReward: 0,
        netWorth: 0,
      },
    });
  }, [
    account?.id,
    network?.id,
    network?.isAllNetworks,
    updateAccountDeFiOverview,
    updateAccountWorth,
    wallet?.backuped,
    wallet?.id,
    wallet?.type,
  ]);

  useEffect(() => {
    const updateAccountValue = async () => {
      if (
        !account ||
        !network ||
        !accountWorth.initialized ||
        (account.id !== accountWorth.accountId &&
          account.indexedAccountId !== accountWorth.accountId)
      ) {
        return;
      }
      const allWorth = Object.values(accountWorth.worth)
        .reduce<BigNumber>((acc, cur) => acc.plus(cur), new BigNumber(0))
        .toFixed();
      const allWorthUsd = convertFiat({
        value: allWorth,
        sourceCurrency: accountWorth.currency ?? settings.currencyInfo.id,
        targetCurrency: USD_CURRENCY_ID,
        currencyMap: currencyMapRef.current,
      });
      if (
        new BigNumber(allWorthUsd).gt(
          SHOW_WALLET_FUNCTION_BLOCK_VALUE_THRESHOLD_USD,
        )
      ) {
        await backgroundApiProxy.serviceWalletStatus.updateWalletStatus({
          walletXfp: wallet?.xfp ?? '',
          status: { hasValue: true },
        });
        appEventBus.emit(EAppEventBusNames.AccountValueUpdate, undefined);
      }
      const isOthers = accountUtils.isOthersAccount({ accountId: account.id });
      const accountValueId = isOthers
        ? account.id
        : (account.indexedAccountId as string);
      const currency = accountWorth.currency ?? settings.currencyInfo.id;
      if (
        isOthers &&
        account.createAtNetwork &&
        (network.isAllNetworks || account.createAtNetwork === network.id)
      ) {
        void backgroundApiProxy.serviceAccountProfile.updateAccountValue({
          accountId: accountValueId,
          networkAccountId: account.id,
          networkId: account.createAtNetwork,
          value: accountWorth.createAtNetworkWorth,
          currency,
          shouldUpdateActiveAccountValue: true,
        });
      } else if (!isOthers && !network.isAllNetworks) {
        const value =
          accountWorth.worth[
            accountUtils.buildAccountValueKey({
              accountId: account.id,
              networkId: network.id,
            })
          ];
        void backgroundApiProxy.serviceAccountProfile.updateAccountValueForSingleNetwork(
          {
            accountId: accountValueId,
            networkAccountId: account.id,
            networkId: network.id,
            value: value ?? '0',
            currency,
          },
        );
      }
      void backgroundApiProxy.serviceAccountProfile.updateAllNetworkAccountValue(
        {
          accountId: accountValueId,
          value: accountWorth.worth,
          currency,
          updateAll: accountWorth.updateAll,
        },
      );
    };
    void updateAccountValue();
  }, [account, accountWorth, network, settings.currencyInfo.id, wallet?.xfp]);

  return null;
}
