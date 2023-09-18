import { useCallback, useEffect } from 'react';

import {
  useLocalAuthentication,
  useNavigation,
  useNavigationActions,
  useSettings,
} from '.';

import { useIntl } from 'react-intl';

import { BottomSheetModal, ToastManager } from '@onekeyhq/components';
import type { LocaleIds } from '@onekeyhq/components/src/locale';
import { ToastManagerType } from '@onekeyhq/components/src/ToastManager';
import type { IWallet } from '@onekeyhq/engine/src/types';
import type {
  Account,
  AccountCredential,
  ImportableHDAccount,
} from '@onekeyhq/engine/src/types/account';
import type { Wallet } from '@onekeyhq/engine/src/types/wallet';
import type { IPasswordRes } from '@onekeyhq/kit-bg/src/services/ServicePassword';
import { EPasswordResStatus } from '@onekeyhq/kit-bg/src/services/ServicePassword';
import { OnekeyNetwork } from '@onekeyhq/shared/src/config/networkIds';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import backgroundApiProxy from '../background/instance/backgroundApiProxy';
import Protected, { ValidationFields } from '../components/Protected';
import {
  BackupWalletModalRoutes,
  CreateAccountModalRoutes,
  CreateWalletModalRoutes,
  ManagerAccountModalRoutes,
  ModalRoutes,
  OnekeyHardwareModalRoutes,
  RootRoutes,
} from '../routes/routesEnum';
import { appSelector } from '../store';
import {
  setEnableLocalAuthentication,
  toggleEnableLocalAuthentication,
} from '../store/reducers/settings';
import { wait } from '../utils/helper';
import { savePassword } from '../utils/localAuthentication';
import { showDialog, showOverlay } from '../utils/overlayUtils';
import { disableWebAuthn, enableWebAuthn } from '../utils/webauthn';
import { KeyTagRoutes } from '../views/KeyTag/Routes/enums';
import { EOnboardingRoutes } from '../views/Onboarding/routes/enums';
import { RecoveryPhraseDialog } from '../views/Onboarding/screens/CreateWallet/SetPassword';

import useAppNavigation from './useAppNavigation';
import { useAppSelector } from './useAppSelector';
import { closeExtensionWindowIfOnboardingFinished } from './useOnboardingRequired';

import type { ProtectedBaseProps } from '../components/Protected';
import type { BackupWalletRoutesParams } from '../routes/Root/Modal/BackupWallet';
import type {
  CreateAccountRoutesParams,
  RecoverAccountsAdvancedParams,
} from '../routes/Root/Modal/CreateAccount';
import type { IAddImportedAccountDoneModalParams } from '../routes/Root/Modal/CreateWallet';
import type { ModalScreenProps } from '../routes/types';
import type { IKeytagRoutesParams } from '../views/KeyTag/Routes/types';

export const useProtectedVerify = () => {
  const intl = useIntl();
  const showProtected = useCallback(
    (promiseId: number, props?: ProtectedBaseProps) =>
      showOverlay((close) => (
        <BottomSheetModal
          title={props?.title || intl.formatMessage({ id: 'Verify_Password' })}
          closeOverlay={() => {
            backgroundApiProxy.servicePromise.resolveCallback({
              id: promiseId,
              data: {
                status: EPasswordResStatus.CLOSE_STATUS,
                data: { password: '' },
              },
            });
            close();
          }}
        >
          <Protected {...props}>
            {(
              password,
              { withEnableAuthentication, isLocalAuthentication },
            ) => {
              backgroundApiProxy.servicePromise.resolveCallback({
                id: promiseId,
                data: {
                  status: EPasswordResStatus.PASS_STATUS,
                  data: {
                    password,
                    options: {
                      withEnableAuthentication,
                      isLocalAuthentication,
                    },
                  },
                },
              });
              close();
            }}
          </Protected>
        </BottomSheetModal>
      )),
    [intl],
  );

  const passwordPrompt = useAppSelector((s) => s.data.backgroudPasswordPrompt);
  useEffect(() => {
    if (passwordPrompt && passwordPrompt.promiseId) {
      showProtected(passwordPrompt.promiseId, passwordPrompt.props);
    }
  }, [passwordPrompt, showProtected]);
};

