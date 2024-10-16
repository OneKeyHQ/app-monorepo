import { useCallback, useEffect, useState } from 'react';

import { useIntl } from 'react-intl';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useAccountSelectorCreateAddress } from '@onekeyhq/kit/src/components/AccountSelector/hooks/useAccountSelectorCreateAddress';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type { IAccountDeriveTypes } from '@onekeyhq/kit-bg/src/vaults/types';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import { EAlignPrimaryAccountMode } from '@onekeyhq/shared/types/dappConnection';

import type { IExtensionActiveTabDAppInfo } from './useActiveTabDAppInfo';

export function useDappAccountSwitch({
  result,
  refreshConnectionInfo,
}: {
  result: IExtensionActiveTabDAppInfo | null;
  refreshConnectionInfo: () => void;
}) {
  const intl = useIntl();
  const {
    activeAccount: {
      account,
      indexedAccount,
      network,
      wallet,
      deriveType,
      isOthersWallet,
    },
  } = useActiveAccount({ num: 0 });
  const [settings] = useSettingsPersistAtom();

  const [shouldSwitchAccount, setShouldSwitchAccount] = useState(false);
  const [accountExist, setAccountExist] = useState(false);
  const [isSwitching, setIsSwitching] = useState(false);
  const [hideAccountSelectorTrigger, setHideAccountSelectorTrigger] =
    useState(false);
  const [switchProcessText, setSwitchProcessText] = useState('');
  const checkShouldSwitchAccount = useCallback(
    async (params: {
      origin: string;
      accountId?: string;
      networkId?: string;
      indexedAccountId?: string;
      isOthersWallet?: boolean;
      deriveType: IAccountDeriveTypes;
    }) => {
      if (!params.origin) {
        console.log(
          '🚀 ~ checkShouldSwitchAccount ~ supportSwitchConnectionAccount: false, accountExist: false',
        );
        setShouldSwitchAccount(false);
        setAccountExist(false);
      }

      if (
        settings.alignPrimaryAccountMode ===
          EAlignPrimaryAccountMode.AlignDappToWallet &&
        platformEnv.isExtensionUiSidePanel
      ) {
        setShouldSwitchAccount(false);
        return;
      }

      // Check if account switch is supported and if the account exists
      const { supportSwitchConnectionAccount, accountExist: _accountExist } =
        await backgroundApiProxy.serviceDApp.isSupportSwitchDAppConnectionAccount(
          params,
        );
      console.log(
        '🚀 ~ checkShouldSwitchAccount ~ supportSwitchConnectionAccount: ',
        supportSwitchConnectionAccount,
        ', accountExist:',
        _accountExist,
      );

      // Set switch process text and update state
      setSwitchProcessText(
        intl.formatMessage(
          {
            id: ETranslations.browser_switch_to_account,
          },
          {
            account: account?.name ?? indexedAccount?.name ?? '',
          },
        ),
      );
      setShouldSwitchAccount(supportSwitchConnectionAccount);
      setAccountExist(_accountExist);
    },
    [
      account?.name,
      indexedAccount?.name,
      intl,
      settings.alignPrimaryAccountMode,
    ],
  );

  useEffect(() => {
    void checkShouldSwitchAccount({
      origin: result?.origin ?? '',
      accountId: account?.id,
      networkId: network?.id,
      indexedAccountId: indexedAccount?.id,
      isOthersWallet,
      deriveType,
    });
  }, [
    indexedAccount?.id,
    account?.id,
    isOthersWallet,
    network?.id,
    result?.origin,
    deriveType,
    checkShouldSwitchAccount,
  ]);

  const { createAddress } = useAccountSelectorCreateAddress();
  const onSwitchAccount = useCallback(async () => {
    if (typeof result?.connectedAccountsInfo?.[0].num !== 'number') {
      return;
    }
    setIsSwitching(true);
    setHideAccountSelectorTrigger(true);
    if (!accountExist) {
      try {
        setSwitchProcessText(
          intl.formatMessage({
            id: ETranslations.global_creating_address,
          }),
        );
        // Create a new address if it doesn't exist
        await createAddress({
          num: 0,
          account: {
            walletId: wallet?.id,
            networkId: result?.connectedAccountsInfo?.[0].networkId,
            indexedAccountId: indexedAccount?.id,
            deriveType: result?.connectedAccountsInfo?.[0].deriveType,
          },
          selectAfterCreate: false,
        });
      } finally {
        // Reset switching state and update process text
        setIsSwitching(false);
        setSwitchProcessText(
          intl.formatMessage(
            {
              id: ETranslations.browser_switch_to_account,
            },
            {
              account: account?.name ?? indexedAccount?.name ?? '',
            },
          ),
        );
        setHideAccountSelectorTrigger(false);
      }
    }

    // Get DApp network account
    const dappNetworkAccount =
      await backgroundApiProxy.serviceDApp.getDappConnectNetworkAccount({
        origin: result?.origin ?? '',
        indexedAccountId: indexedAccount?.id,
        accountId: account?.id,
        networkId: result?.connectedAccountsInfo?.[0].networkId,
        isOthersWallet,
        deriveType,
      });

    if (!dappNetworkAccount) {
      return;
    }

    const usedDeriveType = networkUtils.isBTCNetwork(
      result?.connectedAccountsInfo?.[0].networkId,
    )
      ? result?.connectedAccountsInfo?.[0].deriveType
      : deriveType;
    // Update connection session with new account info
    await backgroundApiProxy.serviceDApp.updateConnectionSession({
      origin: result?.origin ?? '',
      accountSelectorNum: result?.connectedAccountsInfo?.[0].num,
      updatedAccountInfo: {
        walletId: wallet?.id ?? '',
        indexedAccountId: indexedAccount?.id ?? '',
        othersWalletAccountId: isOthersWallet
          ? dappNetworkAccount?.id
          : undefined,
        networkId: result?.connectedAccountsInfo?.[0].networkId ?? '',
        deriveType: usedDeriveType,
        networkImpl: result?.connectedAccountsInfo?.[0].networkImpl ?? '',
        accountId: dappNetworkAccount.id ?? '',
        address: dappNetworkAccount.address ?? '',
        num: result?.connectedAccountsInfo?.[0].num,
        focusedWallet: wallet?.id,
      },
      storageType: result?.connectedAccountsInfo?.[0].storageType,
    });

    setTimeout(() => {
      refreshConnectionInfo();
      if (result?.origin) {
        void backgroundApiProxy.serviceDApp.notifyDAppAccountsChanged(
          result.origin,
        );
      }
      setIsSwitching(false);
      setShouldSwitchAccount(false);
    }, 200);

    setTimeout(() => {
      setHideAccountSelectorTrigger(false);
    }, 400);
  }, [
    intl,
    result?.connectedAccountsInfo,
    wallet?.id,
    indexedAccount?.id,
    isOthersWallet,
    account?.id,
    result?.origin,
    account?.name,
    indexedAccount?.name,
    deriveType,
    refreshConnectionInfo,
    createAddress,
    accountExist,
  ]);

  const onCancelSwitchAccount = useCallback(() => {
    setShouldSwitchAccount(false);
  }, []);

  return {
    shouldSwitchAccount,
    isSwitching,
    hideAccountSelectorTrigger,
    switchProcessText,
    onSwitchAccount,
    onCancelSwitchAccount,
  };
}
