import { useCallback, useEffect } from 'react';

import { createRoot } from 'react-dom/client';
import { useIntl } from 'react-intl';
import 'setimmediate';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useWebAuthActions } from '@onekeyhq/kit/src/components/BiologyAuthComponent/hooks/useWebAuthActions';
import { GlobalJotaiReady } from '@onekeyhq/kit/src/components/GlobalJotaiReady';
import { ThemeProvider } from '@onekeyhq/kit/src/provider/ThemeProvider';
import { biologyAuthUtils } from '@onekeyhq/kit-bg/src/services/ServicePassword/biologyAuthUtils';
import {
  usePasswordAtom,
  usePasswordModeAtom,
  usePasswordPersistAtom,
  usePasswordPromptPromiseTriggerAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EPassKeyWindowType } from '@onekeyhq/shared/src/utils/extUtils';
import { verifiedWebAuth } from '@onekeyhq/shared/src/webAuth';
import {
  BIOLOGY_AUTH_CANCEL_ERROR,
  EPasswordVerifyStatus,
} from '@onekeyhq/shared/types/password';

import { setupExtUIEventOnPassKeyPage } from '../background/extUI';
import { closeWindow } from '../closePasskeyWIndow';

const params = new URLSearchParams(globalThis.location.href.split('?').pop());
const type = params.get('type') as EPassKeyWindowType;

const usePassKeyOperations = () => {
  const { setWebAuthEnable, verifiedPasswordWebAuth } = useWebAuthActions();

  const [{ passwordPromptPromiseTriggerData }] =
    usePasswordPromptPromiseTriggerAtom();
  const [{ webAuthCredentialId }] = usePasswordPersistAtom();
  const [{ passwordVerifyStatus }, setPasswordAtom] = usePasswordAtom();
  const [passwordMode] = usePasswordModeAtom();
  const intl = useIntl();
  const [{ enablePasswordErrorProtection }, setPasswordPersist] =
    usePasswordPersistAtom();
  const switchWebAuth = useCallback(
    async (checked: boolean) => {
      const res = await setWebAuthEnable(checked);
      if (res) {
        try {
          await backgroundApiProxy.serviceSetting.setBiologyAuthSwitchOn(
            checked,
          );
        } catch (error) {
          console.log(error);
        } finally {
          console.log('close on switchWebAuth');
          closeWindow();
        }
      }
      console.log('close on switchWebAuth', res);
      closeWindow();
    },
    [setWebAuthEnable],
  );

  const verifyPassKey = useCallback(async () => {
    const hasCachedPassword =
      webAuthCredentialId &&
      !!(await backgroundApiProxy.servicePassword.getCachedPassword());

    try {
      let result: string | boolean | undefined;
      if (hasCachedPassword) {
        result = await verifiedPasswordWebAuth();
      } else {
        // No cached password — try secure storage (WebAuthn PRF)
        try {
          result = (await biologyAuthUtils.getPassword()) ?? undefined;
        } catch (e) {
          if ((e as Error)?.name === BIOLOGY_AUTH_CANCEL_ERROR) {
            throw e;
          }
          // getPassword failed — fall back to credential-only verification.
          // Call verifiedWebAuth directly instead of checkWebAuth() to avoid
          // a redundant biologyAuthUtils.getPassword() call inside it.
          // Note: checkExtWebAuth is unnecessary here — this IS the PassKey
          // window, so WebAuthn works directly without needing another window.
          const cred = await verifiedWebAuth(webAuthCredentialId);
          result = cred?.id === webAuthCredentialId;
        }
      }

      if (result) {
        // If we got a real password string, verify and cache it
        if (typeof result === 'string' && result) {
          await backgroundApiProxy.servicePassword.verifyPassword({
            password: result,
            passwordMode,
          });
        }

        // Only set verified status and reset error counters AFTER
        // password verification succeeds (matches PasswordVerifyContainer pattern)
        setPasswordAtom((v) => ({
          ...v,
          passwordVerifyStatus: {
            value: EPasswordVerifyStatus.VERIFIED,
          },
        }));
        if (enablePasswordErrorProtection) {
          setPasswordPersist((v) => ({
            ...v,
            passwordErrorAttempts: 0,
            passwordErrorProtectionTime: 0,
          }));
        }

        // Password Dialog
        if (
          typeof result === 'string' &&
          result &&
          passwordPromptPromiseTriggerData?.idNumber
        ) {
          await backgroundApiProxy.servicePassword.resolvePasswordPromptDialog(
            passwordPromptPromiseTriggerData?.idNumber,
            {
              password: result,
            },
          );
        } else {
          // Cancel the pending password prompt dialog if we can't provide a real password
          if (passwordPromptPromiseTriggerData?.idNumber) {
            await backgroundApiProxy.servicePassword.cancelPasswordPromptDialog(
              passwordPromptPromiseTriggerData.idNumber,
            );
          }
          await backgroundApiProxy.servicePassword.unLockApp();
        }
      } else {
        setPasswordAtom((v) => ({
          ...v,
          passwordVerifyStatus: {
            value: EPasswordVerifyStatus.ERROR,
            message: intl.formatMessage({
              id: ETranslations.auth_error_passcode_incorrect,
            }),
          },
        }));
      }
    } catch (e) {
      const message =
        (e as Error)?.name === BIOLOGY_AUTH_CANCEL_ERROR
          ? intl.formatMessage(
              {
                id: ETranslations.auth_biometric_cancel,
              },
              {
                biometric: intl.formatMessage({
                  id: ETranslations.settings_passkey,
                }),
              },
            )
          : intl.formatMessage({
              id: ETranslations.auth_error_passcode_incorrect,
            });
      setPasswordAtom((v) => ({
        ...v,
        passwordVerifyStatus: {
          value: EPasswordVerifyStatus.ERROR,
          message,
        },
      }));
      // Cancel any pending password prompt dialog so caller fails immediately
      // instead of hanging until the 5-minute timeout
      if (passwordPromptPromiseTriggerData?.idNumber) {
        await backgroundApiProxy.servicePassword.cancelPasswordPromptDialog(
          passwordPromptPromiseTriggerData.idNumber,
        );
      }
    } finally {
      console.log('close from renderPassKeyPage');
      closeWindow();
    }
  }, [
    enablePasswordErrorProtection,
    intl,
    passwordMode,
    passwordPromptPromiseTriggerData?.idNumber,
    setPasswordAtom,
    setPasswordPersist,
    verifiedPasswordWebAuth,
    webAuthCredentialId,
  ]);

  useEffect(() => {
    switch (type) {
      case EPassKeyWindowType.create:
        void switchWebAuth(true);
        break;
      case EPassKeyWindowType.unlock:
        if (passwordVerifyStatus.value !== EPasswordVerifyStatus.VERIFIED) {
          setPasswordAtom((v) => ({
            ...v,
            passwordVerifyStatus: { value: EPasswordVerifyStatus.VERIFYING },
          }));
          void verifyPassKey();
        }
        break;
      default:
        break;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
};

function PassKeyContainer() {
  useEffect(() => {
    setupExtUIEventOnPassKeyPage();
  }, []);
  usePassKeyOperations();
  return null;
}

function renderPassKeyPage() {
  const root = globalThis.document.querySelector('#root');
  if (!root) throw new OneKeyLocalError('No root element found!');

  createRoot(root).render(
    <GlobalJotaiReady>
      <ThemeProvider>
        <PassKeyContainer />
      </ThemeProvider>
    </GlobalJotaiReady>,
  );
}

export default renderPassKeyPage;