export const useSetPassword = () => {
  const navigation = useNavigation();
  return useCallback(
    async (mnemonic?: string) => {
      const { status, data } =
        await (backgroundApiProxy.servicePassword.backgroundPromptPasswordDialog(
          {
            walletId: null,
            field: ValidationFields.Wallet,
            skipSavePassword: true,
            hideTitle: true,
            isAutoHeight: true,
          },
        ) as Promise<IPasswordRes>);
      if (status === EPasswordResStatus.PASS_STATUS) {
        if (mnemonic) {
          showDialog(
            <RecoveryPhraseDialog
              onNext={() => {
                navigation.navigate(RootRoutes.Onboarding, {
                  screen: EOnboardingRoutes.BehindTheScene,
                  params: {
                    password: data.password,
                    mnemonic,
                    withEnableAuthentication:
                      data.options?.withEnableAuthentication,
                  },
                });
              }}
            />,
          );
        } else {
          const generalMnemonic =
            await backgroundApiProxy.engine.generateMnemonic();
          await wait(200);
          navigation.navigate(RootRoutes.Onboarding, {
            screen: EOnboardingRoutes.RecoveryPhrase,
            params: {
              password: data.password,
              mnemonic: generalMnemonic,
              withEnableAuthentication: data.options?.withEnableAuthentication,
            },
          });
        }
      }
    },
    [navigation],
  );
};

export const useImportedAccountDone = () => {
  const intl = useIntl();
  return useCallback(
    async (p: IAddImportedAccountDoneModalParams) => {
      try {
        const { status, data } =
          await (backgroundApiProxy.servicePassword.backgroundPromptPasswordDialog(
            {
              walletId: null,
              skipSavePassword: true,
              field: ValidationFields.Account,
            },
          ) as Promise<IPasswordRes>);
        if (status === EPasswordResStatus.PASS_STATUS) {
          const accountAdded =
            await backgroundApiProxy.serviceAccount.addImportedAccount(
              data.password,
              p.networkId,
              p.networkId,
              p.name,
              p.template,
            );
          if (data.options?.withEnableAuthentication) {
            backgroundApiProxy.dispatch(setEnableLocalAuthentication(true));
            await savePassword(data.password);
          }
          if (accountAdded) {
            p.onSuccess?.({
              account: accountAdded,
            });
          }
        }
      } catch (e) {
        const errorKey = (e as { key: LocaleIds }).key;
        ToastManager.show(
          {
            title: intl.formatMessage({ id: errorKey }),
          },
          { type: ToastManagerType.error },
        );
        // p.onFailure?.();
      }
    },
    [intl],
  );
};

export const useAuthentication = () =>
  useCallback(async (walletId: string, onDone: (password: string) => void) => {
    const { status, data } =
      await (backgroundApiProxy.servicePassword.backgroundPromptPasswordDialog({
        field: ValidationFields.Wallet,
        walletId,
      }) as Promise<IPasswordRes>);
    if (status === EPasswordResStatus.PASS_STATUS) {
      onDone(data.password);
    }
  }, []);

type RecoverConfirmNavigationProps =
  ModalScreenProps<CreateAccountRoutesParams>;
