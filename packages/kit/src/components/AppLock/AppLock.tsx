import type { FC } from 'react';
import { Fragment, useEffect } from 'react';

import { Box, OverlayContainer } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { useAppLock } from '../../hooks/useAppLock';
import { setAppRenderReady } from '../../store/reducers/data';
import { FULLWINDOW_OVERLAY_PORTAL } from '../../utils/overlayUtils';
import { isPortalExisted } from '../../views/Overlay/RootPortal';
import { LazyDisplayView } from '../LazyDisplayView';

import { AppStateHeartbeat } from './AppStateHeartbeat';
import { AppStateUnlock } from './AppStateUnlock';
import { AppStateUpdater } from './AppStateUpdater';

type AppLockProps = { children: JSX.Element; renderAsOverlay?: boolean };

export const AppLockView: FC<AppLockProps> = ({
  children,
  renderAsOverlay,
}) => {
  const { showUnlockView, isPasswordSet, isUnlock } = useAppLock();
  // iOS should NOT render unlock screen by Overlay
  // it's not working if Modal visible
  if (showUnlockView && !renderAsOverlay) {
    return <AppStateUnlock />;
  }

  const Parent =
    !isPortalExisted(FULLWINDOW_OVERLAY_PORTAL) &&
    showUnlockView &&
    renderAsOverlay
      ? LazyDisplayView
      : Fragment;

  return (
    <Box w="full" h="full" testID="AppLockView">
      {showUnlockView && renderAsOverlay ? (
        <Parent>
          <OverlayContainer>
            <AppStateUnlock />
          </OverlayContainer>
        </Parent>
      ) : null}
      {isPasswordSet && isUnlock ? <AppStateUpdater /> : null}
      {isUnlock ? <AppStateHeartbeat /> : null}
      {children}
    </Box>
  );
};

export const AppLock: FC<AppLockProps> = ({ children }) => {
  const { dispatch } = backgroundApiProxy;
  useEffect(() => {
    dispatch(setAppRenderReady());
  }, [dispatch]);
  // web needs render all navigation
  return (
    <AppLockView
      // renderAsOverlay
      renderAsOverlay={!platformEnv.isNative}
    >
      {children}
    </AppLockView>
  );
};
