import { useCallback } from 'react';

import { Toast } from '@onekeyhq/components';
import { usePasswordWebAuthInfoAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/password';

import WebAuthSwitch from '../components/WebAuthSwitch';
import { useWebAuthActions } from '../hooks/useWebAuthActions';

const WebAuthSwitchContainer = () => {
  const [{ isSupport, isEnable }] = usePasswordWebAuthInfoAtom();
  const { setWebAuthEnable } = useWebAuthActions();
  const onChange = useCallback(
    async (checked: boolean) => {
      try {
        await setWebAuthEnable(checked);
      } catch (e: any) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        Toast.error({ title: e?.message || 'Failed to set web auth' });
      }
    },
    [setWebAuthEnable],
  );
  return (
    <WebAuthSwitch
      isSupport={isSupport}
      isWebAuthEnable={isEnable}
      onChange={onChange}
    />
  );
};
export default WebAuthSwitchContainer;