export const useRecoverConfirm = () => {
  const navigation =
    useNavigation<RecoverConfirmNavigationProps['navigation']>();
  return useCallback(
    async ({
      accounts,
      walletId,
      network,
      purpose,
      template,
      existingAccounts,
      config,
    }: {
      accounts: (ImportableHDAccount & {
        selected: boolean;
        isDisabled: boolean;
      })[];
      walletId: string;
      network: string;
      purpose: number;
      template: string;
      existingAccounts: Account[];
      config: RecoverAccountsAdvancedParams;
    }) => {
      const { status, data } =
        await (backgroundApiProxy.servicePassword.backgroundPromptPasswordDialog(
          {
            field: ValidationFields.Account,
            walletId,
            skipSavePassword: true,
          },
        ) as Promise<IPasswordRes>);
      if (status === EPasswordResStatus.PASS_STATUS) {
        navigation.navigate(CreateAccountModalRoutes.RecoverAccountsConfirm, {
          password: data.password,
          accounts,
          walletId,
          network,
          purpose,
          template,
          existingAccounts,
          config,
        });
      }
    },
    [navigation],
  );
};

type BackupNavigationProps = ModalScreenProps<BackupWalletRoutesParams>;
export const useBackupLite = () => {
  const navigation = useNavigation<BackupNavigationProps['navigation']>();
  return useCallback(
    async (walletId: string) => {
      const { status, data } =
        await (backgroundApiProxy.servicePassword.backgroundPromptPasswordDialog(
          {
            field: ValidationFields.Secret,
            walletId,
          },
        ) as Promise<IPasswordRes>);
      if (status === EPasswordResStatus.PASS_STATUS) {
        backgroundApiProxy.engine
          .revealHDWalletMnemonic(walletId, data.password)
          .then((mnemonic) => {
            setTimeout(() => {
              navigation.navigate(RootRoutes.Modal, {
                screen: ModalRoutes.CreateWallet,
                params: {
                  screen:
                    CreateWalletModalRoutes.OnekeyLiteBackupPinCodeVerifyModal,
                  params: {
                    walletId,
                    backupData: mnemonic,
                    onSuccess: () => {},
                  },
                },
              });
            }, 500);
          });
      }
    },
    [navigation],
  );
};

export const useBackupManual = () => {
  const navigation = useNavigation<BackupNavigationProps['navigation']>();
  return useCallback(
    async (walletId: string) => {
      const { status, data } =
        await (backgroundApiProxy.servicePassword.backgroundPromptPasswordDialog(
          {
            field: ValidationFields.Secret,
            walletId,
          },
        ) as Promise<IPasswordRes>);
      if (status === EPasswordResStatus.PASS_STATUS) {
        navigation.navigate(
          BackupWalletModalRoutes.BackupWalletAttentionsModal,
          {
            walletId,
            password: data.password,
          },
        );
      }
    },
    [navigation],
  );
};

export const useAppWalletDone = () => {
  const intl = useIntl();
  const { closeWalletSelector, openRootHome } = useNavigationActions();
  return useCallback(
    async (
      mnemonic?: string,
      onSuccess?: (options: { wallet: Wallet }) => void,
    ) => {
      try {
        const { status, data } =
          await (backgroundApiProxy.servicePassword.backgroundPromptPasswordDialog(
            {
              field: ValidationFields.Wallet,
              walletId: null,
              skipSavePassword: true,
            },
          ) as Promise<IPasswordRes>);
        if (status === EPasswordResStatus.PASS_STATUS) {
          const walletAdded =
            await backgroundApiProxy.serviceAccount.createHDWallet({
              password: data.password,
              mnemonic,
            });
          if (data.options?.withEnableAuthentication) {
            backgroundApiProxy.dispatch(setEnableLocalAuthentication(true));
            await savePassword(data.password);
          }
          if (walletAdded) {
            onSuccess?.({
              wallet: walletAdded,
            });
          }
        }
      } catch (e) {
        const errorKey = (e as { key: LocaleIds }).key;
        ToastManager.show({ title: intl.formatMessage({ id: errorKey }) });
      }
      closeWalletSelector();
      openRootHome();
      closeExtensionWindowIfOnboardingFinished();
    },
    [closeWalletSelector, intl, openRootHome],
  );
};

