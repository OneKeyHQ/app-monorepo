import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { debounce } from 'lodash';
import { useIntl } from 'react-intl';

import type { IDialogInstance } from '@onekeyhq/components';
import {
  Button,
  Dialog,
  Input,
  Page,
  Stack,
  Toast,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { getPasswordKeyboardType } from '@onekeyhq/kit/src/components/Password/utils';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useAppRoute } from '@onekeyhq/kit/src/hooks/useAppRoute';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { usePrimeTransferAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/prime';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type {
  EPrimePages,
  IPrimeParamList,
} from '@onekeyhq/shared/src/routes/prime';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type { IPrimeTransferSelectedItemMap } from '@onekeyhq/shared/types/prime/primeTransferTypes';

import { usePrimeTransferExit } from './components/hooks/usePrimeTransferExit';
import { PrimeTransferExitPrevent } from './components/PrimeTransferExitPrevent';
import {
  registerPrimeTransferImportTraceDebugGlobal,
  showPrimeTransferImportProcessingDialog,
} from './components/PrimeTransferImportProcessingDialog';
import { PrimeTransferPreviewList } from './components/PrimeTransferPreviewList';

export default function PagePrimeTransferPreview() {
  const intl = useIntl();
  const [isImporting, setIsImporting] = useState(false);
  // Synchronous re-entrancy guard for the import flow. React state (isImporting)
  // updates asynchronously, so it cannot block two near-simultaneous triggers
  // (e.g. the remote-password dialog submitted via both the confirm button and
  // the input's onSubmitEditing). A ref flips synchronously. See OK-56787.
  const importInFlightRef = useRef(false);
  const navigation = useAppNavigation();
  const [primeTransferAtom] = usePrimeTransferAtom();
  const { exitTransferFlow } = usePrimeTransferExit();

  useEffect(() => {
    // Chrome/AI agents can inspect the transfer-only import trace while this
    // preview page is open:
    // await window.$$oneKeyPrimeTransferDebug.getImportTraceSnapshot()
    registerPrimeTransferImportTraceDebugGlobal();
  }, []);

  const route = useAppRoute<
    IPrimeParamList,
    EPrimePages.PrimeTransferPreview
  >();
  const transferData = useMemo(
    () => route?.params?.transferData || undefined,
    [route?.params],
  );
  const directionUserInfo = useMemo(
    () => route?.params?.directionUserInfo || undefined,
    [route?.params],
  );
  const selectedAllMapData = useMemo<IPrimeTransferSelectedItemMap>(() => {
    return {
      wallet: Object.values(transferData?.privateData?.wallets || {}).reduce(
        (acc, wallet) => {
          const shouldDisabled = Boolean(
            platformEnv.isWebDappMode &&
            accountUtils.isHdWallet({
              walletId: wallet?.id || '',
            }),
          );
          acc[wallet.id] = {
            checked: !shouldDisabled,
            disabled: shouldDisabled,
          };
          return acc;
        },
        {} as {
          [id: string]: {
            checked: boolean;
            disabled: boolean;
          };
        },
      ),
      importedAccount: Object.values(
        transferData?.privateData?.importedAccounts || {},
      ).reduce(
        (acc, account) => {
          const shouldDisabled = Boolean(
            platformEnv.isWebDappMode &&
            accountUtils.isImportedAccount({
              accountId: account?.id || '',
            }),
          );

          acc[account.id] = {
            checked: !shouldDisabled,
            disabled: shouldDisabled,
          };
          return acc;
        },
        {} as {
          [id: string]: {
            checked: boolean;
            disabled: boolean;
          };
        },
      ),
      watchingAccount: Object.values(
        transferData?.privateData?.watchingAccounts || {},
      ).reduce(
        (acc, account) => {
          acc[account.id] = {
            checked: true,
            disabled: false,
          };
          return acc;
        },
        {} as { [id: string]: { checked: boolean; disabled: boolean } },
      ),
    };
  }, [
    transferData?.privateData?.wallets,
    transferData?.privateData?.importedAccounts,
    transferData?.privateData?.watchingAccounts,
  ]);

  const [selectedItemMap, setSelectedItemMap] =
    useState<IPrimeTransferSelectedItemMap>(selectedAllMapData);

  const handleItemSelectChange = useCallback(
    ({
      type,
      id,
      checked,
    }: {
      type: keyof IPrimeTransferSelectedItemMap;
      id: string;
      checked?: boolean;
    }) => {
      setSelectedItemMap((prev) => ({
        ...prev,
        [type]: {
          ...prev[type],
          [id]: {
            ...prev[type][id],
            checked: checked ?? !prev[type][id].checked,
          },
        },
      }));
    },
    [],
  );

  const handleGroupSelectChange = useCallback(
    ({
      type,
      selectAll,
    }: {
      type: keyof IPrimeTransferSelectedItemMap;
      selectAll: boolean;
    }) => {
      setSelectedItemMap((prev) => {
        const next = { ...prev, [type]: { ...prev[type] } };
        Object.keys(next[type]).forEach((id) => {
          if (!next[type][id].disabled) {
            next[type][id] = { ...next[type][id], checked: selectAll };
          }
        });
        return next;
      });
    },
    [],
  );

  const { result: selectedTransferData } = usePromiseResult(async () => {
    const d =
      await backgroundApiProxy.servicePrimeTransfer.getSelectedTransferData({
        data: transferData,
        selectedItemMap,
      });
    return d;
  }, [selectedItemMap, transferData]);
  const isSelectedEmpty = useMemo(() => {
    return (
      !selectedTransferData?.wallets?.length &&
      !selectedTransferData?.importedAccounts?.length &&
      !selectedTransferData?.watchingAccounts?.length
    );
  }, [selectedTransferData]);

  const debugButtons = useMemo(() => {
    if (process.env.NODE_ENV !== 'production') {
      return (
        <>
          <Button
            testID="prime-debug-buttons-btn"
            onPress={() => {
              Dialog.debugMessage({
                debugMessage: selectedTransferData || transferData,
              });
            }}
          >
            Print data
          </Button>
        </>
      );
    }
    return <></>;
  }, [selectedTransferData, transferData]);

  const onConfirm = useCallback(async () => {
    if (!selectedTransferData) {
      return;
    }
    if (isImporting) {
      return;
    }

    try {
      setIsImporting(true);
      const firstWalletCredential = selectedTransferData.wallets.find(
        (item) => item.credential,
      )?.credential;
      const firstImportedAccountCredential =
        selectedTransferData.importedAccounts.find(
          (item) => item.credential,
        )?.credential;
      // The shared payload can contain private credentials even when only
      // watching accounts are selected. They require no source-device password.
      const selectedPrivateItems = [
        ...selectedTransferData.wallets,
        ...selectedTransferData.importedAccounts,
      ];
      const decryptedCredentialsHex = selectedPrivateItems.length
        ? transferData?.privateData?.decryptedCredentialsHex
        : undefined;

      let localPassword = '';
      if (
        firstWalletCredential ||
        firstImportedAccountCredential ||
        decryptedCredentialsHex ||
        selectedPrivateItems.some((item) => item.credentialDecrypted)
      ) {
        const { password } =
          await backgroundApiProxy.servicePassword.promptPasswordVerify();
        localPassword = password;
      }

      let canBeDecryptedByRemotePassword = false;
      const canBeDecrypted =
        await backgroundApiProxy.servicePrimeTransfer.verifyCredentialCanBeDecrypted(
          {
            password: localPassword,
            walletCredential: firstWalletCredential,
            importedAccountCredential: firstImportedAccountCredential,
            decryptedCredentialsHex,
          },
        );

      let remoteDevicePassword = '';
      let remotePasswordDialog: IDialogInstance | null = null;

      const startImport = async () => {
        if (importInFlightRef.current) {
          return;
        }
        importInFlightRef.current = true;
        let importDialog: IDialogInstance | undefined;
        let importTaskUUID: string | undefined;
        try {
          importTaskUUID =
            await backgroundApiProxy.servicePrimeTransfer.prepareImportTask();
          if (!importTaskUUID) return;
          await remotePasswordDialog?.close();

          // exitTransferFlow();
          // await timerUtils.wait(1000);

          // Delay to ensure the dialog is closed before proceeding
          if (platformEnv.isNative) {
            await timerUtils.wait(350);
          }

          await backgroundApiProxy.servicePrimeTransfer.initImportProgress({
            taskUUID: importTaskUUID,
            selectedTransferData,
          });

          // Show progress dialog
          importDialog = showPrimeTransferImportProcessingDialog({
            taskUUID: importTaskUUID,
            intl,
            navigation,
          });

          const localPasswordEncoded = localPassword
            ? await backgroundApiProxy.servicePassword.encodeSensitiveText({
                text: localPassword,
              })
            : '';
          const usedPasswordEncoded = remoteDevicePassword
            ? await backgroundApiProxy.servicePassword.encodeSensitiveText({
                text: remoteDevicePassword,
              })
            : localPasswordEncoded;
          const { success, errorsInfo, taskUUID } =
            await backgroundApiProxy.servicePrimeTransfer.startImport({
              taskUUID: importTaskUUID,
              decryptedCredentialsHex,
              selectedTransferData,
              password: usedPasswordEncoded,
              localPassword: localPasswordEncoded,
            });

          await backgroundApiProxy.servicePrimeTransfer.completeImportProgress({
            errorsInfo,
            taskUUID,
          });

          if (success) {
            exitTransferFlow();
          }
        } catch (error) {
          console.error(error);
          if (importTaskUUID) {
            await backgroundApiProxy.servicePrimeTransfer.resetImportProgress({
              taskUUID: importTaskUUID,
            });
          }
          await importDialog?.close();
          Toast.error({
            title: intl.formatMessage({
              id: ETranslations.global_an_error_occurred,
            }),
            message: (error as Error)?.message || 'Unknown error',
          });
          throw error;
        } finally {
          importInFlightRef.current = false;
        }
      };

      if (canBeDecrypted || canBeDecryptedByRemotePassword) {
        await startImport();
      } else {
        const confirmRemotePasswordCheck = debounce(
          async ({ preventClose }: { preventClose: () => void }) => {
            try {
              preventClose();
              setIsImporting(true);

              canBeDecryptedByRemotePassword =
                await backgroundApiProxy.servicePrimeTransfer.verifyCredentialCanBeDecrypted(
                  {
                    password: remoteDevicePassword,
                    walletCredential: firstWalletCredential,
                    importedAccountCredential: firstImportedAccountCredential,
                    decryptedCredentialsHex,
                  },
                );

              if (canBeDecryptedByRemotePassword) {
                await startImport();
              } else {
                Toast.error({
                  title: intl.formatMessage({
                    id: ETranslations.auth_error_passcode_incorrect,
                  }),
                });
              }
            } finally {
              setIsImporting(false);
            }
          },
          300,
          {
            leading: true,
            trailing: false,
          },
        );
        const secureEntry = true;
        remotePasswordDialog = Dialog.show({
          title: intl.formatMessage({
            id: ETranslations.transfer_verify_passcode,
          }),
          description: intl.formatMessage(
            {
              id: ETranslations.transfer_transfer_verify_passcode_desc,
            },
            {
              'deviceName':
                directionUserInfo?.fromUser?.appPlatformName || '--',
            },
          ),
          showCancelButton: false,
          onConfirm: confirmRemotePasswordCheck,
          renderContent: (
            <Stack>
              <Input
                autoFocus
                testID="remote-device-password-input"
                selectTextOnFocus
                size="large"
                keyboardType={getPasswordKeyboardType(!secureEntry)}
                secureTextEntry={secureEntry}
                onSubmitEditing={() => {
                  void confirmRemotePasswordCheck({ preventClose: () => {} });
                }}
                textContentType="oneTimeCode"
                placeholder={intl.formatMessage({
                  id: ETranslations.auth_enter_your_password,
                })}
                onChangeText={(text) => {
                  remoteDevicePassword = text;
                }}
                allowSecureTextEye
              />
            </Stack>
          ),
        });
      }
    } finally {
      setIsImporting(false);
    }
  }, [
    selectedTransferData,
    isImporting,
    navigation,
    transferData?.privateData?.decryptedCredentialsHex,
    exitTransferFlow,
    intl,
    directionUserInfo?.fromUser?.appPlatformName,
  ]);

  const walletListView = useMemo(() => {
    return (
      <PrimeTransferPreviewList
        selectedItemMap={selectedItemMap}
        data={transferData}
        onItemSelectChange={handleItemSelectChange}
        onGroupSelectChange={handleGroupSelectChange}
      />
    );
  }, [
    selectedItemMap,
    transferData,
    handleItemSelectChange,
    handleGroupSelectChange,
  ]);

  return (
    <Page scrollEnabled={!platformEnv.isNative}>
      <Page.Header
        title={intl.formatMessage({
          id: ETranslations.transfer_transfer_data_preview,
        })}
      />
      <Page.Body>
        <Stack
          flex={platformEnv.isNative ? 1 : undefined}
          px={platformEnv.isNative ? undefined : '$5'}
          pt="$2"
          gap="$5"
        >
          {walletListView}
          {debugButtons}
        </Stack>
      </Page.Body>
      <Page.Footer
        onConfirm={onConfirm}
        confirmButtonProps={{
          disabled: isSelectedEmpty || isImporting,
          loading: isImporting,
        }}
        onConfirmText={intl.formatMessage({
          id: ETranslations.global_import,
        })}
      />
      <PrimeTransferExitPrevent
        shouldPreventRemove={primeTransferAtom.shouldPreventExit}
      />
    </Page>
  );
}
