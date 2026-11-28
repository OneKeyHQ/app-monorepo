import {
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { useNavigationState } from '@react-navigation/native';
import { useEvent } from 'react-native-reanimated';

import type { ITabBarDrawer } from '@onekeyhq/components';
import {
  ESplitViewType,
  Stack,
  useIsSplitView,
  useSplitViewType,
} from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ETabRoutes } from '@onekeyhq/shared/src/routes';
import { ERootRoutes } from '@onekeyhq/shared/src/routes/root';

import { ErrorBoundarySimple } from '../ErrorBoundary';

import {
  profileDrawerProgress,
  setProfileDrawerOpen,
  useIsProfileDrawerOpen,
} from './profileDrawerStore';

const LazyProfileDrawerContent = lazy(() => import('./ProfileDrawerContent'));

// The content loads the More menu's checks, so it mounts on the first open or
// once launch has settled, not with the tab bar.
const CONTENT_PRELOAD_DELAY_MS = 5000;

type INavState = {
  routes?: { name: string; state?: INavState }[];
  index?: number;
};

// Opening swipes belong to the wallet home's root screen only.
function selectIsHomeRoot(state: INavState | undefined) {
  const tabs = state?.routes?.find((r) => r.name === ERootRoutes.Main)?.state;
  const tab = tabs?.routes?.[tabs.index ?? 0];
  if (tab?.name !== ETabRoutes.Home) return false;
  return (tab.state?.index ?? 0) === 0;
}

function DrawerBlank() {
  return <Stack flex={1} bg="$bgApp" />;
}

export function useProfileTabDrawer(): ITabBarDrawer | undefined {
  const isOpen = useIsProfileDrawerOpen();
  const isHomeRoot = useNavigationState(selectIsHomeRoot);
  // A tablet's split view mounts a tab navigator per pane, and the open state
  // is shared. The drawer belongs to the pane showing the wallet home: the
  // main one while both panes show, else the sub one (the main is hidden).
  const splitViewType = useSplitViewType();
  const isSplitVisible = useIsSplitView();
  const ownsDrawer =
    splitViewType === ESplitViewType.UNKNOWN ||
    (splitViewType === ESplitViewType.MAIN) === isSplitVisible;
  const [contentReady, setContentReady] = useState(false);
  // Runs on the UI thread through the animated drawer host, so the header
  // avatar fades in the same frame the page moves. Reanimated types the
  // handler object as a plain function, hence the cast.
  const onProgress = useEvent<{ progress: number }>((event) => {
    'worklet';
    profileDrawerProgress.value = event.progress;
  }) as unknown as ITabBarDrawer['onProgress'];

  useEffect(() => {
    if (isOpen) setContentReady(true);
  }, [isOpen]);
  useEffect(() => {
    const timer = setTimeout(
      () => setContentReady(true),
      CONTENT_PRELOAD_DELAY_MS,
    );
    return () => clearTimeout(timer);
  }, []);

  const renderContent = useCallback(
    () =>
      contentReady ? (
        // Content that fails to load leaves a blank drawer, not the app's
        // error screen.
        <ErrorBoundarySimple fallback={<DrawerBlank />}>
          <Suspense fallback={<DrawerBlank />}>
            <LazyProfileDrawerContent />
          </Suspense>
        </ErrorBoundarySimple>
      ) : (
        <DrawerBlank />
      ),
    [contentReady],
  );

  return useMemo(
    () =>
      platformEnv.isNative && ownsDrawer
        ? {
            renderContent,
            open: isOpen,
            onOpenChange: setProfileDrawerOpen,
            onProgress,
            swipeEnabled: isHomeRoot,
          }
        : undefined,
    [isHomeRoot, isOpen, onProgress, ownsDrawer, renderContent],
  );
}