export const useEnableLocalAuthentication = () => {
  const intl = useIntl();
  const { dispatch } = backgroundApiProxy;

  const { localAuthenticate } = useLocalAuthentication();
  const { enableLocalAuthentication } = useSettings();
  return useCallback(async () => {
    const { status, data } =
      await (backgroundApiProxy.servicePassword.backgroundPromptPasswordDialog({
        walletId: null,
      }) as Promise<IPasswordRes>);
    if (status === EPasswordResStatus.PASS_STATUS) {
      if (!enableLocalAuthentication && !data.options?.isLocalAuthentication) {
        const result = await localAuthenticate();
        if (!result.success) {
          const { error } = result;
          if (!error.includes('cancelled')) {
            ToastManager.show(
              {
                title: intl.formatMessage({ id: 'msg__verification_failure' }),
              },
              {
                type: ToastManagerType.error,
              },
            );
          }
          return;
        }
      }
      savePassword(enableLocalAuthentication ? '' : data.password);
      dispatch(toggleEnableLocalAuthentication());
    }
  }, [dispatch, enableLocalAuthentication, intl, localAuthenticate]);
};

export const useEnableWebAuth = () => {
  const intl = useIntl();
  const enableWebAuthnState = appSelector((s) => s.settings.enableWebAuthn);
  return useCallback(async () => {
    try {
      const { status } =
        await (backgroundApiProxy.servicePassword.backgroundPromptPasswordDialog(
          {
            walletId: null,
          },
        ) as Promise<IPasswordRes>);
      if (status === EPasswordResStatus.PASS_STATUS) {
        if (enableWebAuthnState) {
          disableWebAuthn();
        } else {
          await enableWebAuthn();
        }
        ToastManager.show({
          title: intl.formatMessage({ id: 'msg__success' }),
        });
      }
    } catch (e: any) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      debugLogger.common.error(e.message);
      if (
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        !e.message?.includes(
          'The operation either timed out or was not allowed',
        )
      ) {
        ToastManager.show({
          title: intl.formatMessage({ id: 'msg__unknown_error' }),
        });
      }
    }
  }, [enableWebAuthnState, intl]);
};

export const useOnekeyHardwareDetailsAuth = () => {
  const navigation = useAppNavigation();
  const intl = useIntl();
  return useCallback(
    async (walletId: string) => {
      try {
        const { status, data } =
          await (backgroundApiProxy.servicePassword.backgroundPromptPasswordDialog(
            {
              walletId,
            },
          ) as Promise<IPasswordRes>);
        if (status === EPasswordResStatus.PASS_STATUS) {
          navigation.navigate(RootRoutes.Modal, {
            screen: ModalRoutes.OnekeyHardware,
            params: {
              screen: OnekeyHardwareModalRoutes.OnekeyHardwareDetailsModal,
              params: {
                walletId,
                deviceFeatures: data.options?.deviceFeatures,
              },
            },
          });
        }
      } catch (e) {
        const errorKey = (e as { key: LocaleIds }).key;
        ToastManager.show(
          {
            title: intl.formatMessage({ id: errorKey }),
          },
          { type: ToastManagerType.error },
        );
      }
    },
    [intl, navigation],
  );
};

export const useOnekeyHardwareDeviceNameAuth = () => {
  const navigation = useAppNavigation();
  const intl = useIntl();
  return useCallback(
    async (walletId: string) => {
      try {
        const { status } =
          await (backgroundApiProxy.servicePassword.backgroundPromptPasswordDialog(
            {
              walletId,
            },
          ) as Promise<IPasswordRes>);
        if (status === EPasswordResStatus.PASS_STATUS) {
          navigation.navigate(RootRoutes.Modal, {
            screen: ModalRoutes.OnekeyHardware,
            params: {
              screen: OnekeyHardwareModalRoutes.OnekeyHardwareDeviceNameModal,
              params: {
                walletId,
                deviceName: '',
              },
            },
          });
        }
      } catch (e) {
        const errorKey = (e as { key: LocaleIds }).key;
        ToastManager.show(
          {
            title: intl.formatMessage({ id: errorKey }),
          },
          { type: ToastManagerType.error },
        );
      }
    },
    [intl, navigation],
  );
};

