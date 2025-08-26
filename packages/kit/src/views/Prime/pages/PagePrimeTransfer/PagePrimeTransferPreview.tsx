import { useCallback, useMemo, useState } from 'react';

import { debounce } from 'lodash';
import natsort from 'natsort';
import { useIntl } from 'react-intl';

import type { IDialogInstance } from '@onekeyhq/components';
import {
  Button,
  Checkbox,
  Dialog,
  Input,
  Page,
  SizableText,
  Stack,
  Toast,
  XStack,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AccountAvatar } from '@onekeyhq/kit/src/components/AccountAvatar';
import { getPasswordKeyboardType } from '@onekeyhq/kit/src/components/Password/utils';
import { WalletAvatar } from '@onekeyhq/kit/src/components/WalletAvatar';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useAppRoute } from '@onekeyhq/kit/src/hooks/useAppRoute';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import type {
  IDBAccount,
  IDBWallet,
} from '@onekeyhq/kit-bg/src/dbs/local/types';
import { usePrimeTransferAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/prime';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type {
  EPrimePages,
  IPrimeParamList,
} from '@onekeyhq/shared/src/routes/prime';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import type {
  IPrimeTransferAccount,
  IPrimeTransferData,
  IPrimeTransferHDWallet,
  IPrimeTransferSelectedItemMap,
  IPrimeTransferSelectedItemMapInfo,
} from '@onekeyhq/shared/types/prime/primeTransferTypes';

import { usePrimeTransferExit } from './components/hooks/usePrimeTransferExit';
import { PrimeTransferExitPrevent } from './components/PrimeTransferExitPrevent';
import { showPrimeTransferImportProcessingDialog } from './components/PrimeTransferImportProcessingDialog';

function PreviewHeader({
  title,
  isFirst = false,
  buttonProps,
}: {
  title: string;
  isFirst?: boolean;
  buttonProps?: {
    isAllSelected: boolean;
    onPress: () => void;
  };
}) {
  const intl = useIntl();

  return (
    <XStack
      mt={isFirst ? '$0' : '$4'}
      mb="$2"
      alignItems="center"
      justifyContent="space-between"
    >
      <SizableText pl="$3" size="$headingSm" color="$textSubdued">
        {title}
      </SizableText>
      <XStack pr="$2.5">
        {buttonProps ? (
          <Button size="small" variant="tertiary" onPress={buttonProps.onPress}>
            {intl.formatMessage({
              id: buttonProps.isAllSelected
                ? ETranslations.global_deselect_all
                : ETranslations.global_select_all,
            })}
          </Button>
        ) : null}
      </XStack>
    </XStack>
  );
}

function PreviewItem({
  wallet,
  account,
  onSelect,
  selectedItemMapInfo,
}: {
  wallet?: IPrimeTransferHDWallet;
  account?: IPrimeTransferAccount;
  onSelect: (id: string) => void;
  selectedItemMapInfo: IPrimeTransferSelectedItemMapInfo;
}) {
  const intl = useIntl();
  const itemId = wallet?.id || account?.id || '';
  const onChange = useCallback(() => {
    if (!selectedItemMapInfo?.[itemId]?.disabled) {
      onSelect?.(itemId);
    } else {
      Toast.error({
        title: appLocale.intl.formatMessage({
          id: ETranslations.transfer_web_only_supports_watch_only_transfer,
        }),
      });
    }
  }, [itemId, onSelect, selectedItemMapInfo]);

  return (
    <Stack
      opacity={selectedItemMapInfo?.[itemId]?.disabled ? 0.5 : 1}
      onPress={() => {
        onChange();
      }}
      px="$3"
      py="$2"
      borderRadius="$3"
      backgroundColor="$bgSubdued"
      hoverStyle={{
        backgroundColor: '$bgHover',
      }}
      cursor="pointer"
    >
      <XStack gap="$3" alignItems="center" flex={1}>
        {wallet?.avatarInfo ? (
          <WalletAvatar wallet={wallet as unknown as IDBWallet} />
        ) : null}
        {account ? (
          <AccountAvatar
            account={account as any}
            networkId={account.createAtNetwork}
          />
        ) : null}
        <YStack flex={1}>
          <SizableText
            numberOfLines={1}
            size="$bodyLgMedium"
            color="$text"
            w="100%"
          >
            {wallet?.name || account?.name}
          </SizableText>
          <SizableText size="$bodyMd" color="$textSubdued">
            {wallet
              ? intl.formatMessage(
                  {
                    id: ETranslations.global_transfer_accounts_count,
                  },
                  {
                    amount: wallet?.indexedAccountUUIDs?.length || 0,
                  },
                )
              : accountUtils.shortenAddress({
                  address: account?.address || '',
                  leadingLength: 6,
                  trailingLength: 4,
                })}
          </SizableText>
        </YStack>
        <Stack w="$5">
          <Checkbox
            disabled={selectedItemMapInfo[itemId].disabled}
            shouldStopPropagation
            value={selectedItemMapInfo[itemId].checked}
            onChange={() => {
              onChange();
            }}
            onChangeForDisabled={() => {
              onChange();
            }}
          />
        </Stack>
      </XStack>
    </Stack>
  );
}

