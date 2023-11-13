import { useCallback } from 'react';

import PasswordVerifyContainer from '../../Password/container/PasswordVerifyContainer';
import AppStateLock from '../components/AppStateLock';

interface IAppStateLockContainerProps {
  onUnlock: () => void;
}

const AppStateLockContainer = ({ onUnlock }: IAppStateLockContainerProps) => {
  console.log('app state lock container');
  const handleUnlock = useCallback(() => {
    console.log('on unlock');
    // todo: unlock
    onUnlock();
  }, [onUnlock]);
  return (
    <AppStateLock
      passwordVerifyContainer={
        <PasswordVerifyContainer
          onVerifyRes={(data) => {
            if (data) {
              handleUnlock();
            }
          }}
        />
      }
    />
  );
};

export default AppStateLockContainer;
