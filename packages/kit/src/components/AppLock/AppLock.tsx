import React, { FC } from 'react';

import { Box, OverlayContainer } from '@onekeyhq/components';
import { useData } from '@onekeyhq/kit/src/hooks/redux';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useAppSelector } from '../../hooks/redux';

import { AppStateHeartbeat } from './AppStateHeartbeat';
import { AppStateUnlock } from './AppStateUnlock';
import { AppStateUpdator } from './AppStateUpdator';

type AppLockProps = { children: JSX.Element };

export const AppLockOverlayMode: FC<AppLockProps> = ({ children }) => {
  const enableAppLock = useAppSelector((s) => s.settings.enableAppLock);
  const isStatusUnlock = useAppSelector((s) => s.status.isUnlock);
  const { isPasswordSet, isUnlock: isDataUnlock } = useData();
  const prerequisites = isPasswordSet && enableAppLock;
  const isUnlock = isDataUnlock && isStatusUnlock;
  return (
    <Box w="full" h="full">
      {prerequisites && !isUnlock ? (
        <OverlayContainer>
          <AppStateUnlock />
        </OverlayContainer>
      ) : null}
      {prerequisites && isUnlock ? <AppStateUpdator /> : null}
      {prerequisites && isUnlock ? <AppStateHeartbeat /> : null}
      {children}
    </Box>
  );
};

export const AppLockNormalMode: FC<AppLockProps> = ({ children }) => {
  const enableAppLock = useAppSelector((s) => s.settings.enableAppLock);
  const isStatusUnlock = useAppSelector((s) => s.status.isUnlock);
  const { isPasswordSet, isUnlock: isDataUnlock } = useData();
  const prerequisites = isPasswordSet && enableAppLock;
  const isUnlock = isDataUnlock && isStatusUnlock;
  if (!prerequisites) {
    return children;
  }
  if (isUnlock) {
    return (
      <Box w="full" h="full">
        <AppStateUpdator />
        <AppStateHeartbeat />
        {children}
      </Box>
    );
  }
  return <AppStateUnlock />;
};

export const AppLock: FC<AppLockProps> = ({ children }) => {
  if (platformEnv.isNative) {
    return <AppLockNormalMode>{children}</AppLockNormalMode>;
  }
  return <AppLockOverlayMode>{children}</AppLockOverlayMode>;
};
