import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { Dialog, SizableText, Stack, Toast } from '@onekeyhq/components';
import type {
  IDBAccount,
  IDBDevice,
  IDBWalletId,
} from '@onekeyhq/kit-bg/src/dbs/local/types';
import type { IWithHardwareProcessingControlParams } from '@onekeyhq/kit-bg/src/services/ServiceHardwareUI/ServiceHardwareUI';
import type { IAccountDeriveTypes } from '@onekeyhq/kit-bg/src/vaults/types';
import type { IOneKeyError } from '@onekeyhq/shared/src/errors/types/errorTypes';
import { EOneKeyErrorClassNames } from '@onekeyhq/shared/src/errors/types/errorTypes';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import { EReasonForNeedPassword } from '@onekeyhq/shared/types/setting';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useAccountSelectorActions } from '../../../states/jotai/contexts/accountSelector';

import { useCreateQrWallet } from './useCreateQrWallet';

export function useAccountSelectorCreateAddress() {
  const {
    serviceAccount,
    serviceQrWallet,
    serviceBatchCreateAccount,
    serviceHardwareUI,
  } = backgroundApiProxy;
  const intl = useIntl();
  const actions = useAccountSelectorActions();
  const { createQrWallet, createQrWalletByUr } = useCreateQrWallet();

  const createAddress = useCallback(
    async ({
      num,
      selectAfterCreate,
      account,
    }: {
      num: number;
      selectAfterCreate?: boolean;
      account: {
        walletId: IDBWalletId | undefined;
        networkId: string | undefined;
        indexedAccountId: string | undefined;
        deriveType: IAccountDeriveTypes;
      };
    }) => {
      if (
        !account ||
        !account.walletId ||
        !account.networkId ||
        !account.indexedAccountId ||
        !account.deriveType
      ) {
        Toast.error({
          title: 'Create address failed',
          message: 'Please select a valid account',
        });
        return;
      }

      let connectId: string | undefined;
      if (
        account.walletId &&
        accountUtils.isHwWallet({
          walletId: account.walletId,
        })
      ) {
        const device = await serviceAccount.getWalletDevice({
          walletId: account.walletId,
        });
        connectId = device?.connectId;
      }

      const handleAddAccounts = async (
        result:
          | {
              walletId: string | undefined;
              indexedAccountId: string | undefined;
              accounts: IDBAccount[];
            }
          | undefined,
      ) => {
        console.log(result);
        // await refreshCurrentAccount();
        actions.current.refresh({ num });

        if (selectAfterCreate) {
          await actions.current.updateSelectedAccountForHdOrHwAccount({
            num,
            walletId: result?.walletId,
            indexedAccountId: result?.indexedAccountId,
          });
        }
        return result;
      };

      const hwUiControlParams: IWithHardwareProcessingControlParams = {
        skipDeviceCancelAtFirst: true,
        skipWaitingAnimationAtFirst: true,
        skipCloseHardwareUiStateDialog: true,
      };

      const addAccountsForAllNetwork = async () => {
        if (account?.walletId) {
          await backgroundApiProxy.servicePassword.promptPasswordVerifyByWallet(
            {
              walletId: account?.walletId,
              reason: EReasonForNeedPassword.CreateOrRemoveWallet,
            },
          );
        }

        // TODO: cancel creating workflow by close checking device UI dialog
        await serviceBatchCreateAccount.addDefaultNetworkAccounts({
          walletId: account?.walletId,
          indexedAccountId: account?.indexedAccountId,
          ...hwUiControlParams,
        });
        return handleAddAccounts({
          walletId: account?.walletId,
          indexedAccountId: account?.indexedAccountId,
          accounts: [],
        });
      };

      const addAccounts = async () => {
        try {
          if (networkUtils.isAllNetwork({ networkId: account.networkId })) {
            await addAccountsForAllNetwork();
            return;
          }
          const result = await serviceAccount.addHDOrHWAccounts({
            walletId: account?.walletId,
            indexedAccountId: account?.indexedAccountId,
            networkId: account?.networkId,
            deriveType: account?.deriveType,
            ...hwUiControlParams,
          });
          return await handleAddAccounts(result);
        } finally {
          if (connectId) {
            // as skipCloseHardwareUiStateDialog is true, so we need to close the dialog manually
            await serviceHardwareUI.closeHardwareUiStateDialog({
              connectId,
            });
          }
        }
      };

      const isAirGapAccountNotFound = (error: Error | unknown) =>
        (error as IOneKeyError)?.className ===
        EOneKeyErrorClassNames.OneKeyErrorAirGapAccountNotFound;

      try {
        return await addAccounts();
      } catch (error1) {
        if (isAirGapAccountNotFound(error1)) {
          let byDevice: IDBDevice | undefined;
          const byWallet = await serviceAccount.getWallet({
            walletId: account.walletId,
          });
          if (byWallet.associatedDevice) {
            byDevice = await serviceAccount.getDevice({
              dbDeviceId: byWallet.associatedDevice,
            });
          }
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          // const { wallet: walletCreated } = await createQrWallet({
          //   isOnboarding: false,
          //   byDevice,
          //   byWallet,
          // });
          const urJson = await serviceQrWallet.prepareQrcodeWalletAddressCreate(
            {
              walletId: account.walletId,
              networkId: account.networkId,
              indexedAccountId: account.indexedAccountId,
            },
          );
          const { wallet: walletCreated } = await createQrWalletByUr({
            urJson,
            byDevice,
            byWallet,
          });

          try {
            return await addAccounts();
          } catch (error2) {
            if (isAirGapAccountNotFound(error2)) {
              Dialog.show({
                title: 'Address creation failed',
                showConfirmButton: false,
                onCancelText: 'Close',
                renderContent: (
                  <Stack>
                    <SizableText>
                      1. Check our website to verify if your hardware wallet
                      supports the current network.
                    </SizableText>
                    <SizableText>
                      2. Connect via USB and visit our firmware update tool.
                      Disable Air-gap mode if necessary.
                    </SizableText>
                    <SizableText>
                      3. If issues persist, the QR Wallet may not support this
                      derivation path.
                    </SizableText>
                    <SizableText>Need more help? Contact us.</SizableText>
                  </Stack>
                ),
              });
            } else {
              throw error2;
            }
          }
        } else {
          throw error1;
        }
      }
    },
    [
      actions,
      createQrWalletByUr,
      serviceAccount,
      serviceBatchCreateAccount,
      serviceHardwareUI,
      serviceQrWallet,
    ],
  );

  return {
    createAddress,
  };
}
