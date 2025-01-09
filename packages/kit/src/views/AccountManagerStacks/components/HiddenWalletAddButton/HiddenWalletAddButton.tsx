import { useCallback, useState } from 'react';

import { useIntl } from 'react-intl';

import { Toast } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useCreateQrWallet } from '@onekeyhq/kit/src/components/AccountSelector/hooks/useCreateQrWallet';
import { useAccountSelectorActions } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import type { IDBWallet } from '@onekeyhq/kit-bg/src/dbs/local/types';
import errorToastUtils from '@onekeyhq/shared/src/errors/utils/errorToastUtils';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

import { WalletOptionItem } from '../../pages/AccountSelectorStack/WalletDetails/WalletOptions/WalletOptionItem';

export function HiddenWalletAddButton({ wallet }: { wallet?: IDBWallet }) {
  const intl = useIntl();
  const actions = useAccountSelectorActions();
  const [isLoading, setIsLoading] = useState(false);
  const { createQrWallet } = useCreateQrWallet();

  const createHwHiddenWallet = useCallback(async () => {
    try {
      setIsLoading(true);
      await actions.current.createHWHiddenWallet(
        {
          walletId: wallet?.id || '',
        },
        {
          addDefaultNetworkAccounts: true,
          showAddAccountsLoading: true,
        },
      );
      Toast.success({
        title: intl.formatMessage({
          id: ETranslations.global_success,
        }),
      });
    } finally {
      setIsLoading(false);
      const device =
        await backgroundApiProxy.serviceAccount.getWalletDeviceSafe({
          walletId: wallet?.id || '',
        });
      if (device?.connectId) {
        await backgroundApiProxy.serviceHardwareUI.closeHardwareUiStateDialog({
          connectId: device?.connectId,
          hardClose: true,
        });
      }
    }
  }, [actions, intl, wallet?.id]);

  const createQrHiddenWallet = useCallback(async () => {
    try {
      await createQrWallet({
        isOnboarding: true,
        onFinalizeWalletSetupError: () => {
          // only pop when finalizeWalletSetup pushed
          // navigation.pop();
        },
      });
    } catch (error) {
      errorToastUtils.toastIfError(error);
      throw error;
    }
  }, [createQrWallet]);

  if (
    wallet &&
    accountUtils.isHwOrQrWallet({
      walletId: wallet.id,
    }) &&
    !accountUtils.isHwHiddenWallet({ wallet })
  ) {
    return (
      <WalletOptionItem
        icon="LockOutline"
        label={intl.formatMessage({
          id: ETranslations.global_add_hidden_wallet,
        })}
        isLoading={isLoading}
        onPress={async () => {
          if (accountUtils.isHwWallet({ walletId: wallet?.id })) {
            await createHwHiddenWallet();
          }
          if (accountUtils.isQrWallet({ walletId: wallet?.id })) {
            await createQrHiddenWallet();
          }
        }}
      />
    );
  }

  return null;
}