export const useOnekeyLiteRestoreDoneAuth = () => {
  const intl = useIntl();
  return useCallback(
    async ({
      mnemonic,
      onSuccess,
    }: {
      mnemonic: string;
      onSuccess: () => void;
    }) => {
      try {
        const { status, data } =
          await (backgroundApiProxy.servicePassword.backgroundPromptPasswordDialog(
            {
              walletId: null,
              field: ValidationFields.Wallet,
              skipSavePassword: true,
            },
          ) as Promise<IPasswordRes>);
        if (status === EPasswordResStatus.PASS_STATUS) {
          await backgroundApiProxy.serviceAccount.createHDWallet({
            password: data.password,
            mnemonic,
          });
          if (data.options?.withEnableAuthentication) {
            backgroundApiProxy.dispatch(setEnableLocalAuthentication(true));
            await savePassword(data.password);
          }
          onSuccess?.();
        }
      } catch (e) {
        const errorKey = (e as { key: LocaleIds }).key;
        ToastManager.show({ title: intl.formatMessage({ id: errorKey }) });
      }
    },
    [intl],
  );
};

type KeyTagNavigationProps = ModalScreenProps<IKeytagRoutesParams>;

export const useKeyTagVerifyPassword = () => {
  const navigation = useNavigation<KeyTagNavigationProps['navigation']>();
  return useCallback(
    async ({
      walletId,
      wallet,
      navigateMode,
    }: {
      walletId: string;
      wallet?: IWallet;
      navigateMode?: boolean;
    }) => {
      const { status, data } =
        await (backgroundApiProxy.servicePassword.backgroundPromptPasswordDialog(
          {
            walletId,
            field: ValidationFields.Secret,
          },
        ) as Promise<IPasswordRes>);
      if (status === EPasswordResStatus.PASS_STATUS) {
        navigation.navigate(KeyTagRoutes.KeyTagAttention, {
          walletId,
          password: data.password,
          wallet,
          navigateMode,
        });
      }
    },
    [navigation],
  );
};

export const useExportPublicAuth = () => {
  const navigation = useNavigation();
  return useCallback(
    async ({
      walletId,
      accountId,
      networkId,
    }: {
      walletId: string;
      accountId: string;
      networkId: string;
    }) => {
      const { status, data } =
        await (backgroundApiProxy.servicePassword.backgroundPromptPasswordDialog(
          {
            walletId,
            skipSavePassword: true,
            field: ValidationFields.Secret,
          },
        ) as Promise<IPasswordRes>);
      if (status === EPasswordResStatus.PASS_STATUS) {
        navigation.navigate(RootRoutes.Modal, {
          screen: ModalRoutes.ManagerAccount,
          params: {
            screen: ManagerAccountModalRoutes.ManagerAccountExportPublicModal,
            params: {
              walletId,
              accountId,
              networkId,
              password: data.password,
            },
          },
        });
      }
    },
    [navigation],
  );
};

export const useExportPrivateAuth = () => {
  const navigation = useNavigation();
  return useCallback(
    async ({
      accountId,
      networkId,
      accountCredential,
    }: {
      accountId: string;
      networkId: string;
      accountCredential: AccountCredential;
    }) => {
      const { status, data } =
        await (backgroundApiProxy.servicePassword.backgroundPromptPasswordDialog(
          {
            walletId: null,
            skipSavePassword: true,
            field: ValidationFields.Secret,
          },
        ) as Promise<IPasswordRes>);
      if (status === EPasswordResStatus.PASS_STATUS) {
        navigation.navigate(RootRoutes.Modal, {
          screen: ModalRoutes.ManagerAccount,
          params: {
            screen: ManagerAccountModalRoutes.ManagerAccountExportPrivateModal,
            params: {
              accountId,
              networkId,
              password: data.password,
              accountCredential,
            },
          },
        });
      }
    },
    [navigation],
  );
};

