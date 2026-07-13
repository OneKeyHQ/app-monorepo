import {
  createContext,
  useCallback,
  useContext,
  useMemo,
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
  EUpdateStrategy,
  IFeaturedChangelog,
  IFeaturedItem,
} from '@onekeyhq/shared/src/appUpdate';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
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

// Injected payload for the ops-only Featured Changelog preview page. A subset
// of IAppUpdateInfo: `featuredChangelog` drives the carousel in both modes; the
// update fields only feed the pre-install CTA label. When present, the dialog
// renders ENTIRELY from this object (never appUpdatePersistAtom) and every
// production side effect is neutralized — download, store open, DownloadVerify,
// force-lock, and the onClose refetch — EXCEPT the already-upgraded CTA's
// configured jump, which stays live because verifying that target is the whole
// point of the preview.
export interface IFeaturedChangelogPreviewData {
  featuredChangelog: IFeaturedChangelog;
  updateStrategy?: EUpdateStrategy;
  latestVersion?: string;
  jsBundleVersion?: string;
  storeUrl?: string;
  downloadUrl?: string;
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
    parseNotificationPayload(
      activeFeature.mode,
      activeFeature.payload ?? activeFeature.href,
      () => {
        if (isAllowedFeaturedHref(activeFeature.href)) {
          handleDeepLinkUrl({ url: activeFeature.href });
        }
      },
    );
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
  closeDialog,
}: {
  isPreInstall: boolean;
  isLocked: boolean;
  activeFeature: IFeaturedItem | undefined;
  closeDialog: () => Promise<void>;
}) {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const preview = useContext(FeaturedChangelogPreviewContext);
  const [appUpdateInfo] = useAppUpdatePersistAtom();
  const { downloadPackage } = useDownloadPackage();

  // In preview mode source the update fields from the injected payload so the
  // pre-install CTA label reflects the target version's real server data,
  // while never reading the persisted atom.
  const storeUrl = preview ? preview.storeUrl : appUpdateInfo.storeUrl;
  const downloadUrl = preview ? preview.downloadUrl : appUpdateInfo.downloadUrl;
  const jsBundle = preview ? undefined : appUpdateInfo.jsBundle;
  const status = preview ? undefined : appUpdateInfo.status;
  const latestVersion = preview
    ? preview.latestVersion
    : appUpdateInfo.latestVersion;
  const jsBundleVersion = preview
    ? preview.jsBundleVersion
    : appUpdateInfo.jsBundleVersion;

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

  const ctaText = isPreInstall
    ? intl.formatMessage({
        id: shouldOpenStore
          ? ETranslations.update_update_now
          : ETranslations.update_download_and_verify_text,
      })
    : (activeFeature?.ctaText ??
      intl.formatMessage({ id: ETranslations.global_done }));

  const onCtaPress = useCallback(async () => {
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
        openUrlExternal(storeUrl);
        await closeIfUnlocked();
        return;
      }
      if (downloadUrl || jsBundle?.downloadUrl) {
        if (status === EAppUpdateStatus.notify) {
          void downloadPackage();
        }
        await closeDialog();
        setTimeout(() => {
          navigation.pushModal(EModalRoutes.AppUpdateModal, {
            screen: EAppUpdateRoutes.DownloadVerify,
            params: { isForceUpdate: isLocked },
          });
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
  closeDialog,
}: {
  isPreInstall: boolean;
  isLocked: boolean;
  closeDialog: () => Promise<void>;
}) {
  const intl = useIntl();
  const isPreview = useContext(FeaturedChangelogPreviewContext) !== undefined;
  const features = useFeatures();

  const [activeFeature, setActiveFeature] = useState<IFeaturedItem | undefined>(
    features[0],
  );

  const { ctaText, onCtaPress } = useFeaturedCta({
    isPreInstall,
    isLocked,
    activeFeature,
    closeDialog,
  });

  // Drive an explicit pixel height on the dialog content. The dialog frame on
  // desktop (TMDialog.Content) doesn't transition auto-height when child layout
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
        features={features}
        badgeText={badgeText}
        showCloseButton={!isLocked}
        onClose={() => void closeDialog()}
        onActiveFeatureChange={setActiveFeature}
        totalHeight={totalCarouselHeight}
      />
      <FeaturedFooter
        ctaText={ctaText}
        onCtaPress={() => void onCtaPress()}
        showFullChangelog={!isLocked && !isPreview}
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

  const mountTime = Date.now();

  // Mutable ref so the closeDialog closure always sees the live instance.
  const instanceRef: { current: IDialogInstance | undefined } = {
    current: undefined,
  };
  const closeDialog = async () => {
    await instanceRef.current?.close();
  };

  const dialogInstance = Dialog.show({
    showFooter: false,
    showHeader: false,
    dismissOnOverlayPress: !isLocked,
    disableDrag: isLocked,
    disableSystemClose: isLocked,
    floatingPanelProps: { width: 480, overflow: 'hidden' },
    renderContent: (
      <FeaturedChangelogPreviewContext.Provider value={previewData}>
        <FeaturedChangelogContent
          isPreInstall={isPreInstall}
          isLocked={isLocked}
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
