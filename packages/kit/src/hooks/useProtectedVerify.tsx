import { useCallback, useEffect } from 'react';

import { useNavigation } from '.';

import { useIntl } from 'react-intl';

import { BottomSheetModal, ToastManager } from '@onekeyhq/components';
import type { LocaleIds } from '@onekeyhq/components/src/locale';
import { EPasswordResStatus } from '@onekeyhq/kit-bg/src/services/ServicePassword';

import backgroundApiProxy from '../background/instance/backgroundApiProxy';
import Protected, { ValidationFields } from '../components/Protected';
import { RootRoutes } from '../routes/routesEnum';
import { setEnableLocalAuthentication } from '../store/reducers/settings';
import { wait } from '../utils/helper';
import { savePassword } from '../utils/localAuthentication';
import { showDialog, showOverlay } from '../utils/overlayUtils';
import { EOnboardingRoutes } from '../views/Onboarding/routes/enums';
import { RecoveryPhraseDialog } from '../views/Onboarding/screens/CreateWallet/SetPassword';

import { useAppSelector } from './useAppSelector';

import type { ProtectedBaseProps } from '../components/Protected';
import type { IAddImportedAccountDoneModalParams } from '../routes/Root/Modal/CreateWallet';

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
