import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  RefreshControl,
  Stack,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type {
  ETabEarnRoutes,
  ITabEarnParamList,
} from '@onekeyhq/shared/src/routes';
import { ETabDiscoveryRoutes, ETabRoutes } from '@onekeyhq/shared/src/routes';
import {
  openUrlExternal,
  openUrlInApp,
} from '@onekeyhq/shared/src/utils/openUrlUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import type { IDiscoveryBanner } from '@onekeyhq/shared/types/discovery';
import { EAvailableAssetsTypeEnum } from '@onekeyhq/shared/types/earn';
import { EEarnLabels } from '@onekeyhq/shared/types/staking';

import { AccountSelectorProviderMirror } from '../../components/AccountSelector';
import { TabPageHeader } from '../../components/TabPageHeader';
import useAppNavigation from '../../hooks/useAppNavigation';
import { useAppRoute } from '../../hooks/useAppRoute';
import useListenTabFocusState from '../../hooks/useListenTabFocusState';
import {
  useAccountSelectorActions,
  useActiveAccount,
} from '../../states/jotai/contexts/accountSelector';
import { useEarnActions } from '../../states/jotai/contexts/earn';

import { BannerV2 } from './components/BannerV2';
import { EarnBlockedOverview } from './components/EarnBlockedOverview';
import { EarnMainTabs } from './components/EarnMainTabs';
import { EarnPageContainer } from './components/EarnPageContainer';
import { Overview } from './components/Overview';
import { EarnProviderMirror } from './EarnProviderMirror';
import { EarnNavigation } from './earnUtils';
import { useBannerInfo } from './hooks/useBannerInfo';
import { useBlockRegion } from './hooks/useBlockRegion';
import { useEarnPortfolio } from './hooks/useEarnPortfolio';
import { useFAQListInfo } from './hooks/useFAQListInfo';
import { useStakingPendingTxsByInfo } from './hooks/useStakingPendingTxs';

import type { IStakePendingTx } from './hooks/useStakingPendingTxs';

