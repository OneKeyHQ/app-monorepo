import { useCallback, useEffect, useRef, useState } from 'react';

import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import { useIntl } from 'react-intl';
import { initialWindowMetrics } from 'react-native-safe-area-context';

import {
  ESplitViewType,
  Page,
  SizableText,
  Stack,
  YStack,
  useIsSplitView,
  useMedia,
  useSafeAreaInsets,
  useSplitViewType,
} from '@onekeyhq/components';
import { HeaderIconButton } from '@onekeyhq/components/src/layouts/Navigation/Header';
import { TabletHomeContainer } from '@onekeyhq/kit/src/components/TabletHomeContainer';
import { usePerpsActivePositionAtom } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import {
  useAccountIsAutoCreatingAtom,
  useIndexedAccountAddressCreationStateAtom,
  usePerpsAbstractionModeAtom,
  usePerpsAccountLoadingInfoAtom,
  usePerpsActiveAccountAtom,
  usePerpsActiveAccountStatusAtom,
  usePerpsComputedAccountValueAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { DOWNLOAD_MOBILE_APP_URL } from '@onekeyhq/shared/src/config/appConfig';
import { FLOAT_NAV_BAR_Z_INDEX } from '@onekeyhq/shared/src/consts/zIndexConsts';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { consumePerpPageEnterSource } from '@onekeyhq/shared/src/logger/scopes/perp/perpPageSource';
import type { EPerpPageEnterSource } from '@onekeyhq/shared/src/logger/scopes/perp/type';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ETabRoutes } from '@onekeyhq/shared/src/routes/tab';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { LazyLoadPage } from '../../../components/LazyLoadPage';
import { LazyPageContainer } from '../../../components/LazyPageContainer';
import { TabPageHeader } from '../../../components/TabPageHeader';
import { useNativePerpFeatureGuard } from '../../../hooks/usePerpFeatureGuard';
import { PerpContentFooter } from '../components/PerpContentFooter';
import { PerpsActivityCenterAction } from '../components/PerpsActivityCenterAction';
import { PerpSettingsButton } from '../components/PerpSettingsButton';
import { PerpsGlobalEffects } from '../components/PerpsGlobalEffects';
import { PerpsHeaderRight } from '../components/TradingPanel/components/PerpsHeaderRight';
import { PerpDesktopLayout } from '../layouts/PerpDesktopLayout';
import { PerpMobileLayout } from '../layouts/PerpMobileLayout';
import { PerpsAccountSelectorProviderMirror } from '../PerpsAccountSelectorProviderMirror';
import { PerpsProviderMirror } from '../PerpsProviderMirror';
import { PerpTestIDs } from '../testIDs';
import {
  type IPerpsMobileLayoutTraceRect,
  getPerpsMobileLayoutTraceRect,
  isPerpsMobileLayoutTraceRectChanged,
  tracePerpsMobileLayout,
} from '../utils/mobileLayoutTrace';
import { buildPerpAccountStatusAnalyticsParams } from '../utils/perpAccountStatusAnalytics';
import { preloadPerpsDepositSelectTokenModal } from '../utils/preloadPerpsDepositSelectTokenModal';
import { preloadPerpsDepositWithdrawModal } from '../utils/preloadPerpsDepositWithdrawModal';
import {
  loadPerpsMobileMarketPage,
  preloadPerpsMobileMarketPage,
} from '../utils/preloadPerpsMobileMarketPage';
import { preloadPerpsMobileTokenSelectorPage } from '../utils/preloadPerpsTokenSelector';

import { ExtPerp, shouldOpenExpandExtPerp } from './ExtPerp';

import type { LayoutChangeEvent } from 'react-native';

// MobilePerpMarket is already an async-loaded route via router/index.ts
// (its own segment). Importing it sync from here would pull that segment's
// shared sub-components (PerpCandles / PerpOrderBook / PerpTokenSelectorRow)
// across the seg:Perp ↔ seg:MobilePerpMarket boundary and break the
// split-bundle integrity check. Lazy-load here too so the edge stays async.
const MobilePerpMarketInline = LazyLoadPage(loadPerpsMobileMarketPage);
const PERP_NATIVE_HEADER_ROW_HEIGHT = 44;
const PERP_NATIVE_HEADER_TOP_OFFSET = 20;
const PERP_NATIVE_IOS_HEADER_TOP_PADDING = 26;

function PerpLayout() {
  const { gtMd } = useMedia();
  if (gtMd && !platformEnv.isNative) {
    return <PerpDesktopLayout />;
  }
  return <PerpMobileLayout />;
}

function PerpBodyContent() {
  return (
    <Stack position="relative" flex={1}>
      <PerpLayout />
      <PerpContentFooter />
    </Stack>
  );
}

