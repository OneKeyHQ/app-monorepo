import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import * as ScreenOrientation from 'expo-screen-orientation';
import { noop } from 'lodash';
import {
  AppState,
  Dimensions,
  StatusBar,
  useWindowDimensions,
} from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { isSpanning } from '@onekeyhq/shared/src/modules/DualScreenInfo';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { TradingViewNativeContainer } from './TradingViewNativeContainer';
import { TradingViewNativeFullscreenTransitionContext } from './TradingViewNativeFullscreenTransitionContext';
import { shouldHideTradingViewNativeStatusBar } from './utils/fullscreenLayout';

import type { ITradingViewNativeFullscreenTransition } from './TradingViewNativeFullscreenTransitionContext';
import type { ITradingViewNativeProps } from './types';

// Reveal the layer anyway if its chart never reports a drawn frame, e.g. while
// it has nothing to draw yet.
const FULLSCREEN_LAYER_READY_TIMEOUT_MS = 2000;
// Rotate back anyway if the returned status bar never reports a top inset,
// e.g. a window that keeps it off the landscape layout.
const STATUS_BAR_RETURN_TIMEOUT_MS = 500;
// Page layouts queued in landscape can still arrive once the window reports
// portrait again.
const WINDOW_ROTATION_SETTLE_MS = 300;
// End the rotation anyway if the window stays landscape after the session,
// e.g. one that ignores the portrait lock.
const WINDOW_ROTATION_RETURN_TIMEOUT_MS = 2000;

interface IFullscreenSession {
  isRevealing: boolean;
  isRotatingBack: boolean;
  rotates: boolean;
  hidesStatusBar: boolean;
  // Joins the `StatusBar` props stack, so component updates elsewhere cannot
  // show the status bar again before a commit.
  statusBarEntry?: ReturnType<typeof StatusBar.pushStackEntry>;
}

function releaseStatusBar(session: IFullscreenSession) {
  if (session.statusBarEntry) {
    StatusBar.popStackEntry(session.statusBarEntry);
    session.statusBarEntry = undefined;
  }
}

function shouldUseCurrentAndroidWindowForFullscreen() {
  if (!platformEnv.isNativeAndroid) {
    return false;
  }
  if (isSpanning()) {
    return true;
  }
  const { height, width } = Dimensions.get('window');
  return width > height;
}

function getDefaultOrientationLock(shouldUseCurrentAndroidWindow: boolean) {
  if (shouldUseCurrentAndroidWindow) {
    return ScreenOrientation.OrientationLock.DEFAULT;
  }
  return ScreenOrientation.OrientationLock.PORTRAIT_UP;
}

function lockScreenOrientation(
  orientationLock: ScreenOrientation.OrientationLock,
) {
  void ScreenOrientation.lockAsync(orientationLock).catch(noop);
}