export const useManegerWalletLocalValidation = () =>
  useCallback(
    async ({
      requestId,
      field,
      onSuccess,
      onCancel,
    }: {
      requestId?: string | null;
      field?: ValidationFields;
      onSuccess: (requestId: string, password: string) => void;
      onCancel: () => void;
    }) => {
      try {
        const { status, data } =
          await (backgroundApiProxy.servicePassword.backgroundPromptPasswordDialog(
            {
              walletId: null,
              field,
            },
          ) as Promise<IPasswordRes>);
        if (status === EPasswordResStatus.PASS_STATUS) {
          onSuccess(requestId ?? '', data.password);
        } else {
          onCancel();
        }
      } catch (e) {
        onCancel();
      }
    },
    [],
  );

export const useActivateTokenAuth = () =>
  useCallback(
    async ({
      walletId,
      accountId,
      networkId,
      tokenId,
      onFailure,
      onSuccess,
    }: {
      walletId: string;
      accountId: string;
      networkId: string;
      tokenId: string;
      onSuccess?: () => void;
      onFailure?: (error?: Error) => void;
    }) => {
      try {
        const { status, data } =
          await (backgroundApiProxy.servicePassword.backgroundPromptPasswordDialog(
            {
              walletId,
              skipSavePassword: true,
              field: ValidationFields.Payment,
            },
          ) as Promise<IPasswordRes>);
        if (status === EPasswordResStatus.PASS_STATUS) {
          const result = await backgroundApiProxy.engine.activateToken(
            data.password,
            accountId,
            networkId,
            tokenId,
          );
          if (result) {
            onSuccess?.();
          } else {
            onFailure?.();
          }
        }
      } catch (e: any) {
        debugLogger.sendTx.error(e);
        onFailure?.(e);
      }
    },
    [],
  );

export const useSendAuthentication = () =>
  useCallback(async (walletId: string) => {
    const { status, data } =
      await (backgroundApiProxy.servicePassword.backgroundPromptPasswordDialog({
        walletId,
        field: ValidationFields.Payment,
      }) as Promise<IPasswordRes>);
    if (status === EPasswordResStatus.PASS_STATUS) {
      return data.password;
    }
    return null;
  }, []);

export const useWalletTabsWithAuth = () => {
  const intl = useIntl();
  return useCallback(
    async ({ walletId, accountId, networkId, networkName }) => {
      const { status, data } =
        await (backgroundApiProxy.servicePassword.backgroundPromptPasswordDialog(
          {
            walletId,
            networkId,
            field: ValidationFields.Account,
            subTitle: intl.formatMessage(
              {
                id: 'title__password_verification_is_required_to_view_account_details_on_str',
              },
              { '0': networkName },
            ),
          },
        ) as Promise<IPasswordRes>);
      if (status === EPasswordResStatus.PASS_STATUS && data.password) {
        if (
          !networkId ||
          ![OnekeyNetwork.lightning, OnekeyNetwork.tlightning].includes(
            networkId,
          )
        ) {
          return;
        }
        backgroundApiProxy.serviceLightningNetwork
          .refreshToken({
            networkId,
            accountId,
            password: data.password,
          })
          .then(() => {
            debugLogger.common.info('refresh lightning network token success');
          })
          .catch((e) => {
            ToastManager.show(
              {
                title: intl.formatMessage({
                  id: 'msg__authentication_failed_verify_again',
                }),
              },
              { type: ToastManagerType.error },
            );
            debugLogger.common.info(
              'refresh lightning network token failed: ',
              e,
            );
          });
        debugLogger.common.info('should refresh lightning network token');
      }
    },
    [intl],
  );
};
