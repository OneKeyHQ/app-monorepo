import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { useIntl } from 'react-intl';
import { Platform } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';

import { Dialog, Toast } from '@onekeyhq/components';
import type { IDialogInstance } from '@onekeyhq/components';
import { acquireDeferredGuideBlocker } from '@onekeyhq/components/src/hooks/useDeferredGuideBlocker';
import {
  appUpdatePersistAtom,
  useAppUpdatePersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { jotaiDefaultStore } from '@onekeyhq/kit-bg/src/states/jotai/utils/jotaiDefaultStore';
import {
  EAppUpdateStatus,
  EUpdateFileType,
  getUpdateFileType,
  isAllowedFeaturedHref,
} from '@onekeyhq/shared/src/appUpdate';
import type {
  IFeaturedChangelog,
  IFeaturedItem,
} from '@onekeyhq/shared/src/appUpdate';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EAppUpdateRoutes, EModalRoutes } from '@onekeyhq/shared/src/routes';
import { parseNotificationPayload } from '@onekeyhq/shared/src/utils/notificationsUtils';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { isForceUpdateStrategy } from '../../../components/AppUpdate/updateStrategy';
import { useDownloadPackage } from '../../../components/AppUpdate/useDownloadPackage';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { handleDeepLinkUrl } from '../../../routes/config/deeplink';
import { FeaturedCarousel } from '../components/FeaturedCarousel';
import { FeaturedFooter } from '../components/FeaturedFooter';
import {
  markPendingContactSupportHandoff,
  useForceUpdateContactSupport,
} from '../hooks/useForceUpdateContactSupport';

import type { IFeaturedCarouselRef } from '../components/FeaturedCarousel';

// Injected payload for the ops-only Featured Changelog preview page.
// `featuredChangelog` drives the carousel in both modes; `latestVersion` is the
// target version (feeds only the inert pre-install CTA label). Deliberately
// carries NO storeUrl/downloadUrl/updateStrategy — those would come from a
// different (online) version and must never mix into the previewed version. When
// present, the dialog renders ENTIRELY from this object (never
// appUpdatePersistAtom) and every production side effect is neutralized —
// download, store open, DownloadVerify, force-lock, and the onClose refetch —
// EXCEPT the already-upgraded CTA's configured jump, which stays live because
// verifying that target is the whole point of the preview.
export interface IFeaturedChangelogPreviewData {
  featuredChangelog: IFeaturedChangelog;
  latestVersion?: string;
}

export interface IShowFeaturedChangelogDialogParams {
  isPreInstall?: boolean;
  previewData?: IFeaturedChangelogPreviewData;
}

// Set only while the ops preview renders; readers fall back to the atom when it
// is undefined (the production path).
const FeaturedChangelogPreviewContext = createContext<
  IFeaturedChangelogPreviewData | undefined
>(undefined);

function dispatchFeatureCta(activeFeature: IFeaturedItem | undefined) {
  if (!activeFeature) return;
  // Mode-driven dispatch (IWalletBanner pattern). payload is the canonical
  // carrier for the URL/JSON; fall back to href so backends that only set
  // href still work for the URL-opening modes.
  if (activeFeature.mode !== undefined) {
    // Returning here unconditionally made the CTA dead whenever the payload
    // never dispatched.
    const dispatched = parseNotificationPayload(
      activeFeature.mode,
      activeFeature.payload ?? activeFeature.href,
      () => {},
    );
    if (dispatched) {
      return;
    }
    if (isAllowedFeaturedHref(activeFeature.href)) {
      handleDeepLinkUrl({ url: activeFeature.href });
    }
    return;
  }
  if (!isAllowedFeaturedHref(activeFeature.href)) return;
  if (activeFeature.hrefType === 'external') {
    openUrlExternal(activeFeature.href);
  } else {
    handleDeepLinkUrl({ url: activeFeature.href });
  }
}

