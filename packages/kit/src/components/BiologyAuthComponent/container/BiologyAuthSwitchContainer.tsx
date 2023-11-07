import { useCallback } from 'react';

import { Toast } from '@onekeyhq/components';
import {
  useSettingsBiologyAuthInfoAtom,
  useSettingsIsBiologyAuthSwitchOnAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import BiologyAuthSwitch from '../components/BiologyAuthSwitch';

const BiologyAuthSwitchContainer = () => {
  const [{ isSupport }] = useSettingsBiologyAuthInfoAtom();
  const [isBiologyAuthEnable] = useSettingsIsBiologyAuthSwitchOnAtom();
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
      isBiologyAuthEnable={isBiologyAuthEnable}
      onChange={onChange}
    />
  );
};
export default BiologyAuthSwitchContainer;
