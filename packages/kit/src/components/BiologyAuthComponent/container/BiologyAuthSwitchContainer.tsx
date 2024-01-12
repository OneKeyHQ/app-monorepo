import { useCallback } from 'react';

import { Toast } from '@onekeyhq/components';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { usePasswordBiologyAuthInfoAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/password';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';

import BiologyAuthSwitch from '../components/BiologyAuthSwitch';

const BiologyAuthSwitchContainer = () => {
  const [{ isSupport }] = usePasswordBiologyAuthInfoAtom();
  const [settings] = useSettingsPersistAtom();
  const onChange = useCallback(async (checked: boolean) => {
    try {
      await backgroundApiProxy.servicePassword.setBiologyAuthEnable(checked);
    } catch (e) {
      Toast.error({ title: 'msg__verification_failure' });
    }
  }, []);
  return (
    <BiologyAuthSwitch
      isSupport={isSupport}
      isBiologyAuthEnable={settings.isBiologyAuthSwitchOn}
      onChange={onChange}
    />
  );
};
export default BiologyAuthSwitchContainer;