function useFeaturedCta({
  isPreInstall,
  isLocked,
  activeFeature,
  hasNext,
  onNext,
  closeDialog,
}: {
  isPreInstall: boolean;
  isLocked: boolean;
  activeFeature: IFeaturedItem | undefined;
  hasNext: boolean;
  onNext: () => void;
  closeDialog: () => Promise<void>;
}) {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const preview = useContext(FeaturedChangelogPreviewContext);
  const [appUpdateInfo] = useAppUpdatePersistAtom();
  const { downloadPackage } = useDownloadPackage();

  // In preview mode the CTA is inert (see onCtaPress), so the real update
  // fields are intentionally absent — only `latestVersion` (the target) feeds
  // the label. Never read the persisted atom while previewing.
  const storeUrl = preview ? undefined : appUpdateInfo.storeUrl;
  const downloadUrl = preview ? undefined : appUpdateInfo.downloadUrl;
  const jsBundle = preview ? undefined : appUpdateInfo.jsBundle;
  const status = preview ? undefined : appUpdateInfo.status;
  const latestVersion = preview
    ? preview.latestVersion
    : appUpdateInfo.latestVersion;
  const jsBundleVersion = preview ? undefined : appUpdateInfo.jsBundleVersion;

  const updateFileType = useMemo(
    () =>
      getUpdateFileType({
        latestVersion,
        jsBundleVersion,
      }),
    [latestVersion, jsBundleVersion],
  );
  const shouldOpenStore =
    isPreInstall && updateFileType === EUpdateFileType.appShell && !!storeUrl;

  let ctaText =
    activeFeature?.ctaText ??
    intl.formatMessage({ id: ETranslations.global_done });
  if (isPreInstall) {
    ctaText = intl.formatMessage({
      id: shouldOpenStore
        ? ETranslations.update_update_now
        : ETranslations.update_download_and_verify_text,
    });
  } else if (activeFeature?.ctaAction === 'next') {
    ctaText = intl.formatMessage({
      id: hasNext ? ETranslations.global_next : ETranslations.global_done,
    });
  }

  const onCtaPress = useCallback(async () => {
    if (!isPreInstall && activeFeature?.ctaAction === 'next') {
      if (hasNext) onNext();
      else await closeDialog();
      return;
    }
    // Ops preview: the pre-install CTA must not start a real download / open
    // the store / push DownloadVerify on a production device. The
    // already-upgraded CTA (dispatchFeatureCta) stays LIVE — jumping to the
    // configured target is exactly what ops needs to verify.
    if (preview) {
      await closeDialog();
      if (!isPreInstall) {
        setTimeout(() => dispatchFeatureCta(activeFeature), 300);
      } else {
        Toast.success({
          title: 'Preview mode',
          message: 'In production this starts the real update flow.',
        });
      }
      return;
    }

    // Keep the dialog as the force-update blocker when there's no follow-on
    // route to take over (store / no-action). The download branch closes
    // because DownloadVerify takes over the blocker.
    const closeIfUnlocked = isLocked ? () => undefined : closeDialog;

    if (isPreInstall) {
      if (shouldOpenStore && storeUrl) {
        // Server-driven store URL must reach the store app via the system
        // browser; in-app browsers never trigger universal links.
        openUrlExternal(storeUrl, { useSystemBrowser: true });
        await closeIfUnlocked();
        return;
      }
      if (downloadUrl || jsBundle?.downloadUrl) {
        if (status === EAppUpdateStatus.notify) {
          void downloadPackage();
        }
        const release = acquireDeferredGuideBlocker();
        try {
          await closeDialog();
        } catch (error) {
          release();
          throw error;
        }
        setTimeout(() => {
          try {
            navigation.pushModal(EModalRoutes.AppUpdateModal, {
              screen: EAppUpdateRoutes.DownloadVerify,
              params: { isForceUpdate: isLocked },
            });
          } finally {
            release();
          }
        }, 300);
        return;
      }
      await closeIfUnlocked();
      return;
    }

    await closeDialog();
    setTimeout(() => dispatchFeatureCta(activeFeature), 300);
  }, [
    preview,
    isPreInstall,
    isLocked,
    shouldOpenStore,
    storeUrl,
    downloadUrl,
    jsBundle?.downloadUrl,
    status,
    downloadPackage,
    navigation,
    closeDialog,
    activeFeature,
    hasNext,
    onNext,
  ]);

  return { ctaText, onCtaPress };
}

