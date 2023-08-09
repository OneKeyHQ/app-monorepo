import type { FC } from 'react';
import { Fragment, useEffect, useMemo } from 'react';

import { Box, OverlayContainer } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { useAppSelector, useDebounce } from '../../hooks';
import { unlockWhiteListUrls } from '../../routes/linking.path';
import { setAppRenderReady } from '../../store/reducers/data';
import {
  selectEnableAppLock,
  selectIsPasswordSet,
  selectIsStatusUnlock,
  selectIsUnlock,
} from '../../store/selectors';
import { FULLWINDOW_OVERLAY_PORTAL } from '../../utils/overlayUtils';
import { isPortalExisted } from '../../views/Overlay/RootPortal';
import { LazyDisplayView } from '../LazyDisplayView';

import { AppStateHeartbeat } from './AppStateHeartbeat';
import { AppStateUnlock } from './AppStateUnlock';
import { AppStateUpdater } from './AppStateUpdater';

type AppLockProps = { children: JSX.Element; renderAsOverlay?: boolean };

function isUnlockWhiteListUrl() {
  // only available for web
  // TODO only for dapp mode web, but not wallet mode web
  if (!platformEnv.isWeb) {
    return false;
  }
  return Boolean(
    unlockWhiteListUrls.find((item) =>
      window.location?.pathname?.startsWith(item),
    ),
  );
}

export const AppLockView: FC<AppLockProps> = ({
  children,
  renderAsOverlay,
}) => {
  const enableAppLock = useAppSelector(selectEnableAppLock);
  const isPasswordSet = useAppSelector(selectIsPasswordSet);
  const isStatusUnlock = useAppSelector(selectIsStatusUnlock);
  const isDataUnlock = useAppSelector(selectIsUnlock);

  const memo = useMemo(
    () => ({ enableAppLock, isPasswordSet, isStatusUnlock, isDataUnlock }),
    [enableAppLock, isPasswordSet, isStatusUnlock, isDataUnlock],
  );
  const data = useDebounce(memo, 300);
  // const route = useRoute();
  // console.log('AppLockView route', route);
  const prerequisites = data.isPasswordSet;
  const isUnlock = data.isDataUnlock && data.isStatusUnlock;
  const showUnlockView = prerequisites && !isUnlock && !isUnlockWhiteListUrl();

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
      {prerequisites && isUnlock ? <AppStateUpdater /> : null}
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
