import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import { Toast } from '@onekeyhq/components';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { usePasswordWebAuthInfoAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/password';
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
  const [{ isSupport, isEnable }] = usePasswordWebAuthInfoAtom();
  const { setWebAuthEnable } = useWebAuthActions();
  const [settingsPersistAtom] = useSettingsPersistAtom();
  const webAuthSwitchOpen = useMemo(() => {
    if (skipRegistration) {
      return isSupport && settingsPersistAtom.isBiologyAuthSwitchOn;
    }
    return isEnable;
  }, [
    isEnable,
    isSupport,
    settingsPersistAtom.isBiologyAuthSwitchOn,
    skipRegistration,
  ]);
  const onChange = useCallback(
    async (checked: boolean) => {
      try {
        if (!skipRegistration) {
          await setWebAuthEnable(checked);
        }
        await backgroundApiProxy.serviceSetting.setBiologyAuthSwitchOn(checked);
      } catch (e: any) {
        Toast.error({
          title: intl.formatMessage({ id: ETranslations.Toast_web_auth }),
        });
      }
    },
    [setWebAuthEnable, skipRegistration, intl],
  );
  return (
    <WebAuthSwitch
      isSupport={isSupport}
      isWebAuthEnable={webAuthSwitchOpen}
      onChange={onChange}
    />
  );
};
export default WebAuthSwitchContainer;