function useFeatures(): IFeaturedItem[] {
  const preview = useContext(FeaturedChangelogPreviewContext);
  const [appUpdateInfo] = useAppUpdatePersistAtom();
  // Memoize so a fresh `?? []` reference doesn't ripple through downstream
  // effects on every unrelated atom-field change. Preview payload wins so the
  // carousel renders the previewed changelog, not the persisted one.
  return useMemo(
    () =>
      preview
        ? preview.featuredChangelog.features
        : (appUpdateInfo.featuredChangelog?.features ?? []),
    [preview, appUpdateInfo.featuredChangelog?.features],
  );
}

function FeaturedChangelogContent({
  isPreInstall,
  isLocked,
  onLockChange,
  closeDialog,
}: {
  isPreInstall: boolean;
  isLocked: boolean;
  onLockChange?: (locked: boolean) => void;
  closeDialog: () => Promise<void>;
}) {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const isPreview = useContext(FeaturedChangelogPreviewContext) !== undefined;
  const features = useFeatures();
  const {
    updateInfo,
    isForceUpdate: isLiveLocked,
    handleContactSupport,
  } = useForceUpdateContactSupport({
    initialForceUpdate: isLocked,
    enabled: isPreInstall && !isPreview,
  });

  useEffect(() => {
    onLockChange?.(isLiveLocked);
  }, [isLiveLocked, onLockChange]);

  const [activeIndex, setActiveIndex] = useState(0);
  const activeFeature = features[activeIndex] ?? features[0];
  const carouselRef = useRef<IFeaturedCarouselRef>(null);
  const onActiveFeatureChange = useCallback(
    (_feature: IFeaturedItem, index: number) => setActiveIndex(index),
    [],
  );
  const onNext = useCallback(() => carouselRef.current?.next(), []);

  const { ctaText, onCtaPress } = useFeaturedCta({
    isPreInstall,
    isLocked: isLiveLocked,
    activeFeature,
    hasNext: activeIndex < features.length - 1,
    onNext,
    closeDialog,
  });

  const handleContactSupportPress = useCallback(async () => {
    if (platformEnv.isNative) {
      // On Native, Dialog.show renders inside FULL_WINDOW_OVERLAY_PORTAL above
      // React Navigation. Hand the force-update lock and support-polling state
      // off to UpdatePreview so the WebViewModal opened by showIntercom()
      // renders on top and UpdatePreview continues polling while Intercom is open.
      markPendingContactSupportHandoff();
      const release = acquireDeferredGuideBlocker();
      try {
        await closeDialog();
        navigation.pushModal(EModalRoutes.AppUpdateModal, {
          screen: EAppUpdateRoutes.UpdatePreview,
          params: {
            latestVersion: updateInfo?.latestVersion,
            isForceUpdate: isLiveLocked,
          },
        });
      } finally {
        release();
      }
      // Allow the AppUpdateModal -> UpdatePreview stack to commit before
      // openUrlByWebview navigates to WebViewModal inside ERootRoutes.Modal.
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 50);
      });
    }
    await handleContactSupport();
  }, [
    closeDialog,
    handleContactSupport,
    isLiveLocked,
    navigation,
    updateInfo?.latestVersion,
  ]);

  // Drive an explicit pixel height on the dialog content. The centered dialog
  // card on desktop doesn't transition auto-height when child layout
  // changes, so we give it a single child with a Reanimated-driven height that
  // smoothly animates per frame, and the frame's natural height tracks it.
  const totalCarouselHeight = useSharedValue(0);
  const [footerHeight, setFooterHeight] = useState(0);
  const dialogHeightStyle = useAnimatedStyle(() => {
    const carousel = totalCarouselHeight.value;
    if (carousel === 0 || footerHeight === 0) {
      return {};
    }
    return { height: carousel + footerHeight };
  });

  if (!features.length) return null;

  const badgeText = intl.formatMessage({
    id: ETranslations.settings_whats_new,
  });

  return (
    <Animated.View
      style={[
        {
          marginLeft: -20,
          marginRight: -20,
          marginBottom: -20,
          overflow: 'hidden',
          ...(Platform.OS !== 'web'
            ? {
                borderTopLeftRadius: 24,
                borderTopRightRadius: 24,
              }
            : null),
        },
        dialogHeightStyle,
      ]}
    >
      <FeaturedCarousel
        ref={carouselRef}
        features={features}
        badgeText={badgeText}
        showCloseButton={!isLiveLocked}
        onClose={() => void closeDialog()}
        onActiveFeatureChange={onActiveFeatureChange}
        totalHeight={totalCarouselHeight}
      />
      <FeaturedFooter
        ctaText={ctaText}
        onCtaPress={() => void onCtaPress()}
        showFullChangelog={Boolean(!isLiveLocked && !isPreview)}
        showContactSupport={Boolean(isLiveLocked && !isPreview)}
        onContactSupportPress={() => void handleContactSupportPress()}
        isPreInstall={isPreInstall}
        closeDialog={closeDialog}
        onLayout={(e) => setFooterHeight(e.nativeEvent.layout.height)}
      />
    </Animated.View>
  );
}

