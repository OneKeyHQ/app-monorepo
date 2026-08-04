import { useCallback, useEffect, useMemo, useRef } from 'react';

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

function EarnPositionsContent() {
  const intl = useIntl();
  const isFocused = useIsFocused();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useScrollContentTabBarOffset();
  const bodyPaddingTop = platformEnv.isNativeIOS26Plus ? headerHeight : 0;
  const portfolioData = useEarnPortfolio({ isActive: isFocused });
  const { hideSmallAssets, setHideSmallAssets } = useEarnHideSmallAssets();
  const { refresh, isLoading } = portfolioData;

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

  const handleRefresh = useCallback(() => refresh(), [refresh]);
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
      <Page.Body pt={bodyPaddingTop}>
        <ScrollView
          flex={1}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            flexGrow: 1,
            paddingBottom: tabBarHeight,
          }}
          refreshControl={
            <RefreshControl
              refreshing={Boolean(isLoading)}
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
