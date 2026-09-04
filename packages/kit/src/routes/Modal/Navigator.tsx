import { useEffect, useRef } from 'react';

import { useIsFocused } from '@react-navigation/native';

import {
  EPageType,
  Theme,
  setGlassHeaderUIStyle,
  setSystemBarsOverride,
  useThemeName,
} from '@onekeyhq/components';
import { RootModalNavigator } from '@onekeyhq/components/src/layouts/Navigation/Navigator';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type {
  EModalRoutes,
  EOnboardingV2Routes,
} from '@onekeyhq/shared/src/routes';
import type { EFullScreenPushRoutes } from '@onekeyhq/shared/src/routes/fullScreenPush';

import {
  fullScreenPushRouterConfig,
  modalRouter,
  onboardingRouterV2Config,
} from './router';

export function ModalNavigator({ pageType }: { pageType?: EPageType }) {
  return (
    <RootModalNavigator<EModalRoutes>
      config={modalRouter}
      pageType={pageType}
    />
  );
}

export function IOSFullScreenNavigator() {
  return <ModalNavigator pageType={EPageType.fullScreen} />;
}

export function FullScreenPushNavigator() {
  return (
    <RootModalNavigator<EFullScreenPushRoutes>
      config={fullScreenPushRouterConfig}
      pageType={EPageType.fullScreenPush}
    />
  );
}

export function OnboardingNavigator() {
  // Onboarding forces a dark Theme for its content, so the iOS 26 glass header
  // bar must use the dark variant while onboarding is the foreground route —
  // otherwise it flashes the light variant (the app theme is usually light).
  //
  // But the glass variant lives in a single global (setGlassHeaderUIStyle), so
  // the moment another root route is layered on top (a modal, the main tab)
  // onboarding is no longer foreground and must RELINQUISH the bar to the app
  // theme. If it kept the global pinned to dark, that app-themed screen's glass
  // header would inherit onboarding's stale dark and visibly flip dark -> light
  // on its first frames. useIsFocused re-renders us on blur/focus so the global
  // tracks whoever is actually foreground; the unmount cleanup covers the
  // onboarding-replaced-by-main case where we never blur first.
  const appThemeName = useThemeName();
  const isFocused = useIsFocused();
  const appGlassStyle = appThemeName === 'dark' ? 'dark' : 'light';
  if (platformEnv.isNativeIOS26Plus) {
    setGlassHeaderUIStyle(isFocused ? 'dark' : appGlassStyle);
  }
  // Android's system bars have the same foreground problem the glass
  // header does: they are painted globally from the app theme (see
  // useAppearanceTheme), so a light-themed app shows white bars around
  // this dark-locked content. Same focus-driven fix — pin the bars dark
  // while onboarding is foreground, hand them back on blur. The pin
  // lives as an override slot inside the bars' own module, so an app
  // theme change mid-onboarding repaints through the same effective
  // value instead of racing this write (no stale-capture ref needed).
  if (platformEnv.isNativeAndroid) {
    setSystemBarsOverride(isFocused ? 'dark' : null);
  }
  // The render-time write above already handles focus AND blur (useIsFocused
  // re-renders on both, relinquishing to appGlassStyle when not focused). The
  // ONLY case it can't reach is unmount-without-blur (onboarding replaced by
  // main), so the effect cleanup exists purely for that. Keep it unmount-only
  // ([] deps) and read the latest app style from a ref — an [appGlassStyle]
  // dep would fire the cleanup on every theme toggle with the STALE captured
  // value, writing it back over the render-time variant a frame later.
  const appGlassStyleRef = useRef<'light' | 'dark'>(appGlassStyle);
  appGlassStyleRef.current = appGlassStyle;
  useEffect(() => {
    if (!platformEnv.isNativeIOS26Plus) {
      return undefined;
    }
    return () => {
      setGlassHeaderUIStyle(appGlassStyleRef.current);
    };
  }, []);
  // The bars' own unmount-without-blur cover, same shape as the glass
  // cleanup above; `null` reads the live app variant inside the module,
  // so no ref ride-along is needed here.
  useEffect(() => {
    if (!platformEnv.isNativeAndroid) {
      return undefined;
    }
    return () => {
      setSystemBarsOverride(null);
    };
  }, []);
  return (
    <Theme name="dark">
      <RootModalNavigator<EOnboardingV2Routes>
        config={onboardingRouterV2Config}
        pageType={EPageType.onboarding}
      />
    </Theme>
  );
}
