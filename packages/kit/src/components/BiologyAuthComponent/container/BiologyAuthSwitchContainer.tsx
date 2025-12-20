import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { Toast, startViewTransition } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { usePasswordBiologyAuthInfoAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/password';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { BIOLOGY_AUTH_CANCEL_ERROR } from '@onekeyhq/shared/types/password';

import { useBiometricAuthInfo } from '../../../hooks/useBiometricAuthInfo';
import BiologyAuthSwitch from '../components/BiologyAuthSwitch';

interface IBiologyAuthSwitchContainerProps {
  skipAuth?: boolean; // only use for password setup
}

const BiologyAuthSwitchContainer = ({
  skipAuth,
}: IBiologyAuthSwitchContainerProps) => {
  const intl = useIntl();
  const { title } = useBiometricAuthInfo();
  const [{ isSupport }] = usePasswordBiologyAuthInfoAtom();
  const [settings] = useSettingsPersistAtom();
  const onChange = useCallback(
    async (checked: boolean) => {
      try {
        // https://github.com/facebook/react/issues/31819
        // Page flicker caused by Suspense throttling behavior.
        startViewTransition(async () => {
          await backgroundApiProxy.servicePassword.setBiologyAuthEnable(
            checked,
            skipAuth,
          );
        });
      } catch (e) {
        const error = e as { message?: string; name?: string };
        if (error?.name === BIOLOGY_AUTH_CANCEL_ERROR) {
          Toast.error({
            title: intl.formatMessage(
              {
                id: ETranslations.auth_biometric_cancel,
              },
              { biometric: title },
            ),
          });
          return;
        }
        Toast.error({
          title: intl.formatMessage({
            id: platformEnv.isDesktopWin
              ? ETranslations.global_windows_hello_set_error
              : ETranslations.global_touch_id_set_error,
          }),
        });
      }
    },
    [intl, skipAuth, title],
  );
  return (
    <BiologyAuthSwitch
      isSupport={isSupport}
      isBiologyAuthEnable={settings.isBiologyAuthSwitchOn}
      onChange={onChange}
    />
  );
};
export default BiologyAuthSwitchContainer;