function BasicEarnHome({
  showHeader,
  showContent,
  overrideDefaultTab,
}: {
  showHeader?: boolean;
  showContent?: boolean;
  overrideDefaultTab?: 'assets' | 'portfolio' | 'faqs';
}) {
  const route = useAppRoute<ITabEarnParamList, ETabEarnRoutes.EarnHome>();
  const { activeAccount } = useActiveAccount({ num: 0 });
  const { account, indexedAccount } = activeAccount;
  const actions = useEarnActions();

  const { isFetchingBlockResult, refreshBlockResult, blockResult } =
    useBlockRegion();

  const { earnBanners } = useBannerInfo();
  const { faqList, isFaqLoading, refetchFAQ } = useFAQListInfo();
  const [isEarnTabFocused, setIsEarnTabFocused] = useState(true);
  const wasFocusedRef = useRef(false);
  const portfolioData = useEarnPortfolio({ isActive: isEarnTabFocused });
  const { refresh: refreshEarnDataRaw, isLoading: portfolioLoading } =
    portfolioData;

  const isLoading = useMemo(() => {
    if (platformEnv.isNative && !showContent) {
      return false;
    }
    return portfolioLoading;
  }, [portfolioLoading, showContent]);

  const pendingTxsFilter = useCallback((tx: IStakePendingTx) => {
    return [EEarnLabels.Stake, EEarnLabels.Withdraw].includes(
      tx.stakingInfo.label,
    );
  }, []);
  const { filteredTxs } = useStakingPendingTxsByInfo({
    filter: pendingTxsFilter,
  });
  const isPending = useMemo(() => {
    return filteredTxs.length > 0;
  }, [filteredTxs]);
  const previousIsPendingRef = useRef(isPending);

  useEffect(() => {
    if (previousIsPendingRef.current && !isPending) {
      void refreshEarnDataRaw();
    }
    previousIsPendingRef.current = isPending;
  }, [isPending, refreshEarnDataRaw]);

  const refreshEarnData = useCallback(async () => {
    await backgroundApiProxy.serviceStaking.clearAvailableAssetsCache();
    actions.current.triggerRefresh();
    await refreshEarnDataRaw();
  }, [actions, refreshEarnDataRaw]);

  const navigation = useAppNavigation();

  const defaultTab = overrideDefaultTab || route.params?.tab;

  const accountSelectorActions = useAccountSelectorActions();

  const handleListenTabFocusState = useCallback(
    (isFocus: boolean, isHideByModal: boolean) => {
      const actualFocus = isFocus && !isHideByModal;
      wasFocusedRef.current = actualFocus;
      setIsEarnTabFocused(actualFocus);
      if (!actualFocus) return;

      const allKey = `availableAssets-${EAvailableAssetsTypeEnum.All}`;
      const stableKey = `availableAssets-${EAvailableAssetsTypeEnum.StableCoins}`;
      const nativeKey = `availableAssets-${EAvailableAssetsTypeEnum.NativeTokens}`;

      const keys = [allKey, stableKey, nativeKey];

      const hasIncompleteData = keys.some((key) =>
        actions.current.isDataIncomplete(key),
      );

      if (hasIncompleteData) {
        keys.forEach((key) => {
          actions.current.setLoadingState(key, false);
        });
        actions.current.triggerRefresh();
      }

      void refetchFAQ();
    },
    [actions, refetchFAQ],
  );

  useListenTabFocusState(
    [ETabRoutes.Earn, ETabRoutes.Discovery],
    handleListenTabFocusState,
  );

  const onBannerPress = useCallback(
    async ({ hrefType, href }: IDiscoveryBanner) => {
      if (account || indexedAccount) {
        if (href.includes('/defi/staking')) {
          const [path, query] = href.split('?');
          const paths = path.split('/');
          const provider = paths.pop();
          const symbol = paths.pop();
          const params = new URLSearchParams(query);
          const networkId = params.get('networkId');
          const vault = params.get('vault');
          if (provider && symbol && networkId) {
            const navigationParams: {
              networkId: string;
              symbol: string;
              provider: string;
              vault?: string;
            } = {
              provider,
              symbol,
              networkId,
            };
            if (vault) {
              navigationParams.vault = vault;
            }
            void EarnNavigation.pushDetailPageFromDeeplink(
              navigation,
              navigationParams,
            );
          }
          return;
        }
        if (hrefType === 'external') {
          openUrlExternal(href);
        } else {
          openUrlInApp(href);
        }
      } else {
        await accountSelectorActions.current.showAccountSelector({
          navigation,
          activeWallet: undefined,
          num: 0,
          sceneName: EAccountSelectorSceneName.home,
        });
      }
    },
    [account, accountSelectorActions, indexedAccount, navigation],
  );

  const banners = useMemo(
    () => (
      <BannerV2
        data={earnBanners}
        onBannerPress={onBannerPress}
        isActive={isEarnTabFocused}
      />
    ),
    [earnBanners, onBannerPress, isEarnTabFocused],
  );

  const mobileContainerProps = useMemo(
    () => ({
      contentContainerStyle: {
        display: showContent ? undefined : 'none',
      },
      allowHeaderOverscroll: true,
      renderHeader: () => (
        <YStack gap="$4" pt="$6" bg="$bgApp" pointerEvents="box-none">
          <YStack gap="$7.5">
            <YStack px="$5">
              <Overview onRefresh={refreshEarnData} isLoading={isLoading} />
            </YStack>
            {banners ? <YStack width="100%">{banners}</YStack> : null}
          </YStack>
        </YStack>
      ),
    }),
    [showContent, refreshEarnData, isLoading, banners],
  );

  // const [tabPageHeight, setTabPageHeight] = useState(
  //   platformEnv.isNativeIOS ? 143 : 92,
  // );
  // const handleTabPageLayout = useCallback((e: LayoutChangeEvent) => {
  //   const height = e.nativeEvent.layout.height - 20;
  //   setTabPageHeight(height);
  // }, []);

  if (!isFetchingBlockResult && blockResult?.blockData) {
    return (
      <EarnBlockedOverview
        showHeader={showHeader}
        showContent={showContent}
        refresh={refreshBlockResult}
        refreshing={!!isFetchingBlockResult}
        icon={blockResult.blockData.icon.icon}
        title={blockResult.blockData.title.text}
        description={blockResult.blockData.description.text}
      />
    );
  }

  if (platformEnv.isNative) {
    return (
      <YStack flex={1}>
        <EarnMainTabs
          faqList={faqList || []}
          isFaqLoading={isFaqLoading}
          defaultTab={defaultTab}
          portfolioData={portfolioData}
          containerProps={mobileContainerProps}
        />
      </YStack>
    );
  }

  return (
    <EarnPageContainer
      sceneName={EAccountSelectorSceneName.home}
      tabRoute={ETabRoutes.Earn}
      disableMaxWidth
      refreshControl={
        <RefreshControl refreshing={isLoading} onRefresh={refreshEarnData} />
      }
    >
      <YStack flex={1}>
        <YStack>
          <XStack px="$5">
            <Overview onRefresh={refreshEarnData} isLoading={isLoading} />
          </XStack>
          {banners ? (
            <YStack borderRadius="$3" width="100%" borderCurve="continuous">
              {banners}
            </YStack>
          ) : null}
        </YStack>
        <EarnMainTabs
          faqList={faqList || []}
          isFaqLoading={isFaqLoading}
          defaultTab={defaultTab}
          portfolioData={portfolioData}
        />
      </YStack>
    </EarnPageContainer>
  );
}

export function EarnHomeWithProvider({
  showHeader = true,
  showContent = true,
  defaultTab,
}: {
  showHeader?: boolean;
  showContent?: boolean;
  defaultTab?: 'assets' | 'portfolio' | 'faqs';
}) {
  return (
    <AccountSelectorProviderMirror
      config={{
        sceneName: EAccountSelectorSceneName.home,
        sceneUrl: '',
      }}
      enabledNum={[0]}
    >
      <EarnProviderMirror storeName={EJotaiContextStoreNames.earn}>
        <BasicEarnHome
          showHeader={showHeader}
          showContent={showContent}
          overrideDefaultTab={defaultTab}
        />
      </EarnProviderMirror>
    </AccountSelectorProviderMirror>
  );
}

const useNavigateToNativeEarnPage = platformEnv.isNative
  ? () => {
      const navigation = useAppNavigation();
      const route = useAppRoute<ITabEarnParamList, ETabEarnRoutes.EarnHome>();
      const tabParam = route.params?.tab;

      useLayoutEffect(() => {
        navigation.navigate(
          ETabRoutes.Discovery,
          {
            screen: ETabDiscoveryRoutes.TabDiscovery,
            params: {
              defaultTab: ETranslations.global_earn,
              earnTab: tabParam,
            },
          },
          {
            pop: true,
          },
        );
      }, [navigation, tabParam]);
    }
  : () => {};

export default function EarnHome() {
  useNavigateToNativeEarnPage();
  return platformEnv.isNative ? null : <EarnHomeWithProvider />;
}