const accountSortFn = (a: IDBAccount, b: IDBAccount) =>
  natsort({ insensitive: true })(
    a.accountOrder ?? a.accountOrderSaved ?? 0,
    b.accountOrder ?? b.accountOrderSaved ?? 0,
  );

const walletSortFn = (a: IPrimeTransferHDWallet, b: IPrimeTransferHDWallet) =>
  natsort({ insensitive: true })(
    a.walletOrder ?? a.walletOrderSaved ?? 0,
    b.walletOrder ?? b.walletOrderSaved ?? 0,
  );

function WalletList({
  data,
  selectedItemMap,
  onItemSelectChange,
  onGroupSelectChange,
}: {
  data: IPrimeTransferData;
  selectedItemMap: IPrimeTransferSelectedItemMap;
  onItemSelectChange?: ({
    type,
    id,
  }: {
    type: keyof IPrimeTransferSelectedItemMap;
    id: string;
  }) => void;
  onGroupSelectChange?: ({
    type,
    selectAll,
  }: {
    type: keyof IPrimeTransferSelectedItemMap;
    selectAll: boolean;
  }) => void;
}) {
  const { wallets, importedAccounts, watchingAccounts } = useMemo(() => {
    const _wallets = Object.values(data.privateData.wallets);
    const _importedAccounts = Object.values(data.privateData.importedAccounts);
    const _watchingAccounts = Object.values(data.privateData.watchingAccounts);
    return {
      wallets: _wallets.sort((a, b) => walletSortFn(a, b)),
      importedAccounts: _importedAccounts.sort((a, b) => accountSortFn(a, b)),
      watchingAccounts: _watchingAccounts.sort((a, b) => accountSortFn(a, b)),
    };
  }, [data]);

  const intl = useIntl();

  // 计算分组的选择状态
  const getGroupSelectStatus = useCallback(
    (type: keyof IPrimeTransferSelectedItemMap) => {
      const items = selectedItemMap[type];
      const availableItems = Object.values(items).filter(
        (item) => !item.disabled,
      );
      const selectedItems = availableItems.filter((item) => item.checked);

      return {
        isAllSelected:
          selectedItems.length === availableItems.length &&
          availableItems.length > 0,
      };
    },
    [selectedItemMap],
  );

  const walletGroupStatus = getGroupSelectStatus('wallet');
  const importedAccountGroupStatus = getGroupSelectStatus('importedAccount');
  const watchingAccountGroupStatus = getGroupSelectStatus('watchingAccount');

  return (
    <Stack gap={1}>
      {wallets?.length ? (
        <PreviewHeader
          title={intl.formatMessage({
            id: ETranslations.global_software_wallet,
          })}
          isFirst
          buttonProps={{
            isAllSelected: walletGroupStatus.isAllSelected,
            onPress: () =>
              onGroupSelectChange?.({
                type: 'wallet',
                selectAll: !walletGroupStatus.isAllSelected,
              }),
          }}
        />
      ) : null}
      {wallets.map((wallet) => (
        <PreviewItem
          key={wallet.id}
          wallet={wallet}
          selectedItemMapInfo={selectedItemMap.wallet}
          onSelect={(id) => onItemSelectChange?.({ type: 'wallet', id })}
        />
      ))}

      {importedAccounts?.length ? (
        <PreviewHeader
          title={intl.formatMessage({
            id: ETranslations.wallet_label_private_key,
          })}
          buttonProps={{
            isAllSelected: importedAccountGroupStatus.isAllSelected,
            onPress: () =>
              onGroupSelectChange?.({
                type: 'importedAccount',
                selectAll: !importedAccountGroupStatus.isAllSelected,
              }),
          }}
        />
      ) : null}
      {importedAccounts.map((account) => (
        <PreviewItem
          key={account.id}
          account={account}
          selectedItemMapInfo={selectedItemMap.importedAccount}
          onSelect={(id) =>
            onItemSelectChange?.({ type: 'importedAccount', id })
          }
        />
      ))}

      {watchingAccounts?.length ? (
        <PreviewHeader
          title={intl.formatMessage({
            id: ETranslations.global_watched,
          })}
          buttonProps={{
            isAllSelected: watchingAccountGroupStatus.isAllSelected,
            onPress: () =>
              onGroupSelectChange?.({
                type: 'watchingAccount',
                selectAll: !watchingAccountGroupStatus.isAllSelected,
              }),
          }}
        />
      ) : null}
      {watchingAccounts.map((account) => (
        <PreviewItem
          key={account.id}
          account={account}
          selectedItemMapInfo={selectedItemMap.watchingAccount}
          onSelect={(id) =>
            onItemSelectChange?.({ type: 'watchingAccount', id })
          }
        />
      ))}
    </Stack>
  );
}

