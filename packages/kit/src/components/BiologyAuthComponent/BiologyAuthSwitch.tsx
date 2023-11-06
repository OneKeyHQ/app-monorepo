import { memo } from 'react';

import { Switch, Toast } from '@onekeyhq/components';
import {
  useSettingsIsBioAuthEnableAtom,
  useSettingsIsBioAuthSupportedAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';

const BiologyAuthSwitch = () => {
  const [isSupportBiologyAuth] = useSettingsIsBioAuthSupportedAtom();
  const [isBiologyAuthEnable] = useSettingsIsBioAuthEnableAtom();

  return isSupportBiologyAuth ? (
    <Switch
      value={isBiologyAuthEnable}
      onChange={async (checked) => {
        try {
          await backgroundApiProxy.servicePassword.setBiologyAuthEnable(
            checked,
          );
        } catch (e) {
          Toast.error({ title: 'msg__verification_failure' });
        }
      }}
    />
  ) : null;
};

export default memo(BiologyAuthSwitch);
