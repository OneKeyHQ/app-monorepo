import { useCallback, useState } from 'react';

import { EDeviceType } from '@onekeyfe/hd-shared';
import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import {
  Dialog,
  ESwitchSize,
  Icon,
  Input,
  LinearGradient,
  SizableText,
  Switch,
  Toast,
  XStack,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useCreateQrWallet } from '@onekeyhq/kit/src/components/AccountSelector/hooks/useCreateQrWallet';
import { HyperlinkText } from '@onekeyhq/kit/src/components/HyperlinkText';
import { useThemeVariant } from '@onekeyhq/kit/src/hooks/useThemeVariant';
import { useAccountSelectorActions } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import type { IDBWallet } from '@onekeyhq/kit-bg/src/dbs/local/types';
import type { ISettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/settings';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/settings';
import errorToastUtils from '@onekeyhq/shared/src/errors/utils/errorToastUtils';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

function AddHiddenWalletDialogContent() {
  const [settings, setSettings] = useSettingsPersistAtom();
  const intl = useIntl();
  const themeVariant = useThemeVariant();

  return (
    <YStack mx="$-5" mt="$-10">
      <XStack p="$4" gap="$2" flexWrap="wrap" justifyContent="center">
        {Array.from({ length: 12 }).map((_, index) => (
          <XStack
            key={index}
            minWidth="$15"
            // flex={1}
            gap="$2"
            alignItems="center"
          >
            <SizableText
              size="$bodySm"
              color="$textSubdued"
              w="$4"
              textAlign="right"
            >
              {index + 1}
            </SizableText>
            <SizableText size="$bodySm" transform={[{ translateY: 2 }]}>
              ****
            </SizableText>
          </XStack>
        ))}
        <YStack position="absolute" left="$4" right="$4" top="$4" bottom="$4">
          <LinearGradient
            colors={
              themeVariant === 'light'
                ? ['rgba(255, 255, 255, 0.7)', 'rgba(255, 255, 255, 0.95)']
                : ['rgba(27, 27, 27, 0.7)', 'rgba(27, 27, 27, 0.95)']
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            justifyContent="center"
            alignItems="center"
            h="100%"
          >
            <XStack
              gap="$2"
              py="$1.5"
              px="$3"
              mb="$2"
              bg="$green4"
              borderWidth={2}
              borderColor="$brand9"
              borderRadius="$2"
              borderCurve="continuous"
              elevation={0.5}
            >
              <SizableText size="$bodySm" color="$brand11">
                13
              </SizableText>
              <SizableText
                size="$bodySm"
                color="$brand12"
                transform={[{ translateY: 2 }]}
              >
                * * * * * *
              </SizableText>
            </XStack>
          </LinearGradient>
        </YStack>
      </XStack>
      <YStack
        borderTopWidth={StyleSheet.hairlineWidth}
        borderTopColor="$neutral3"
        pt="$5"
        px="$5"
        gap="$3"
      >
        <SizableText size="$bodyMd">
          {intl.formatMessage({
            id: ETranslations.add_hidden_wallet_dialog_desc,
          })}
        </SizableText>
        <HyperlinkText
          size="$bodyMd"
          translationId={ETranslations.add_hidden_wallet_dialog_warning_notice}
        />
        <YStack gap="$2" mt="$4">
          <XStack
            alignItems="center"
            gap="$2"
            pl="$3"
            pr="$1.5"
            py="$1.5"
            borderWidth={StyleSheet.hairlineWidth}
            borderColor="$borderSubdued"
            borderRadius="$2"
            borderCurve="continuous"
          >
            <YStack
              w="$5"
              h="$5"
              justifyContent="center"
              alignItems="center"
              borderWidth={1}
              borderStyle="dashed"
              borderColor="$borderSubdued"
              borderRadius="$full"
            >
              <Icon name="PlusSmallOutline" size="$4" color="$iconSubdued" />
            </YStack>
            <YStack flex={1}>
              <SizableText
                userSelect="none"
                size="$bodyMd"
                color="$textSubdued"
              >
                {intl.formatMessage({
                  id: ETranslations.add_hidden_wallet_dialog_add_button_display,
                })}
              </SizableText>
            </YStack>
            <Switch
              size={ESwitchSize.small}
              value={settings.showAddHiddenInWalletSidebar}
              onChange={(value) => {
                setSettings(
                  (prev): ISettingsPersistAtom => ({
                    ...prev,
                    showAddHiddenInWalletSidebar: !!value,
                  }),
                );
                if (!value) {
                  Toast.message({
                    title: intl.formatMessage({
                      id: ETranslations.add_hidden_wallet_dialog_add_button_display_toast,
                    }),
                  });
                }
              }}
            />
          </XStack>
        </YStack>
      </YStack>
    </YStack>
  );
}

function AddHdHiddenWalletPassphraseContent({
  onPassphraseChange,
  onConfirmPassphraseChange,
}: {
  onPassphraseChange: (value: string) => void;
  onConfirmPassphraseChange: (value: string) => void;
}) {
  const intl = useIntl();
  return (
    <YStack gap="$4">
      <SizableText size="$bodyMd">
        {intl.formatMessage({
          id: ETranslations.global_passphrase_desc,
        })}
      </SizableText>
      <Input
        secureTextEntry
        placeholder={intl.formatMessage({
          id: ETranslations.global_enter_passphrase,
        })}
        onChangeText={onPassphraseChange}
      />
      <Input
        secureTextEntry
        placeholder={intl.formatMessage({
          id: ETranslations.form_confirm_passphrase_placeholder,
        })}
        onChangeText={onConfirmPassphraseChange}
      />
    </YStack>
  );
}

export function useAddHiddenWallet() {
  const intl = useIntl();
  const actions = useAccountSelectorActions();
  const [isLoading, setIsLoading] = useState(false);
  const { createQrWallet } = useCreateQrWallet();

  const createHwHiddenWallet = useCallback(
    async ({ wallet }: { wallet?: IDBWallet }) => {
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
          await backgroundApiProxy.serviceHardwareUI.closeHardwareUiStateDialog(
            {
              connectId: device?.connectId,
              hardClose: true,
            },
          );
        }
      }
    },
    [actions, intl],
  );

  const createHdHiddenWallet = useCallback(
    async ({ wallet }: { wallet?: IDBWallet }) =>
      new Promise<void>((resolve, reject) => {
        const passphraseRef = { current: '' };
        const confirmPassphraseRef = { current: '' };

        Dialog.show({
          title: intl.formatMessage({
            id: ETranslations.global_add_hidden_wallet,
          }),
          onConfirmText: intl.formatMessage({
            id: ETranslations.global_confirm,
          }),
          renderContent: (
            <AddHdHiddenWalletPassphraseContent
              onPassphraseChange={(value) => {
                passphraseRef.current = value;
              }}
              onConfirmPassphraseChange={(value) => {
                confirmPassphraseRef.current = value;
              }}
            />
          ),
          onConfirm: async ({ close }) => {
            try {
              if (!passphraseRef.current) {
                Toast.error({
                  title: intl.formatMessage({
                    id: ETranslations.global_enter_passphrase,
                  }),
                });
                return;
              }
              if (passphraseRef.current !== confirmPassphraseRef.current) {
                Toast.error({
                  title: intl.formatMessage({
                    id: ETranslations.feedback_passphrase_not_matched,
                  }),
                });
                return;
              }

              setIsLoading(true);
              const encodedPassphrase =
                await backgroundApiProxy.servicePassword.encodeSensitiveText({
                  text: passphraseRef.current,
                });
              await close();
              await actions.current.createHDHiddenWallet(
                {
                  walletId: wallet?.id || '',
                  passphrase: encodedPassphrase,
                },
                {
                  addDefaultNetworkAccounts: true,
                },
              );
              Toast.success({
                title: intl.formatMessage({
                  id: ETranslations.global_success,
                }),
              });
              resolve();
            } catch (error) {
              reject(error);
            } finally {
              setIsLoading(false);
            }
          },
          onCancel: () => {
            reject(new Error('User cancelled'));
          },
        });
      }),
    [actions, intl],
  );

  const createQrHiddenWallet = useCallback(
    async ({ wallet: _wallet }: { wallet?: IDBWallet }) => {
      try {
        defaultLogger.account.wallet.addWalletStarted({
          addMethod: 'ConnectHWWallet',
          details: {
            hardwareWalletType: 'Hidden',
            communication: 'QRCode',
          },
          isSoftwareWalletOnlyUser: false,
        });

        await createQrWallet({
          isOnboarding: true,
          onFinalizeWalletSetupError: () => {
            // only pop when finalizeWalletSetup pushed
            // navigation.pop();
          },
        });

        defaultLogger.account.wallet.walletAdded({
          status: 'success',
          addMethod: 'ConnectHWWallet',
          details: {
            hardwareWalletType: 'Hidden',
            communication: 'QRCode',
            deviceType: EDeviceType.Pro,
          },
          isSoftwareWalletOnlyUser: false,
        });
      } catch (error) {
        errorToastUtils.toastIfError(error);
        defaultLogger.account.wallet.walletAdded({
          status: 'failure',
          addMethod: 'ConnectHWWallet',
          details: {
            hardwareWalletType: 'Hidden',
            communication: 'QRCode',
            deviceType: EDeviceType.Pro,
          },
          isSoftwareWalletOnlyUser: false,
        });
        throw error;
      }
    },
    [createQrWallet],
  );

  const createHiddenWallet = useCallback(
    async ({ wallet }: { wallet?: IDBWallet }) => {
      if (accountUtils.isHdWallet({ walletId: wallet?.id })) {
        await createHdHiddenWallet({ wallet });
      }
      if (accountUtils.isHwWallet({ walletId: wallet?.id })) {
        await createHwHiddenWallet({ wallet });
      }
      if (accountUtils.isQrWallet({ walletId: wallet?.id })) {
        await createQrHiddenWallet({ wallet });
      }
    },
    [createHdHiddenWallet, createHwHiddenWallet, createQrHiddenWallet],
  );

  const createHiddenWalletWithDialogConfirm = useCallback(
    async ({ wallet }: { wallet?: IDBWallet }) => {
      return new Promise<void>((resolve, reject) => {
        Dialog.show({
          showExitButton: false,
          renderContent: <AddHiddenWalletDialogContent />,
          onConfirmText: intl.formatMessage({
            id: ETranslations.global_continue,
          }),
          onConfirm: async ({ close }) => {
            try {
              void close();
              await createHiddenWallet({ wallet });
              resolve();
            } catch (error) {
              reject(error);
            }
          },
          onCancel: () => {
            reject(new Error('User cancelled'));
          },
        });
      });
    },
    [createHiddenWallet, intl],
  );

  return {
    createHiddenWallet,
    createHiddenWalletWithDialogConfirm,
    isLoading,
  };
}
