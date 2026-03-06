import { useCallback } from 'react';

import { useIntl } from 'react-intl';
import { Linking } from 'react-native';

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
  IDBWalletId,
} from '@onekeyhq/kit-bg/src/dbs/local/types';
import type { IWithHardwareProcessingControlParams } from '@onekeyhq/kit-bg/src/services/ServiceHardwareUI/ServiceHardwareUI';
import type { IAccountDeriveTypes } from '@onekeyhq/kit-bg/src/vaults/types';
import { FIRMWARE_UPDATE_WEB_TOOLS_URL } from '@onekeyhq/shared/src/config/appConfig';
import { OneKeyErrorAirGapAccountNotFound } from '@onekeyhq/shared/src/errors/errors/appErrors';
import type { IOneKeyError } from '@onekeyhq/shared/src/errors/types/errorTypes';
import { EOneKeyErrorClassNames } from '@onekeyhq/shared/src/errors/types/errorTypes';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { showIntercom } from '@onekeyhq/shared/src/modules3rdParty/intercom';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import { EReasonForNeedPassword } from '@onekeyhq/shared/types/setting';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useAccountSelectorActions } from '../../../states/jotai/contexts/accountSelector';
import { TutorialsList } from '../../TutorialsList';

import { useCreateQrWallet } from './useCreateQrWallet';

export function useAccountSelectorCreateAddress() {
  const { serviceAccount, serviceBatchCreateAccount, serviceHardwareUI } =
    backgroundApiProxy;
  const intl = useIntl();
  const actions = useAccountSelectorActions();
  const { createQrWalletAccount } = useCreateQrWallet();

  const createAddress = useCallback(
    async ({
      num,
      selectAfterCreate,
      account,
      createAllDeriveTypes,
      customNetworks,
    }: {
      num: number;
      selectAfterCreate?: boolean;
      account: {
        walletId: IDBWalletId | undefined;
        networkId: string | undefined;
        indexedAccountId: string | undefined;
        deriveType: IAccountDeriveTypes;
      };
      createAllDeriveTypes?: boolean;
      customNetworks?: {
        networkId: string;
        deriveType: IAccountDeriveTypes;
      }[];
    }) => {
      if (
        !account ||
        !account.walletId ||
        !account.networkId ||
        !account.deriveType
      ) {
        Toast.error({
          title: intl.formatMessage({
            id: ETranslations.toast_create_address_failed_title,
          }),
          message: intl.formatMessage({
            id: ETranslations.toast_create_address_failed_message,
          }),
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
        // If indexedAccountId is empty, create the first account (index 0) for all networks
        const indexes = account?.indexedAccountId ? undefined : [0];
        const result =
          await serviceBatchCreateAccount.addDefaultNetworkAccounts({
            walletId: account?.walletId,
            indexedAccountId: account?.indexedAccountId,
            indexes,
            customNetworks,
            ...hwUiControlParams,
          });
        if (
          result &&
          result?.failedAccounts?.length &&
          accountUtils.isQrWallet({ walletId: account.walletId })
        ) {
          throw new OneKeyErrorAirGapAccountNotFound();
        }

        // If indexedAccountId was empty, get the first indexed account from wallet
        let resultIndexedAccountId = account?.indexedAccountId;
        if (!resultIndexedAccountId && account?.walletId) {
          const { accounts: indexedAccounts } =
            await serviceAccount.getIndexedAccountsOfWallet({
              walletId: account.walletId,
            });
          if (indexedAccounts.length > 0) {
            resultIndexedAccountId = indexedAccounts[0].id;
          }
        }

        return handleAddAccounts({
          walletId: account?.walletId,
          indexedAccountId: resultIndexedAccountId,
          accounts: [],
        });
      };

      const addAccounts = async () => {
        try {
          if (networkUtils.isAllNetwork({ networkId: account.networkId })) {
            await addAccountsForAllNetwork();
            return;
          }
          // If indexedAccountId is empty, create the first account (index 0)
          const indexes = account?.indexedAccountId ? undefined : [0];
          const result = await serviceAccount.addHDOrHWAccounts({
            walletId: account?.walletId,
            indexedAccountId: account?.indexedAccountId,
            networkId: account?.networkId,
            deriveType: account?.deriveType,
            indexes,
            createAllDeriveTypes,
            ...hwUiControlParams,
          });
          return await handleAddAccounts(result);
        } finally {
          if (connectId) {
            // as skipCloseHardwareUiStateDialog is true, so we need to close the dialog manually
            await serviceHardwareUI.closeHardwareUiStateDialog({
              connectId,
              hardClose: true,
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
          let indexedAccountId = account.indexedAccountId;
          if (!indexedAccountId) {
            await serviceAccount.addIndexedAccount({
              walletId: account.walletId,
              indexes: [0],
              skipIfExists: true,
            });
            indexedAccountId = accountUtils.buildIndexedAccountId({
              walletId: account.walletId,
              index: 0,
            });
          }
          await createQrWalletAccount({
            walletId: account.walletId,
            networkId: account.networkId,
            indexedAccountId,
          });

          try {
            return await addAccounts();
          } catch (error2) {
            if (isAirGapAccountNotFound(error2)) {
              const isBtcOnlyWallet =
                await serviceAccount.isBtcOnlyFirmwareByWalletId({
                  walletId: account.walletId,
                });
              Dialog.show({
                title: intl.formatMessage({
                  id: ETranslations.qr_wallet_address_creation_failed_dialog_title,
                }),
                showConfirmButton: false,
                onCancelText: intl.formatMessage({
                  id: ETranslations.global_close,
                }),
                renderContent: (
                  <Stack gap="$2">
                    <TutorialsList
                      tutorials={[
                        {
                          title: intl.formatMessage({
                            id: isBtcOnlyWallet
                              ? ETranslations.qr_wallet_btc_only_address_creation_failed_supports_network_desc
                              : ETranslations.qr_wallet_address_creation_failed_supports_network_desc,
                          }),
                        },
                        {
                          title: intl.formatMessage({
                            id: ETranslations.qr_wallet_address_creation_failed_firmware_update_desc,
                          }),
                          children: (
                            <Stack>
                              <Button
                                size="small"
                                mt="$2"
                                iconAfter="OpenOutline"
                                onPress={() =>
                                  // TODO open help center article to guide user to update firmware by USB/BLE
                                  Linking.openURL(FIRMWARE_UPDATE_WEB_TOOLS_URL)
                                }
                              >
                                {intl.formatMessage({
                                  id: ETranslations.global_check_for_updates,
                                })}
                              </Button>
                            </Stack>
                          ),
                        },
                      ]}
                    />

                    <XStack mt="$2" gap="$1.5" alignItems="center">
                      <SizableText color="$textSubdued">
                        {intl.formatMessage({
                          id: ETranslations.contact_us_instruction,
                        })}
                      </SizableText>
                      <Button variant="tertiary" onPress={() => showIntercom()}>
                        {intl.formatMessage({
                          id: ETranslations.global_contact_us,
                        })}
                      </Button>
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
      createQrWalletAccount,
      intl,
      serviceAccount,
      serviceBatchCreateAccount,
      serviceHardwareUI,
    ],
  );

  return {
    createAddress,
  };
}