export function TradingViewNative(props: ITradingViewNativeProps) {
  const isOwnerFullscreen = Boolean(props.isNativeChartFullscreen);
  const {
    onNativeChartFullscreenChange,
    onNativeChartWindowRotationChange,
    ...containerProps
  } = props;
  const isAndroid = platformEnv.isNativeAndroid === true;
  // Android keeps the owner's page on screen whenever the window rotates: a
  // requested fullscreen reaches the owner, which hides its page, only after
  // the layer is shown, and the owner restores its page before the layer is
  // hidden on exit.
  const [isEntering, setIsEntering] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const [isRevealed, setIsRevealed] = useState(false);
  // Decided once per session; once rotated, the window itself is landscape.
  const landscapeLayoutRef = useRef<boolean | undefined>(undefined);
  // The owner can leave fullscreen without the chart's control, e.g. on
  // hardware back. A layer that has rotated the window then exits as the
  // control does, so it covers the window rotating back. Switching in this
  // render keeps the session, and its landscape decision, from ending first.
  const [wasOwnerFullscreen, setWasOwnerFullscreen] =
    useState(isOwnerFullscreen);
  let isExitingSession = isExiting;
  if (wasOwnerFullscreen !== isOwnerFullscreen) {
    setWasOwnerFullscreen(isOwnerFullscreen);
    if (
      !isOwnerFullscreen &&
      !isExiting &&
      isRevealed &&
      landscapeLayoutRef.current
    ) {
      setIsExiting(true);
      isExitingSession = true;
    }
  }
  const isFullscreen = isOwnerFullscreen || isEntering || isExitingSession;
  // Shows and hides the layer on the UI thread, without waiting for a commit.
  const layerOpacity = useSharedValue(0);
  const revealOnLandscape = useSharedValue(false);
  const { height, width } = useWindowDimensions();
  const { top: topInset } = useSafeAreaInsets();
  const isStatusBarHidden = shouldHideTradingViewNativeStatusBar({
    height,
    isAndroid,
    isFullscreen,
    isSpanningWindow: isAndroid && isSpanning(),
    width,
  });
  const onFullscreenChangeRef = useRef(onNativeChartFullscreenChange);
  const onWindowRotationChangeRef = useRef(onNativeChartWindowRotationChange);
  const isOwnerFullscreenRef = useRef(isOwnerFullscreen);
  const isStatusBarHiddenRef = useRef(isStatusBarHidden);
  // Runs before the session effect below, which reads these refs.
  useLayoutEffect(() => {
    onFullscreenChangeRef.current = onNativeChartFullscreenChange;
    onWindowRotationChangeRef.current = onNativeChartWindowRotationChange;
    isOwnerFullscreenRef.current = isOwnerFullscreen;
    isStatusBarHiddenRef.current = isStatusBarHidden;
  }, [
    isOwnerFullscreen,
    isStatusBarHidden,
    onNativeChartFullscreenChange,
    onNativeChartWindowRotationChange,
  ]);
  useEffect(() => {
    // The owner has taken over the requested fullscreen.
    if (isOwnerFullscreen) setIsEntering(false);
  }, [isOwnerFullscreen]);

  if (!isFullscreen) {
    landscapeLayoutRef.current = undefined;
  } else if (landscapeLayoutRef.current === undefined) {
    landscapeLayoutRef.current =
      isAndroid && !shouldUseCurrentAndroidWindowForFullscreen();
  }
  const isLandscapeLayout = landscapeLayoutRef.current ?? false;

  // The owner's page lays out in landscape while a session rotates the window,
  // and a window that is landscape on its own is never rotated.
  const [isRotatingWindow, setIsRotatingWindow] = useState(false);
  if (isLandscapeLayout && !isRotatingWindow) {
    setIsRotatingWindow(true);
  }
  useEffect(() => {
    if (!isRotatingWindow || isFullscreen) {
      return;
    }
    const timeout = setTimeout(
      () => setIsRotatingWindow(false),
      width > height
        ? WINDOW_ROTATION_RETURN_TIMEOUT_MS
        : WINDOW_ROTATION_SETTLE_MS,
    );
    return () => clearTimeout(timeout);
  }, [height, isFullscreen, isRotatingWindow, width]);
  useLayoutEffect(() => {
    if (!isRotatingWindow) {
      return;
    }
    onWindowRotationChangeRef.current?.(true);
    return () => onWindowRotationChangeRef.current?.(false);
  }, [isRotatingWindow]);

  const sessionRef = useRef<IFullscreenSession | undefined>(undefined);
  const handleFullscreenChange = useCallback(
    (nextIsFullscreen: boolean) => {
      if (!isAndroid) {
        onFullscreenChangeRef.current?.(nextIsFullscreen);
        return;
      }
      if (nextIsFullscreen) {
        if (!isOwnerFullscreenRef.current) setIsEntering(true);
        return;
      }
      setIsEntering(false);
      const session = sessionRef.current;
      // The page lays out with the status bar again while still covered, so it
      // does not shift once the window is portrait.
      if (session) releaseStatusBar(session);
      if (!isOwnerFullscreenRef.current) {
        return;
      }
      // A layer that has rotated the window stays up until it rotates back.
      if (session?.rotates && session.isRevealing) {
        setIsExiting(true);
      }
      onFullscreenChangeRef.current?.(false);
    },
    [isAndroid],
  );

  const handleLayerReady = useCallback(() => {
    const session = sessionRef.current;
    if (!session || session.isRevealing) {
      return;
    }
    session.isRevealing = true;
    const reveal = () => {
      if (sessionRef.current !== session) return;
      revealOnLandscape.value = false;
      layerOpacity.value = 1;
      // Hidden once the page is covered: hiding it earlier would lay the
      // portrait page out again, and the page sizes its chart from that.
      if (session.hidesStatusBar && !session.statusBarEntry) {
        session.statusBarEntry = StatusBar.pushStackEntry({ hidden: true });
      }
      setIsRevealed(true);
      // The owner hides its page in a heavy commit; let the shown layer reach
      // the screen first.
      requestAnimationFrame(() => {
        if (sessionRef.current !== session) return;
        if (!isOwnerFullscreenRef.current) {
          onFullscreenChangeRef.current?.(true);
        }
      });
    };
    if (!session.rotates) {
      reveal();
      return;
    }
    // The layer has drawn at the landscape size; rotate before showing it, so
    // the rotation starts from the unchanged page. The lock can resolve after
    // the window has rotated; the host shows the layer once it has.
    revealOnLandscape.value = true;
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE)
      .then(reveal)
      .catch(() => {
        if (sessionRef.current === session) handleFullscreenChange(false);
      });
  }, [handleFullscreenChange, layerOpacity, revealOnLandscape]);

  useLayoutEffect(() => {
    if (!isFullscreen) {
      return;
    }

    // A session keeps the decisions it started with.
    const session: IFullscreenSession = {
      isRevealing: false,
      isRotatingBack: false,
      rotates: landscapeLayoutRef.current ?? false,
      hidesStatusBar: isStatusBarHiddenRef.current,
    };
    sessionRef.current = session;
    layerOpacity.value = 0;
    revealOnLandscape.value = false;
    // The iOS fullscreen page owns its orientation through native-stack.
    const shouldManageOrientation = isAndroid;
    const readyTimeout = shouldManageOrientation
      ? setTimeout(handleLayerReady, FULLSCREEN_LAYER_READY_TIMEOUT_MS)
      : undefined;

    const appStateSubscription = AppState.addEventListener(
      'change',
      (nextState) => {
        if (nextState === 'background') {
          handleFullscreenChange(false);
        }
      },
    );

    return () => {
      if (sessionRef.current === session) sessionRef.current = undefined;
      clearTimeout(readyTimeout);
      appStateSubscription.remove();
      layerOpacity.value = 0;
      revealOnLandscape.value = false;
      setIsRevealed(false);
      setIsExiting(false);
      releaseStatusBar(session);
      if (shouldManageOrientation) {
        lockScreenOrientation(getDefaultOrientationLock(!session.rotates));
      }
    };
  }, [
    handleFullscreenChange,
    handleLayerReady,
    isAndroid,
    isFullscreen,
    layerOpacity,
    revealOnLandscape,
  ]);

  useLayoutEffect(() => {
    // Wait until the owner has committed its restored page, then rotate back.
    const session = sessionRef.current;
    if (!isExiting || isOwnerFullscreen || !session || session.isRotatingBack) {
      return;
    }
    // An exit the owner started itself has not returned the status bar yet.
    releaseStatusBar(session);
    const rotateBack = () => {
      if (sessionRef.current !== session || session.isRotatingBack) return;
      session.isRotatingBack = true;
      // Hide the layer as the rotation is requested: the lock can resolve
      // after the window has rotated, and a landscape layer must not cover
      // part of the portrait page.
      layerOpacity.value = 0;
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP)
        .catch(noop)
        .then(() => {
          if (sessionRef.current === session) setIsExiting(false);
        })
        .catch(noop);
    };
    // The page must have laid out with the returned status bar before it is
    // uncovered; otherwise it shifts down, and resizes its chart, once
    // portrait.
    if (!session.hidesStatusBar || topInset > 0) {
      rotateBack();
      return;
    }
    const timeout = setTimeout(rotateBack, STATUS_BAR_RETURN_TIMEOUT_MS);
    return () => clearTimeout(timeout);
  }, [isExiting, isOwnerFullscreen, layerOpacity, topInset]);

  const transition = useMemo<ITradingViewNativeFullscreenTransition>(
    () => ({
      isRevealed: !isAndroid || isRevealed,
      isLandscapeLayout,
      isStatusBarHidden,
      layerOpacity: isAndroid ? layerOpacity : undefined,
      revealOnLandscape: isAndroid ? revealOnLandscape : undefined,
      onLayerReady: handleLayerReady,
    }),
    [
      handleLayerReady,
      isAndroid,
      isLandscapeLayout,
      isRevealed,
      isStatusBarHidden,
      layerOpacity,
      revealOnLandscape,
    ],
  );

  return (
    <TradingViewNativeFullscreenTransitionContext.Provider value={transition}>
      <TradingViewNativeContainer
        {...containerProps}
        isNativeChartFullscreen={isFullscreen}
        onNativeChartFullscreenChange={
          onNativeChartFullscreenChange ? handleFullscreenChange : undefined
        }
      />
    </TradingViewNativeFullscreenTransitionContext.Provider>
  );
}
