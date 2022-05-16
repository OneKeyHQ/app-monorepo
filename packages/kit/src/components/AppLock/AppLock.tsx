import React, { FC, useMemo } from 'react';

import { Box, OverlayContainer } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useAppSelector, useDebounce } from '../../hooks';

import { AppStateHeartbeat } from './AppStateHeartbeat';
import { AppStateUnlock } from './AppStateUnlock';
import { AppStateUpdator } from './AppStateUpdator';

type AppLockProps = { children: JSX.Element };

export const AppLockOverlayMode: FC<AppLockProps> = ({ children }) => {
  const enableAppLock = useAppSelector((s) => s.settings.enableAppLock);
  const isPasswordSet = useAppSelector((s) => s.data.isPasswordSet);
  const isStatusUnlock = useAppSelector((s) => s.status.isUnlock);
  const isDataUnlock = useAppSelector((s) => s.data.isUnlock);

  const memo = useMemo(
    () => ({ enableAppLock, isPasswordSet, isStatusUnlock, isDataUnlock }),
    [enableAppLock, isPasswordSet, isStatusUnlock, isDataUnlock],
  );
  const data = useDebounce(memo, 300);

  const prerequisites = data.isPasswordSet && data.enableAppLock;
  const isUnlock = data.isDataUnlock && data.isStatusUnlock;

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
  const isPasswordSet = useAppSelector((s) => s.data.isPasswordSet);
  const isStatusUnlock = useAppSelector((s) => s.status.isUnlock);
  const isDataUnlock = useAppSelector((s) => s.data.isUnlock);

  const memo = useMemo(
    () => ({ enableAppLock, isPasswordSet, isStatusUnlock, isDataUnlock }),
    [enableAppLock, isPasswordSet, isStatusUnlock, isDataUnlock],
  );
  const data = useDebounce(memo, 300);

  const prerequisites = data.isPasswordSet && data.enableAppLock;
  const isUnlock = data.isDataUnlock && data.isStatusUnlock;

  if (prerequisites && !isUnlock) {
    return <AppStateUnlock />;
  }
  return (
    <Box w="full" h="full">
      {prerequisites && isUnlock ? <AppStateUpdator /> : null}
      {prerequisites && isUnlock ? <AppStateHeartbeat /> : null}
      {children}
    </Box>
  );
};

export const AppLock: FC<AppLockProps> = ({ children }) => {
  if (platformEnv.isNative) {
    return <AppLockNormalMode>{children}</AppLockNormalMode>;
  }
  return <AppLockOverlayMode>{children}</AppLockOverlayMode>;
};
