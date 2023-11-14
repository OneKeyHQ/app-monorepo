import type { FC } from 'react';
import { useCallback } from 'react';

import { usePasswordAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import PasswordVerifyContainer from '../../Password/container/PasswordVerifyContainer';
import AppStateLock from '../components/AppStateLock';

interface IAppStateLockContainerProps {
  children: JSX.Element;
}

const AppStateLockContainer: FC<IAppStateLockContainerProps> = ({
  children,
}) => {
  const [passwordAtom] = usePasswordAtom();

  const handleUnlock = useCallback(async () => {
    await backgroundApiProxy.servicePassword.unLockApp();
  }, []);
  if (passwordAtom.unLock) {
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
