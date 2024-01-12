import { useCallback } from 'react';

import { Toast } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePasswordWebAuthInfoAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/password';

import WebAuthSwitch from '../components/WebAuthSwitch';

const WebAuthSwitchContainer = () => {
  const [{ isSupport, isEnable }] = usePasswordWebAuthInfoAtom();
  const onChange = useCallback(async (checked: boolean) => {
    try {
      await backgroundApiProxy.servicePassword.setWebAuthEnable(checked);
    } catch (e: any) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      Toast.error({ title: e?.message || 'Failed to set web auth' });
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