function PerpAnalyticsTracker() {
  const isFocused = useIsFocused();
  const [activePerpsAccount] = usePerpsActiveAccountAtom();
  const [accountIsAutoCreating] = useAccountIsAutoCreatingAtom();
  const [indexedAccountAddressCreationState] =
    useIndexedAccountAddressCreationStateAtom();
  const [perpsAccountStatus] = usePerpsActiveAccountStatusAtom();
  const [accountLoadingInfo] = usePerpsAccountLoadingInfoAtom();
  const [computedAccountValue] = usePerpsComputedAccountValueAtom();
  const [positionsState] = usePerpsActivePositionAtom();
  const [abstractionMode] = usePerpsAbstractionModeAtom();
  const walletTypeRef = useRef(activePerpsAccount.walletType);
  walletTypeRef.current = activePerpsAccount.walletType;
  const firedRef = useRef(false);
  const trackedAccountSnapshotsRef = useRef(new Set<string>());
  const [pageSession, setPageSession] = useState<{
    source: EPerpPageEnterSource;
  }>();

  useFocusEffect(
    useCallback(() => {
      if (!firedRef.current) {
        firedRef.current = true;
        trackedAccountSnapshotsRef.current.clear();
        const source = consumePerpPageEnterSource();
        setPageSession({ source });
        defaultLogger.perp.common.perpPageView({
          source,
          walletType: walletTypeRef.current ?? 'unknown',
        });
      }
      return () => {
        firedRef.current = false;
      };
    }, []),
  );

  useEffect(() => {
    if (!isFocused || !pageSession) {
      return;
    }
    if (
      !activePerpsAccount.accountAddress &&
      !activePerpsAccount.indexedAccountId &&
      !activePerpsAccount.accountId
    ) {
      return;
    }
    const params = buildPerpAccountStatusAnalyticsParams({
      source: pageSession.source,
      walletType: activePerpsAccount.walletType ?? 'unknown',
      accountStatus: perpsAccountStatus,
      selectAccountLoading: accountLoadingInfo.selectAccountLoading,
      accountCreationPending: Boolean(
        activePerpsAccount.indexedAccountId &&
        (accountIsAutoCreating?.indexedAccountId ===
          activePerpsAccount.indexedAccountId ||
          indexedAccountAddressCreationState?.indexedAccountId ===
            activePerpsAccount.indexedAccountId),
      ),
      computedAccountValue,
      positionsState,
      abstractionMode,
    });
    if (!params) {
      return;
    }
    const accountKey =
      activePerpsAccount.indexedAccountId ??
      activePerpsAccount.accountId ??
      activePerpsAccount.accountAddress?.toLowerCase() ??
      params.snapshotStatus;
    if (trackedAccountSnapshotsRef.current.has(accountKey)) {
      return;
    }
    trackedAccountSnapshotsRef.current.add(accountKey);
    defaultLogger.perp.common.perpAccountStatus(params);
  }, [
    abstractionMode,
    activePerpsAccount.accountAddress,
    activePerpsAccount.accountId,
    activePerpsAccount.indexedAccountId,
    activePerpsAccount.walletType,
    accountIsAutoCreating?.indexedAccountId,
    accountLoadingInfo.selectAccountLoading,
    computedAccountValue,
    isFocused,
    indexedAccountAddressCreationState?.indexedAccountId,
    pageSession,
    perpsAccountStatus,
    positionsState,
  ]);

  return null;
}

