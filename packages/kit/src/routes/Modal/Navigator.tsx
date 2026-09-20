import { useEffect, useLayoutEffect, useRef, useState } from 'react';

import { useIsFocused } from '@react-navigation/native';

import {
  EPageType,
  Spinner,
  Stack,
  Theme,
  acquireNativeTabletRealWidthMedia,
  popToMainRoute,
  releaseNativeTabletRealWidthMedia,
  setGlassHeaderUIStyle,
  setSystemBarsOverride,
  useThemeName,
} from '@onekeyhq/components';
import { RootModalNavigator } from '@onekeyhq/components/src/layouts/Navigation/Navigator';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  EModalRoutes,
  EModalSettingRoutes,
  type EOnboardingV2Routes,
} from '@onekeyhq/shared/src/routes';
import type { EFullScreenPushRoutes } from '@onekeyhq/shared/src/routes/fullScreenPush';

import useAppNavigation from '../../hooks/useAppNavigation';
import {
  openTravelModeSettingsWithAdmission,
  shouldRedirectOnboardingToTravelMode,
} from '../../utils/onboardingEntryGate';

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

function TravelModeOnboardingRedirect() {
  const navigation = useAppNavigation();
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) {
      return;
    }
    startedRef.current = true;
    void openTravelModeSettingsWithAdmission({
      openTravelModeSettings: async ({ admissionId }) => {
        await popToMainRoute();
        navigation.pushModal(EModalRoutes.SettingModal, {
          screen: EModalSettingRoutes.SettingTravelModeModal,
          params: { admissionId },
        });
      },
    }).then((opened) => {
      if (!opened) {
        void popToMainRoute();
      }
    });
  }, [navigation]);

  return (
    <Stack flex={1} alignItems="center" justifyContent="center">
      <Spinner size="large" />
    </Stack>
  );
}

function StandardOnboardingNavigator() {
  const isFocused = useIsFocused();
  // Tamagui's native useMedia subscribes in a passive effect, so screens that
  // mount in the same commit as the real-width hold miss its refresh and keep
  // the clamped breakpoints. Mount them only once the hold is in place; the
  // layout-effect update commits before the first frame is painted.
  const [isMediaReady, setIsMediaReady] = useState(!platformEnv.isNativeIOSPad);
  // Full-screen onboarding uses the real iPad width only while focused.
  // Keep this inside the standard route so travel-mode admission is unchanged.
  useLayoutEffect(() => {
    if (!isFocused) {
      setIsMediaReady(true);
      return undefined;
    }
    acquireNativeTabletRealWidthMedia();
    setIsMediaReady(true);
    return () => {
      releaseNativeTabletRealWidthMedia();
    };
  }, [isFocused]);
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
  const appGlassStyle = appThemeName === 'dark' ? 'dark' : 'light';
  if (platformEnv.isNativeIOS26Plus) {
    setGlassHeaderUIStyle(isFocused ? 'dark' : appGlassStyle);
  }
  // Android's system bars have the same foreground problem the glass
  // header does: they are painted globally from the app theme (see
  // useAppearanceTheme), so a light-themed app shows white bars around
  // this dark-locked content. Pin them dark for the whole onboarding
  // session — including while a root modal (e.g. Prime gift) is layered
  // on top. Releasing on blur snaps the window back to the app's light
  // theme for a frame (OK-63777). Theme-locked modals add their own
  // named pin; this owner is released only when onboarding unmounts.
  if (platformEnv.isNativeAndroid) {
    setSystemBarsOverride('dark', 'onboarding');
  }
  // The iOS glass render-time write above handles focus AND blur
  // (useIsFocused re-renders on both, relinquishing to appGlassStyle
  // when not focused). The ONLY case it can't reach is
  // unmount-without-blur (onboarding replaced by main), so the effect
  // cleanup exists purely for that. Keep it unmount-only ([] deps)
  // and read the latest app style from a ref — an [appGlassStyle]
  // dep would fire the cleanup on every theme toggle with the STALE
  // captured value, writing it back over the render-time variant a
  // frame later.
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
  // Release the onboarding pin only on unmount (replaced by main). Blur
  // must not clear it — a dark-locked modal on top still needs dark bars.
  useEffect(() => {
    if (!platformEnv.isNativeAndroid) {
      return undefined;
    }
    return () => {
      setSystemBarsOverride(null, 'onboarding');
    };
  }, []);
  return (
    <Theme name="dark">
      {isMediaReady ? (
        <RootModalNavigator<EOnboardingV2Routes>
          config={onboardingRouterV2Config}
          pageType={EPageType.onboarding}
        />
      ) : null}
    </Theme>
  );
}

export function OnboardingNavigator() {
  if (shouldRedirectOnboardingToTravelMode()) {
    return <TravelModeOnboardingRedirect />;
  }
  return <StandardOnboardingNavigator />;
}
