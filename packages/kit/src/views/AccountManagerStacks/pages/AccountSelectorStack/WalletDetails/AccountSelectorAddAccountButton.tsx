import { useCallback } from 'react';

import { useIntl } from 'react-intl';
import { useDebouncedCallback } from 'use-debounce';

import { Icon, Stack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useAccountSelectorActions } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import type {
  IDBDevice,
  IDBWallet,
} from '@onekeyhq/kit-bg/src/dbs/local/types';
import type { IAccountSelectorAccountsListSectionData } from '@onekeyhq/kit-bg/src/dbs/simple/entity/SimpleDbEntityAccountSelector';
import { indexedAccountAddressCreationStateAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  WALLET_TYPE_EXTERNAL,
  WALLET_TYPE_IMPORTED,
  WALLET_TYPE_WATCHING,
} from '@onekeyhq/shared/src/consts/dbConsts';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EModalRoutes, EOnboardingPages } from '@onekeyhq/shared/src/routes';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

export function AccountSelectorAddAccountButton({
  num,
  isOthersUniversal,
  section,
  focusedWalletInfo,
}: {
  num: number;
  isOthersUniversal: boolean;
  section: IAccountSelectorAccountsListSectionData;
  focusedWalletInfo:
    | {
        wallet: IDBWallet;
        device: IDBDevice | undefined;
      }
    | undefined;
}) {
  const actions = useAccountSelectorActions();
  const navigation = useAppNavigation();
  const intl = useIntl();

  const { serviceAccount } = backgroundApiProxy;

  const handleImportWatchingAccount = useCallback(() => {
    navigation.pushModal(EModalRoutes.OnboardingModal, {
      screen: EOnboardingPages.ImportAddress,
    });
  }, [navigation]);

  const handleImportPrivatekeyAccount = useCallback(() => {
    navigation.pushModal(EModalRoutes.OnboardingModal, {
      screen: EOnboardingPages.ImportPrivateKey,
    });
  }, [navigation]);

  const handleAddExternalAccount = useCallback(() => {
    console.log('handleAddExternalAccount');
    navigation.pushModal(EModalRoutes.OnboardingModal, {
      screen: EOnboardingPages.ConnectWalletSelectNetworks,
    });
  }, [navigation]);

  const handleAddAccount = useDebouncedCallback(
    async () => {
      if (isOthersUniversal) {
        if (section.walletId === WALLET_TYPE_WATCHING) {
          handleImportWatchingAccount();
        }
        if (section.walletId === WALLET_TYPE_IMPORTED) {
          handleImportPrivatekeyAccount();
        }
        if (section.walletId === WALLET_TYPE_EXTERNAL) {
          handleAddExternalAccount();
        }
        return;
      }
      if (!focusedWalletInfo) {
        return;
      }

      let isNavigationPopped = false;
      const popNavigation = () => {
        if (isNavigationPopped) {
          return;
        }
        isNavigationPopped = true;
        navigation.popStack();
      };

      try {
        const focusedWallet = focusedWalletInfo?.wallet;
        const c = await serviceAccount.addHDNextIndexedAccount({
          walletId: section.walletId,
        });
        console.log('addHDNextIndexedAccount>>>', c);
        await actions.current.updateSelectedAccountForHdOrHwAccount({
          num,
          walletId: focusedWallet?.id,
          indexedAccountId: c.indexedAccountId,
        });
        const indexedAccount = await serviceAccount.getIndexedAccountSafe({
          id: c.indexedAccountId,
        });
        if (indexedAccount && focusedWallet) {
          const walletIdFromIndexedId = accountUtils.getWalletIdFromAccountId({
            accountId: indexedAccount?.id,
          });
          if (walletIdFromIndexedId === focusedWallet?.id) {
            await indexedAccountAddressCreationStateAtom.set({
              walletId: focusedWallet?.id,
              indexedAccountId: indexedAccount?.id,
            });
            await timerUtils.wait(1500);
            popNavigation();
            await actions.current.addDefaultNetworkAccounts({
              wallet: focusedWallet,
              indexedAccount,
              autoHandleExitError: false, // always throw error
            });
          }
        }
      } finally {
        await indexedAccountAddressCreationStateAtom.set(undefined);
        if (focusedWalletInfo.device?.connectId) {
          await backgroundApiProxy.serviceHardwareUI.closeHardwareUiStateDialog(
            {
              connectId: focusedWalletInfo.device?.connectId,
              hardClose: true,
            },
          );
        }
        popNavigation();
      }
    },
    300,
    {
      leading: true,
      trailing: false,
    },
  );

  return (
    <ListItem testID="account-add-account" onPress={handleAddAccount}>
      <Stack bg="$bgStrong" borderRadius="$2" p="$2" borderCurve="continuous">
        <Icon name="PlusSmallOutline" />
      </Stack>
      {/* Add account */}
      <ListItem.Text
        userSelect="none"
        primary={intl.formatMessage({
          id: ETranslations.global_add_account,
        })}
        primaryTextProps={{
          color: '$textSubdued',
        }}
      />
    </ListItem>
  );
}
