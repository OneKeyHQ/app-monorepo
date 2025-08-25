import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { Toast } from '@onekeyhq/components';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  usePasswordPersistAtom,
  usePasswordWebAuthInfoAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms/password';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import WebAuthSwitch from '../components/WebAuthSwitch';
import { useWebAuthActions } from '../hooks/useWebAuthActions';

interface IWebAuthSwitchContainerProps {
  skipRegistration?: boolean; // only use for password setup
}

const WebAuthSwitchContainer = ({
  skipRegistration,
}: IWebAuthSwitchContainerProps) => {
  const intl = useIntl();
  const [{ isSupport }] = usePasswordWebAuthInfoAtom();
  const [{ webAuthCredentialId: credId }] = usePasswordPersistAtom();
  const { setWebAuthEnable, clearWebAuthCredentialId } = useWebAuthActions();
  const [settingsPersistAtom] = useSettingsPersistAtom();
  const onChange = useCallback(
    async (checked: boolean) => {
      try {
        if (!skipRegistration) {
          if (checked) {
            await clearWebAuthCredentialId();
            const res = await setWebAuthEnable(checked);
            if (res) {
              await backgroundApiProxy.serviceSetting.setBiologyAuthSwitchOn(
                checked,
              );
            }
          }
        }
        if (skipRegistration || !checked) {
          await backgroundApiProxy.serviceSetting.setBiologyAuthSwitchOn(
            checked,
          );
        }
      } catch (e: any) {
        Toast.error({
          title: intl.formatMessage({ id: ETranslations.toast_web_auth }),
        });
      }
    },
    [skipRegistration, clearWebAuthCredentialId, setWebAuthEnable, intl],
  );
  return (
    <WebAuthSwitch
      isSupport={isSupport}
      isWebAuthEnable={settingsPersistAtom.isBiologyAuthSwitchOn}
      onChange={onChange}
    />
  );
};
export default WebAuthSwitchContainer;
