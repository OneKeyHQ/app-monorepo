import { useCallback, useEffect } from 'react';

import { createRoot } from 'react-dom/client';
import { useIntl } from 'react-intl';
import 'setimmediate';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useWebAuthActions } from '@onekeyhq/kit/src/components/BiologyAuthComponent/hooks/useWebAuthActions';
import { GlobalJotaiReady } from '@onekeyhq/kit/src/components/GlobalJotaiReady';
import { ThemeProvider } from '@onekeyhq/kit/src/provider/ThemeProvider';
import {
  usePasswordAtom,
  usePasswordPersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  EPassKeyWindowFrom,
  EPassKeyWindowType,
} from '@onekeyhq/shared/src/utils/extUtils';
import { EPasswordVerifyStatus } from '@onekeyhq/shared/types/password';

import { setupExtUIEventOnPassKeyPage } from '../background/extUI';

const params = new URLSearchParams(window.location.href.split('?').pop());
const from = params.get('from') as EPassKeyWindowFrom;
const type = params.get('type') as EPassKeyWindowType;

const usePassKeyOperations = () => {
  const { setWebAuthEnable, verifiedPasswordWebAuth, checkWebAuth } =
    useWebAuthActions();
  const [{ webAuthCredentialId }] = usePasswordPersistAtom();
  const [{ passwordVerifyStatus }, setPasswordAtom] = usePasswordAtom();
  const intl = useIntl();

  const switchWebAuth = useCallback(
    async (checked: boolean) => {
      const res = await setWebAuthEnable(checked);
      if (res) {
        await backgroundApiProxy.serviceSetting.setBiologyAuthSwitchOn(checked);
      }
    },
    [setWebAuthEnable],
  );

  const verifyPassKey = useCallback(async () => {
    const hasCachedPassword =
      webAuthCredentialId &&
      !!(await backgroundApiProxy.servicePassword.getCachedPassword());
    if (hasCachedPassword) {
      await verifiedPasswordWebAuth();
    } else {
      try {
        const result = await checkWebAuth();
        if (result) {
          setPasswordAtom((v) => ({
            ...v,
            passwordVerifyStatus: {
              value: EPasswordVerifyStatus.VERIFIED,
            },
          }));
          await backgroundApiProxy.servicePassword.unLockApp();
        } else {
          setPasswordAtom((v) => ({
            ...v,
            passwordVerifyStatus: {
              value: EPasswordVerifyStatus.ERROR,
              message: intl.formatMessage({
                id: ETranslations.auth_error_password_incorrect,
              }),
            },
          }));
        }
      } catch {
        setPasswordAtom((v) => ({
          ...v,
          passwordVerifyStatus: {
            value: EPasswordVerifyStatus.ERROR,
            message: intl.formatMessage({
              id: ETranslations.auth_error_password_incorrect,
            }),
          },
        }));
      } finally {
        if (from === EPassKeyWindowFrom.sidebar) {
          window.close();
        }
      }
    }
  }, [
    checkWebAuth,
    intl,
    setPasswordAtom,
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
  }, [
    setWebAuthEnable,
    verifiedPasswordWebAuth,
    checkWebAuth,
    webAuthCredentialId,
    passwordVerifyStatus,
    setPasswordAtom,
    intl,
    switchWebAuth,
    verifyPassKey,
  ]);
};

function PassKeyContainer() {
  useEffect(() => {
    setupExtUIEventOnPassKeyPage();
  }, []);
  usePassKeyOperations();
  return null;
}

function renderPassKeyPage() {
  const root = window.document.querySelector('#root');
  if (!root) throw new Error('No root element found!');

  createRoot(root).render(
    <GlobalJotaiReady>
      <ThemeProvider>
        <PassKeyContainer />
      </ThemeProvider>
    </GlobalJotaiReady>,
  );
}

export default renderPassKeyPage;
