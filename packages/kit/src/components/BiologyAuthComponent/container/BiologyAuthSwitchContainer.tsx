import { useCallback } from 'react';

import { Toast } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { usePasswordBiologyAuthInfoAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/password';

import BiologyAuthSwitch from '../components/BiologyAuthSwitch';

interface IBiologyAuthSwitchContainerProps {
  skipAuth?: boolean; // only use for password setup
}

const BiologyAuthSwitchContainer = ({
  skipAuth,
}: IBiologyAuthSwitchContainerProps) => {
  const [{ isSupport }] = usePasswordBiologyAuthInfoAtom();
  const [settings] = useSettingsPersistAtom();
  const onChange = useCallback(
    async (checked: boolean) => {
      try {
        await backgroundApiProxy.servicePassword.setBiologyAuthEnable(
          checked,
          skipAuth,
        );
      } catch (e) {
        Toast.error({ title: 'Set biology auth fail' });
      }
    },
    [skipAuth],
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
