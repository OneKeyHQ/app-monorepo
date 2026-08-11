import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useHeaderHeight } from '@react-navigation/elements';
import { useIsFocused } from '@react-navigation/native';
import { useIntl } from 'react-intl';

import {
  Page,
  RefreshControl,
  ScrollView,
  YStack,
  useScrollContentTabBarOffset,
} from '@onekeyhq/components';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import { EEarnLabels } from '@onekeyhq/shared/types/staking';

import { EarnPortfolioSettingsTrigger } from '../../components/EarnPortfolioSettings';
import { PortfolioTabContent } from '../../components/PortfolioTabContent';
import { EarnProviderMirror } from '../../EarnProviderMirror';
import { useEarnHideSmallAssets } from '../../hooks/useEarnHideSmallAssets';
import { useEarnPortfolio } from '../../hooks/useEarnPortfolio';
import { useStakingPendingTxsByInfo } from '../../hooks/useStakingPendingTxs';

import type { IStakePendingTx } from '../../hooks/useStakingPendingTxs';

// OK-59958: useHeaderHeight() reports react-navigation's synchronous estimate
// for the first renders (97.67 on a Dynamic Island device) and the natively
// measured height (113) only once the header lays out. bodyPaddingTop follows
// it, so painting straight away dropped the whole body by that 15.33pt
// difference a beat after entering the page.
//
// A frame-count gate is not enough — the measured value can arrive several
// renders in — so hold until the value stops changing. The window is a settle
// timeout, not a layout metric: it re-arms on every change and only releases
// once the height has been quiet for it.
const HEADER_HEIGHT_SETTLE_MS = 64;

function EarnPositionsContent() {
  const intl = useIntl();
  const isFocused = useIsFocused();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useScrollContentTabBarOffset();
  const bodyPaddingTop = platformEnv.isNativeIOS26Plus ? headerHeight : 0;
  // Only iOS 26 has a settling header height; everywhere else the padding is a
  // constant 0 and there is nothing to wait for.
  const [isHeaderHeightSettled, setIsHeaderHeightSettled] = useState(
    !platformEnv.isNativeIOS26Plus,
  );
  useEffect(() => {
    if (!platformEnv.isNativeIOS26Plus) {
      return undefined;
    }
    const timer = setTimeout(
      () => setIsHeaderHeightSettled(true),
      HEADER_HEIGHT_SETTLE_MS,
    );
    return () => clearTimeout(timer);
  }, [headerHeight]);
  const portfolioData = useEarnPortfolio({ isActive: isFocused });
  const { hideSmallAssets, setHideSmallAssets } = useEarnHideSmallAssets();
  const { refresh } = portfolioData;

  const pendingTxsFilter = useCallback((tx: IStakePendingTx) => {
    return [EEarnLabels.Stake, EEarnLabels.Withdraw, EEarnLabels.Sell].includes(
      tx.stakingInfo.label,
    );
  }, []);
  const { filteredTxs } = useStakingPendingTxsByInfo({
    filter: pendingTxsFilter,
  });
  const isPending = useMemo(() => filteredTxs.length > 0, [filteredTxs]);
  const previousIsPendingRef = useRef(isPending);

  useEffect(() => {
    if (previousIsPendingRef.current && !isPending) {
      void refresh();
    }
    previousIsPendingRef.current = isPending;
  }, [isPending, refresh]);

  // OK-59958: RefreshControl.refreshing must track user-initiated pulls only.
  // It used to be wired to useEarnPortfolio's general isLoading, which also
  // goes true on mount, on focus revalidation, when a pending tx settles, and
  // on account change (useEarnPortfolio sets it in the hasAccountChanged
  // branch). Starting UIRefreshControl programmatically grows the scroll
  // view's content inset, and that inset was not restored when the flag
  // cleared — the spinner vanished but the content stayed pushed down.
  // EarnHome already separates these two concerns; this page did not.
  // Content loading states stay with portfolioData — PortfolioTabContent
  // renders its own skeleton from the same isLoading.
  const [isManualRefreshing, setIsManualRefreshing] = useState(false);
  const handleRefresh = useCallback(async () => {
    setIsManualRefreshing(true);
    try {
      await refresh();
    } finally {
      setIsManualRefreshing(false);
    }
  }, [refresh]);
  const setHideSmallAssetsRef = useRef(setHideSmallAssets);
  setHideSmallAssetsRef.current = setHideSmallAssets;
  const handleHideSmallAssetsChange = useCallback((nextValue: boolean) => {
    setHideSmallAssetsRef.current(nextValue);
  }, []);
  const renderHeaderRight = useCallback(
    () => (
      <EarnPortfolioSettingsTrigger
        hideSmallAssets={hideSmallAssets}
        onHideSmallAssetsChange={handleHideSmallAssetsChange}
      />
    ),
    [handleHideSmallAssetsChange, hideSmallAssets],
  );

  return (
    <Page>
      <Page.Header
        title={intl.formatMessage({ id: ETranslations.earn_positions })}
        headerRight={renderHeaderRight}
      />
      {/* Hidden rather than unmounted so the ScrollView and its RefreshControl
          are set up once and never rebuilt (OK-59958) */}
      <Page.Body pt={bodyPaddingTop} opacity={isHeaderHeightSettled ? 1 : 0}>
        <ScrollView
          flex={1}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            flexGrow: 1,
            paddingBottom: tabBarHeight,
          }}
          refreshControl={
            <RefreshControl
              refreshing={isManualRefreshing}
              onRefresh={handleRefresh}
            />
          }
        >
          <YStack py="$6">
            <PortfolioTabContent
              portfolioData={portfolioData}
              hideSmallAssets={hideSmallAssets}
            />
          </YStack>
        </ScrollView>
      </Page.Body>
    </Page>
  );
}

export default function EarnPositions() {
  return (
    <AccountSelectorProviderMirror
      config={{
        sceneName: EAccountSelectorSceneName.home,
        sceneUrl: '',
      }}
      enabledNum={[0]}
    >
      <EarnProviderMirror storeName={EJotaiContextStoreNames.earn}>
        <EarnPositionsContent />
      </EarnProviderMirror>
    </AccountSelectorProviderMirror>
  );
}
