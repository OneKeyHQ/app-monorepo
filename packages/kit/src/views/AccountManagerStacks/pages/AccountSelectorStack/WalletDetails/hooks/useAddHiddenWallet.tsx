import { useCallback, useState } from 'react';

import { EDeviceType } from '@onekeyfe/hd-shared';
import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import {
  Dialog,
  ESwitchSize,
  Icon,
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

  const createQrHiddenWallet = useCallback(
    async ({ wallet }: { wallet?: IDBWallet }) => {
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
      if (accountUtils.isHwWallet({ walletId: wallet?.id })) {
        await createHwHiddenWallet({ wallet });
      }
      if (accountUtils.isQrWallet({ walletId: wallet?.id })) {
        await createQrHiddenWallet({ wallet });
      }
    },
    [createHwHiddenWallet, createQrHiddenWallet],
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
