import { useCallback } from 'react';

import { Toast } from '@onekeyhq/components';
import { usePasswordWebAuthInfoAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/password';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import WebAuthSwitch from '../components/WebAuthSwitch';

const WebAuthSwitchContainer = () => {
  const [{ isSupport, isEnable }] = usePasswordWebAuthInfoAtom();
  const onChange = useCallback(async (checked: boolean) => {
    try {
      await backgroundApiProxy.servicePassword.setWebAuthEnable(checked);
    } catch (e) {
      Toast.error({ title: 'msg__verification_failure' });
    }
  }, []);
  return (
    <WebAuthSwitch
      isSupport={isSupport}
      isWebAuthEnable={isEnable}
      onChange={onChange}
    />
  );
};
export default WebAuthSwitchContainer;
