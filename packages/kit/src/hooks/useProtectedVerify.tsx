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
import type {
  Account,
  ImportableHDAccount,
} from '@onekeyhq/engine/src/types/account';
import type { Wallet } from '@onekeyhq/engine/src/types/wallet';
import { EPasswordResStatus } from '@onekeyhq/kit-bg/src/services/ServicePassword';

import backgroundApiProxy from '../background/instance/backgroundApiProxy';
import Protected, { ValidationFields } from '../components/Protected';
import {
  BackupWalletModalRoutes,
  CreateAccountModalRoutes,
  CreateWalletModalRoutes,
  ModalRoutes,
  RootRoutes,
} from '../routes/routesEnum';
import {
  setEnableLocalAuthentication,
  toggleEnableLocalAuthentication,
} from '../store/reducers/settings';
import { wait } from '../utils/helper';
import { savePassword } from '../utils/localAuthentication';
import { showDialog, showOverlay } from '../utils/overlayUtils';
import { EOnboardingRoutes } from '../views/Onboarding/routes/enums';
import { RecoveryPhraseDialog } from '../views/Onboarding/screens/CreateWallet/SetPassword';

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

export const useProtectedVerify = () => {
  const intl = useIntl();
  const showProtected = useCallback(
    (promiseId: string, props?: ProtectedBaseProps) =>
      showOverlay((close) => (
        <BottomSheetModal
          title={props?.title || intl.formatMessage({ id: 'Verify_Password' })}
          closeOverlay={() => {
            backgroundApiProxy.servicePassword.backgroundPromptPasswordDialogRes(
              promiseId,
              {
                status: EPasswordResStatus.CLOSE_STATUS,
                data: { password: '' },
              },
            );
            close();
          }}
        >
          <Protected {...props}>
            {(
              password,
              { withEnableAuthentication, isLocalAuthentication },
            ) => {
              backgroundApiProxy.servicePassword.backgroundPromptPasswordDialogRes(
                promiseId,
                {
                  status: EPasswordResStatus.PASS_STATUS,
                  data: {
                    password,
                    options: {
                      withEnableAuthentication,
                      isLocalAuthentication,
                    },
                  },
                },
              );
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
        await backgroundApiProxy.servicePassword.backgroundPromptPasswordDialog(
          {
            walletId: null,
            field: ValidationFields.Wallet,
            skipSavePassword: true,
            hideTitle: true,
            isAutoHeight: true,
          },
        );
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
          await backgroundApiProxy.servicePassword.backgroundPromptPasswordDialog(
            {
              walletId: null,
              skipSavePassword: true,
              field: ValidationFields.Account,
            },
          );
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
          { type: 'error' },
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
      await backgroundApiProxy.servicePassword.backgroundPromptPasswordDialog({
        field: ValidationFields.Wallet,
        walletId,
      });
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
        await backgroundApiProxy.servicePassword.backgroundPromptPasswordDialog(
          {
            field: ValidationFields.Account,
            walletId,
            skipSavePassword: true,
          },
        );
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
        await backgroundApiProxy.servicePassword.backgroundPromptPasswordDialog(
          {
            field: ValidationFields.Secret,
            walletId,
          },
        );
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
        await backgroundApiProxy.servicePassword.backgroundPromptPasswordDialog(
          {
            field: ValidationFields.Secret,
            walletId,
          },
        );
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
          await backgroundApiProxy.servicePassword.backgroundPromptPasswordDialog(
            {
              field: ValidationFields.Wallet,
              walletId: null,
              skipSavePassword: true,
            },
          );
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
      await backgroundApiProxy.servicePassword.backgroundPromptPasswordDialog({
        walletId: null,
      });
    console.log('status', status);
    console.log('data', data);
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
                type: 'error',
              },
            );
          }
          //   setTimeout(() => {
          //     // delay 1000ms goBack, otherwise the keyboard will be showup
          //     navigation?.goBack?.();
          //   }, 1000);
          return;
        }
      }
      savePassword(enableLocalAuthentication ? '' : data.password);
      dispatch(toggleEnableLocalAuthentication());
      //   setTimeout(() => {
      //     // delay 1000ms goBack, otherwise the keyboard will be showup
      //     navigation?.goBack?.();
      //   }, 1000);
    }
  }, [dispatch, enableLocalAuthentication, intl, localAuthenticate]);
};