export function showFeaturedChangelogDialog(
  params: IShowFeaturedChangelogDialogParams = {},
): IDialogInstance | undefined {
  const { isPreInstall = false, previewData } = params;

  // Preview renders from the injected payload and never touches the atom; the
  // production path reads the persisted atom synchronously (safe because
  // jotaiDefaultStore is always available on the JS thread after app init).
  const atomInfo = previewData
    ? undefined
    : jotaiDefaultStore.get(appUpdatePersistAtom.atom());
  const features = previewData
    ? previewData.featuredChangelog.features
    : (atomInfo?.featuredChangelog?.features ?? []);
  if (features.length === 0) return undefined;

  // Prevent dismissal when a force-update is pending pre-install. Never lock
  // the operator into a preview.
  const isLocked = previewData
    ? false
    : !!atomInfo &&
      isForceUpdateStrategy(atomInfo.updateStrategy) &&
      isPreInstall;
  const isLockedRef = { current: isLocked };

  const mountTime = Date.now();

  // Mutable ref so the closeDialog closure always sees the live instance.
  const instanceRef: { current: IDialogInstance | undefined } = {
    current: undefined,
  };
  const closeDialog = async () => {
    await instanceRef.current?.close({ flag: 'programmatic' });
  };

  const dialogInstance = Dialog.show({
    showFooter: false,
    showHeader: false,
    trapFocus: false,
    // Block dismissal at the source while locked: on native the sheet animates
    // closed before onBeforeClose runs, so the guard alone cannot keep it open.
    // Once support unlocks the device, the close button reappears instead.
    dismissOnOverlayPress: !isLocked,
    disableDrag: isLocked,
    disableSystemClose: isLocked,
    onBeforeClose: (extra) =>
      extra?.flag === 'programmatic' || !isLockedRef.current,
    floatingPanelProps: { width: 480, overflow: 'hidden' },
    renderContent: (
      <FeaturedChangelogPreviewContext.Provider value={previewData}>
        <FeaturedChangelogContent
          isPreInstall={isPreInstall}
          isLocked={isLocked}
          onLockChange={(nextLocked) => {
            isLockedRef.current = nextLocked;
          }}
          closeDialog={closeDialog}
        />
      </FeaturedChangelogPreviewContext.Provider>
    ),
    onClose: async () => {
      // Preview mode must stay side-effect-free: whatsNewClosed is
      // @LogToServer (a real analytics event), so skipping it keeps ops
      // verification sessions out of the production What's-New metrics. The
      // refetch is likewise skipped for both preview modes so closing the
      // preview never kicks off a live update fetch.
      if (!previewData) {
        defaultLogger.app.appUpdate.whatsNewClosed({
          durationMs: Date.now() - mountTime,
        });
        if (!isPreInstall) {
          setTimeout(() => {
            void backgroundApiProxy.serviceAppUpdate.fetchAppUpdateInfo(true);
          }, 250);
        }
      }
    },
  });
  instanceRef.current = dialogInstance;

  return dialogInstance;
}
