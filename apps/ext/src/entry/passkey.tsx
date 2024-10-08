import { useEffect } from 'react';

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
import { EPasswordVerifyStatus } from '@onekeyhq/shared/types/password';

function PassKeyContainer() {
  const { verifiedPasswordWebAuth, checkWebAuth } = useWebAuthActions();
  const [{ webAuthCredentialId }] = usePasswordPersistAtom();
  const [{ passwordVerifyStatus }, setPasswordAtom] = usePasswordAtom();
  const intl = useIntl();
  useEffect(() => {
    const verifyPassKey = async () => {
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
        }
      }
    };

    if (
      passwordVerifyStatus.value === EPasswordVerifyStatus.VERIFYING ||
      passwordVerifyStatus.value === EPasswordVerifyStatus.VERIFIED
    ) {
      return;
    }
    setPasswordAtom((v) => ({
      ...v,
      passwordVerifyStatus: { value: EPasswordVerifyStatus.VERIFYING },
    }));
    void verifyPassKey();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

const root = window.document.querySelector('#root');
if (!root) throw new Error('No root element found!');
createRoot(root).render(
  <GlobalJotaiReady>
    <ThemeProvider>
      <PassKeyContainer />
    </ThemeProvider>
  </GlobalJotaiReady>,
);
