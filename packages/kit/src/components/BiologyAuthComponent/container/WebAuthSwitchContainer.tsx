import { useCallback, useMemo } from 'react';

import { Toast } from '@onekeyhq/components';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { usePasswordWebAuthInfoAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/password';

import WebAuthSwitch from '../components/WebAuthSwitch';
import { useWebAuthActions } from '../hooks/useWebAuthActions';

interface IWebAuthSwitchContainerProps {
  skipRegistration?: boolean; // only use for password setup
}

const WebAuthSwitchContainer = ({
  skipRegistration,
}: IWebAuthSwitchContainerProps) => {
  const [{ isSupport, isEnable }] = usePasswordWebAuthInfoAtom();
  const { setWebAuthEnable } = useWebAuthActions();
  const [settingsPersistAtom, setPasswordPersist] = useSettingsPersistAtom();
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
        setPasswordPersist((v) => ({
          ...v,
          isBiologyAuthSwitchOn: checked,
        }));
      } catch (e: any) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        Toast.error({ title: e?.message || 'Failed to set web auth' });
      }
    },
    [setPasswordPersist, setWebAuthEnable, skipRegistration],
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