function PerpContent() {
  const { gtMd } = useMedia();
  const { top: safeAreaTop } = useSafeAreaInsets();
  const resolvedSafeAreaTop =
    safeAreaTop || initialWindowMetrics?.insets.top || 0;
  const headerLayoutRef = useRef<IPerpsMobileLayoutTraceRect | undefined>(
    undefined,
  );

  useEffect(() => {
    if (platformEnv.isNative) {
      void preloadPerpsMobileMarketPage();
      void preloadPerpsMobileTokenSelectorPage();
      void preloadPerpsDepositWithdrawModal();
      void preloadPerpsDepositSelectTokenModal();
    }
  }, []);

  const fallbackTabPageHeight = platformEnv.isNative
    ? resolvedSafeAreaTop +
      PERP_NATIVE_HEADER_ROW_HEIGHT +
      (platformEnv.isNativeIOS
        ? PERP_NATIVE_IOS_HEADER_TOP_PADDING - PERP_NATIVE_HEADER_TOP_OFFSET
        : 0)
    : 92;
  const [measuredTabPageHeight, setMeasuredTabPageHeight] = useState<
    number | undefined
  >();
  const tabPageHeight = measuredTabPageHeight ?? fallbackTabPageHeight;
  const handleTabPageLayout = useCallback((e: LayoutChangeEvent) => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const height = e.nativeEvent.layout.height - PERP_NATIVE_HEADER_TOP_OFFSET;
    setMeasuredTabPageHeight((prev) =>
      prev === undefined || Math.abs(prev - height) > 0.5 ? height : prev,
    );
    const rect = getPerpsMobileLayoutTraceRect(e);
    if (isPerpsMobileLayoutTraceRectChanged(headerLayoutRef.current, rect)) {
      tracePerpsMobileLayout('nativeHeader.layout', {
        rect,
        reservedHeight: height,
        platform: platformEnv.isNativeIOS ? 'ios' : 'native',
      });
      headerLayoutRef.current = rect;
    }
  }, []);
  const intl = useIntl();
  const handleDownloadApp = useCallback(() => {
    openUrlExternal(DOWNLOAD_MOBILE_APP_URL);
  }, []);

  const header = (
    <TabPageHeader
      sceneName={EAccountSelectorSceneName.home}
      tabRoute={ETabRoutes.Perp}
      headerPx="$4"
      customHeaderLeftItems={
        platformEnv.isWebDappMode ? undefined : (
          <SizableText size="$headingXl">
            {intl.formatMessage({ id: ETranslations.global_perp })}
          </SizableText>
        )
      }
      customHeaderRightItems={
        <PerpsAccountSelectorProviderMirror perfDebugName="perp-header">
          <PerpsProviderMirror>
            <PerpsHeaderRight />
          </PerpsProviderMirror>
        </PerpsAccountSelectorProviderMirror>
      }
      customToolbarItems={
        <>
          {!gtMd && !platformEnv.isNative ? (
            <PerpsActivityCenterAction size="small" copyAsUrl />
          ) : null}
          <PerpSettingsButton
            testID={PerpTestIDs.HeaderSettingsButton}
            showActivityCenterEntry={
              platformEnv.isNative || (gtMd && !platformEnv.isWebDappMode)
            }
            showGuideEntry
          />
          <HeaderIconButton
            icon="DownloadOutline"
            size="small"
            title={intl.formatMessage({
              id: ETranslations.global_download_app,
            })}
            onPress={handleDownloadApp}
          />
        </>
      }
    />
  );

  return (
    <Page>
      {platformEnv.isNative ? (
        <>
          <Stack h={tabPageHeight} />
          <YStack
            position="absolute"
            top={-PERP_NATIVE_HEADER_TOP_OFFSET}
            left={0}
            bg="$bgApp"
            // iOS: shift the floating header down 6px so its content centers at
            // safe-area top+28, matching the Wallet header. The MDHeader non-home
            // row is h=44 → center top+22 with the -20/pt($5) cancel; pt=26
            // (=20 offset + 6) lands it at top+28. Other platforms keep $5.
            pt={
              platformEnv.isNativeIOS
                ? PERP_NATIVE_IOS_HEADER_TOP_PADDING
                : '$5'
            }
            width="100%"
            onLayout={handleTabPageLayout}
            zIndex={FLOAT_NAV_BAR_Z_INDEX}
          >
            {header}
          </YStack>
        </>
      ) : (
        header
      )}
      <Page.Body>
        <LazyPageContainer>
          <PerpBodyContent />
        </LazyPageContainer>
      </Page.Body>
    </Page>
  );
}

function PerpView() {
  return shouldOpenExpandExtPerp ? (
    <ExtPerp />
  ) : (
    <>
      <PerpsGlobalEffects />
      <PerpAnalyticsTracker />
      <PerpContent />
    </>
  );
}

function ExtPerpNull() {
  const isFocused = useIsFocused();
  return isFocused ? <ExtPerp /> : null;
}

export default function Perp() {
  const canRenderPerp = useNativePerpFeatureGuard();
  const splitViewType = useSplitViewType();
  const isLandscape = useIsSplitView();
  const isFocused = useIsFocused();

  if (!canRenderPerp) {
    return shouldOpenExpandExtPerp ? <ExtPerpNull /> : null;
  }

  // In the dual-pane layout the right (SUB) pane would otherwise render the
  // generic OneKey-logo placeholder from TabletHomeContainer. Fill it with
  // the chart detail directly so the trading form on the left always sits
  // beside the active pair's K-line — no navigation, no modal.
  //
  // SUB router uses `lazy: false`, so every tab root pre-mounts. Without the
  // `isFocused` guard MobilePerpMarketWithProvider would boot TradingView, set
  // up the perps mirror store, and emit `HideTabBar=true` in the background
  // whenever the user has another tab focused on the SUB pane. Only render
  // the chart when this tab is actually the active SUB tab.
  if (splitViewType === ESplitViewType.SUB && isLandscape) {
    return isFocused ? <MobilePerpMarketInline /> : null;
  }

  return (
    <TabletHomeContainer>
      <PerpsAccountSelectorProviderMirror perfDebugName="perp-route">
        <PerpsProviderMirror>
          <PerpView />
        </PerpsProviderMirror>
      </PerpsAccountSelectorProviderMirror>
    </TabletHomeContainer>
  );
}