export default function PagePrimeTransferPreview() {
  const intl = useIntl();
  const [isImporting, setIsImporting] = useState(false);
  const navigation = useAppNavigation();
  const [primeTransferAtom] = usePrimeTransferAtom();
  const { exitTransferFlow } = usePrimeTransferExit();
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
      ).reduce((acc, account) => {
        acc[account.id] = {
          checked: true,
          disabled: false,
        };
        return acc;
      }, {} as { [id: string]: { checked: boolean; disabled: boolean } }),
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
    }: {
      type: keyof IPrimeTransferSelectedItemMap;
      id: string;
    }) => {
      setSelectedItemMap((prev) => ({
        ...prev,
        [type]: {
          ...prev[type],
          [id]: {
            ...prev[type][id],
            checked: !prev[type][id].checked,
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
      const firstWalletCredential =
        selectedTransferData?.wallets?.[0]?.credential;
      const firstImportedAccountCredential =
        selectedTransferData?.importedAccounts?.[0]?.credential;

      let localPassword = '';
      if (firstWalletCredential || firstImportedAccountCredential) {
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
          },
        );

      let remoteDevicePassword = '';
      let remotePasswordDialog: IDialogInstance | null = null;

      const startImport = async () => {
        try {
          void remotePasswordDialog?.close();

          await backgroundApiProxy.servicePrimeTransfer.initImportProgress({
            selectedTransferData,
          });

          // Show progress dialog
          showPrimeTransferImportProcessingDialog({
            navigation,
          });

          const usedPassword = remoteDevicePassword || localPassword;
          const { success, errorsInfo } =
            await backgroundApiProxy.servicePrimeTransfer.startImport({
              selectedTransferData,
              password: usedPassword
                ? await backgroundApiProxy.servicePassword.encodeSensitiveText({
                    text: usedPassword,
                  })
                : '',
            });

          await backgroundApiProxy.servicePrimeTransfer.completeImportProgress({
            errorsInfo,
          });

          if (success) {
            exitTransferFlow();
          }
        } catch (error) {
          console.error(error);
          await backgroundApiProxy.servicePrimeTransfer.resetImportProgress();
          Toast.error({
            title: appLocale.intl.formatMessage({
              id: ETranslations.global_an_error_occurred,
            }),
            message: (error as Error)?.message || 'Unknown error',
          });
          throw error;
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
                  },
                );

              if (canBeDecryptedByRemotePassword) {
                await startImport();
              } else {
                Toast.error({
                  title: appLocale.intl.formatMessage({
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
    directionUserInfo?.fromUser?.appPlatformName,
    intl,
    isImporting,
    navigation,
    selectedTransferData,
    exitTransferFlow,
  ]);

  return (
    <Page scrollEnabled>
      <Page.Header
        title={intl.formatMessage({
          id: ETranslations.transfer_transfer_data_preview,
        })}
      />
      <Page.Body>
        <Stack px="$5" pt="$2" gap="$5">
          <WalletList
            selectedItemMap={selectedItemMap}
            data={transferData}
            onItemSelectChange={handleItemSelectChange}
            onGroupSelectChange={handleGroupSelectChange}
          />
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
