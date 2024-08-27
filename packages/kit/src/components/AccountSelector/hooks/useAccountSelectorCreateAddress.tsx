import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import {
  Button,
  Dialog,
  SizableText,
  Stack,
  Toast,
  XStack,
} from '@onekeyhq/components';
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
                  <Stack gap="$2">
                    <XStack gap="$3">
                      <Stack
                        borderRadius="$full"
                        w="$6"
                        h="$6"
                        justifyContent="center"
                        alignItems="center"
                        bg="$bgInfo"
                      >
                        <SizableText size="$bodyMd" color="$textInfo">
                          1
                        </SizableText>
                      </Stack>
                      <SizableText>
                        QR wallet supports BTC and EVM-compatible networks, with
                        BIP44 as the only standard for EVM networks.
                      </SizableText>
                    </XStack>
                    <XStack gap="$3">
                      <Stack
                        borderRadius="$full"
                        w="$6"
                        h="$6"
                        justifyContent="center"
                        alignItems="center"
                        bg="$bgInfo"
                      >
                        <SizableText size="$bodyMd" color="$textInfo">
                          2
                        </SizableText>
                      </Stack>
                      <Stack flex={1} alignItems="flex-start">
                        <SizableText>
                          If you can’t create addresses for some EVM networks,
                          update your firmware via our update tool and disable
                          Air-gap mode if it’s on.
                        </SizableText>
                        <Button size="small" pt="$2" iconAfter="OpenOutline">
                          Check for updates
                        </Button>
                      </Stack>
                    </XStack>

                    <XStack mt="$2" gap="$1.5">
                      <SizableText color="$textSubdued">
                        Need more help?
                      </SizableText>
                      <Button variant="tertiary">Contact us</Button>
                    </XStack>
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
