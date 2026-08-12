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
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import { EEarnLabels } from '@onekeyhq/shared/types/staking';

import { EarnPortfolioSettingsTrigger } from '../../components/EarnPortfolioSettings';
import { PortfolioTabContent } from '../../components/PortfolioTabContent';
import { EarnProviderMirror } from '../../EarnProviderMirror';
import { useEarnHideSmallAssets } from '../../hooks/useEarnHideSmallAssets';
import { useEarnPortfolio } from '../../hooks/useEarnPortfolio';
import { useSettledHeaderHeight } from '../../hooks/useSettledHeaderHeight';
import { useStakingPendingTxsByInfo } from '../../hooks/useStakingPendingTxs';

import type { IStakePendingTx } from '../../hooks/useStakingPendingTxs';

function EarnPositionsContent() {
  const intl = useIntl();
  const isFocused = useIsFocused();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useScrollContentTabBarOffset();
  // Owns both the inset and whether it can be trusted yet (OK-59958): on
  // re-entry it returns the height this device already settled on, so the body
  // is never hidden a second time.
  const { paddingTop: bodyPaddingTop, isSettled: isHeaderHeightSettled } =
    useSettledHeaderHeight(headerHeight);
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
