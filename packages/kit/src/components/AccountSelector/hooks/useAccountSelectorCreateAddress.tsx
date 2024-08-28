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
  IDBDevice,
  IDBWalletId,
} from '@onekeyhq/kit-bg/src/dbs/local/types';
import type { IAccountDeriveTypes } from '@onekeyhq/kit-bg/src/vaults/types';
import { FIRMWARE_UPDATE_WEB_TOOLS_URL } from '@onekeyhq/shared/src/config/appConfig';
import type { IOneKeyError } from '@onekeyhq/shared/src/errors/types/errorTypes';
import { EOneKeyErrorClassNames } from '@onekeyhq/shared/src/errors/types/errorTypes';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import { EReasonForNeedPassword } from '@onekeyhq/shared/types/setting';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useAccountSelectorActions } from '../../../states/jotai/contexts/accountSelector';
// import { TutorialsList } from '../../TutorialsList';

import { useCreateQrWallet } from './useCreateQrWallet';

export function useAccountSelectorCreateAddress() {
  const intl = useIntl();
  const { serviceAccount, serviceQrWallet, serviceBatchCreateAccount } =
    backgroundApiProxy;

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

      const addAccountsForAllNetwork = async () => {
        if (account?.walletId) {
          await backgroundApiProxy.servicePassword.promptPasswordVerifyByWallet(
            {
              walletId: account?.walletId,
              reason: EReasonForNeedPassword.CreateOrRemoveWallet,
            },
          );
        }

        await serviceBatchCreateAccount.addDefaultNetworkAccounts({
          walletId: account?.walletId,
          indexedAccountId: account?.indexedAccountId,
        });
        return handleAddAccounts({
          walletId: account?.walletId,
          indexedAccountId: account?.indexedAccountId,
          accounts: [],
        });
      };

      const addAccounts = async () => {
        if (networkUtils.isAllNetwork({ networkId: account.networkId })) {
          await addAccountsForAllNetwork();
          return;
        }
        const result = await serviceAccount.addHDOrHWAccounts({
          walletId: account?.walletId,
          indexedAccountId: account?.indexedAccountId,
          networkId: account?.networkId,
          deriveType: account?.deriveType,
        });
        return handleAddAccounts(result);
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
                onCancelText: intl.formatMessage({
                  id: ETranslations.global_close,
                }),
                renderContent: (
                  <Stack gap="$2">
                    {/* <TutorialsList
                      tutorials={[
                        {
                          title: intl.formatMessage({
                            id: ETranslations.qr_wallet_address_creation_failed_supports_network_desc,
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

                    <XStack mt="$2" gap="$1.5">
                      <SizableText color="$textSubdued">
                        {intl.formatMessage({
                          id: ETranslations.contact_us_instruction,
                        })}
                      </SizableText>
                      <Button
                        variant="tertiary"
                        // onPress={() => Linking.openURL(requestsUrl)}
                      >
                        {intl.formatMessage({
                          id: ETranslations.global_contact_us,
                        })}
                      </Button>
                    </XStack> */}
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
      intl,
      serviceAccount,
      serviceBatchCreateAccount,
      serviceQrWallet,
    ],
  );

  return {
    createAddress,
  };
}
