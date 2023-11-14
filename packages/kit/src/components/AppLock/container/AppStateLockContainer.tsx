import type { FC } from 'react';
import { useCallback } from 'react';

import {
  usePasswordAtom,
  usePasswordPersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import PasswordVerifyContainer from '../../Password/container/PasswordVerifyContainer';
import AppStateLock from '../components/AppStateLock';

interface IAppStateLockContainerProps {
  children: JSX.Element;
}

const AppStateLockContainer: FC<IAppStateLockContainerProps> = ({
  children,
}) => {
  const [{ unLock }] = usePasswordAtom();
  const [{ isPasswordSet }] = usePasswordPersistAtom();

  const handleUnlock = useCallback(async () => {
    await backgroundApiProxy.servicePassword.unLockApp();
  }, []);

  if (unLock || !isPasswordSet) {
    return children;
  }

  return (
    <AppStateLock
      passwordVerifyContainer={
        <PasswordVerifyContainer
          onVerifyRes={async (data) => {
            if (data) {
              await handleUnlock();
            }
          }}
        />
      }
    />
  );
};

export default AppStateLockContainer;
