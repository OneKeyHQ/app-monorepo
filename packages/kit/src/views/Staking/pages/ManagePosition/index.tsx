import { useCallback, useEffect, useMemo, useState } from 'react';

import { useNavigation } from '@react-navigation/native';
import { useIntl } from 'react-intl';
import { useSharedValue } from 'react-native-reanimated';

import {
  Page,
  SizableText,
  Skeleton,
  Tabs,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useAppRoute } from '@onekeyhq/kit/src/hooks/useAppRoute';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EModalStakingRoutes } from '@onekeyhq/shared/src/routes';
import type { IModalStakingParamList } from '@onekeyhq/shared/src/routes';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import { type ISupportedSymbol } from '@onekeyhq/shared/types/earn';
import { EStakingActionType } from '@onekeyhq/shared/types/staking';

import { DiscoveryBrowserProviderMirror } from '../../../Discovery/components/DiscoveryBrowserProviderMirror';
import { EarnProviderMirror } from '../../../Earn/EarnProviderMirror';
import { EarnAlert } from '../../components/ProtocolDetails/EarnAlert';

import { HeaderRight } from './components/HeaderRight';
import { StakeSection } from './components/StakeSection';
import { WithdrawSection } from './components/WithdrawSection';
import { useManagePage } from './hooks/useManagePage';

// Skeleton component for loading state
const ManagePositionSkeleton = () => (
  <YStack px="$5" pt="$4" gap="$6">
    {/* Tabs skeleton */}
    <XStack gap="$2">
      <Skeleton w="$20" h="$9" borderRadius="$2" />
      <Skeleton w="$20" h="$9" borderRadius="$2" />
    </XStack>

    {/* Input section skeleton */}
    <YStack gap="$4">
      <YStack gap="$3" p="$4" bg="$bgSubdued" borderRadius="$3">
        <XStack jc="space-between" ai="center">
          <Skeleton.BodyMd w="$20" />
          <Skeleton.BodySm w="$24" />
        </XStack>
        <XStack jc="space-between" ai="center">
          <Skeleton w="$32" h="$12" />
          <XStack gap="$2" ai="center">
            <Skeleton w="$10" h="$10" borderRadius="$full" />
            <Skeleton.BodyLg w="$16" />
          </XStack>
        </XStack>
      </YStack>

      {/* Info cards skeleton */}
      <YStack gap="$3">
        <XStack jc="space-between" ai="center">
          <Skeleton.BodyMd w="$24" />
          <Skeleton.BodyMd w="$20" />
        </XStack>
        <XStack jc="space-between" ai="center">
          <Skeleton.BodyMd w="$28" />
          <Skeleton.BodyMd w="$16" />
        </XStack>
        <XStack jc="space-between" ai="center">
          <Skeleton.BodyMd w="$20" />
          <Skeleton.BodyMd w="$24" />
        </XStack>
      </YStack>

      {/* Button skeleton */}
      <Skeleton w="100%" h="$11" borderRadius="$3" />
    </YStack>
  </YStack>
);

const ManagePositionPage = () => {
  const intl = useIntl();
  const route = useAppRoute<
    IModalStakingParamList,
    EModalStakingRoutes.ManagePosition
  >();
  const { activeAccount } = useActiveAccount({ num: 0 });

  // parse route params, support two types of routes
  const resolvedParams = useMemo<{
    networkId: string;
    symbol: ISupportedSymbol;
    provider: string;
    vault: string | undefined;
    isFromShareLink: boolean;
  }>(() => {
    const routeParams = route.params as any;

    const {
      accountId: routeAccountId,
      indexedAccountId: routeIndexedAccountId,
      networkId,
      symbol,
      provider,
      vault,
    } = routeParams;

    return {
      accountId: routeAccountId || activeAccount.account?.id || '',
      indexedAccountId:
        routeIndexedAccountId || activeAccount.indexedAccount?.id,
      networkId,
      symbol,
      provider,
      vault,
      isFromShareLink: false,
    };
  }, [route.params, activeAccount]);

  const appNavigation = useAppNavigation();
  const navigation = useNavigation();
  const { account, indexedAccount } = activeAccount;
  const { networkId, symbol, provider, vault } = resolvedParams;

  // Get tab from route params
  const defaultTab = route.params?.tab;

  const {
    isLoading,
    tokenInfo,
    earnAccount,
    protocolInfo,
    managePageData,
    depositDisabled,
    withdrawDisabled,
    alerts,
  } = useManagePage({
    accountId: account?.id || '',
    networkId,
    indexedAccountId: indexedAccount?.id,
    symbol,
    provider,
    vault,
  });

  const historyAction = useMemo(() => {
    return managePageData?.history;
  }, [managePageData?.history]);

  const onHistory = useMemo(() => {
    if (historyAction?.disabled || !earnAccount?.accountId) {
      return undefined;
    }
    return (params?: { filterType?: string }) => {
      const { filterType } = params || {};
      appNavigation.navigate(EModalStakingRoutes.HistoryList, {
        accountId: earnAccount?.accountId,
        networkId,
        symbol,
        provider,
        stakeTag: protocolInfo?.stakeTag || '',
        protocolVault: vault,
        filterType,
      });
    };
  }, [
    historyAction?.disabled,
    appNavigation,
    earnAccount?.accountId,
    networkId,
    protocolInfo?.stakeTag,
    provider,
    symbol,
    vault,
  ]);

  // Initialize selectedTabIndex based on defaultTab
  const [selectedTabIndex, setSelectedTabIndex] = useState(() => {
    if (defaultTab === 'withdraw') return 1;
    return 0;
  });

  // Update selectedTabIndex when defaultTab changes from route
  useEffect(() => {
    if (defaultTab === 'withdraw') {
      setSelectedTabIndex(1);
    } else if (defaultTab === 'deposit') {
      setSelectedTabIndex(0);
    }
  }, [defaultTab]);

  const tabData = useMemo(
    () => [
      {
        title: intl.formatMessage({ id: ETranslations.earn_deposit }),
        type: EStakingActionType.Deposit,
      },
      {
        title: intl.formatMessage({ id: ETranslations.global_withdraw }),
        type: EStakingActionType.Withdraw,
      },
    ],
    [intl],
  );

  const TabNames = useMemo(() => {
    return tabData.map((item) => item.title);
  }, [tabData]);

  // Initialize focusedTab based on defaultTab
  const initialTabName = useMemo(() => {
    if (defaultTab === 'withdraw') return TabNames[1];
    return TabNames[0];
  }, [defaultTab, TabNames]);

  const focusedTab = useSharedValue(initialTabName);

  const handleTabChange = useCallback(
    (name: string) => {
      const index = tabData.findIndex((item) => item.title === name);
      if (index !== -1) {
        // Check if clicking Withdraw tab and it's a withdrawOrder type
        if (
          index === 1 &&
          protocolInfo?.withdrawAction?.type ===
            EStakingActionType.WithdrawOrder
        ) {
          // Directly open WithdrawOptions modal instead of switching tab
          appNavigation.push(EModalStakingRoutes.WithdrawOptions, {
            accountId: account?.id || '',
            networkId,
            protocolInfo,
            tokenInfo,
            symbol,
            provider,
          });
          return;
        }

        focusedTab.value = name;
        setSelectedTabIndex(index);

        // Update route params to reflect current tab using setParams for better performance
        const newTab = index === 0 ? 'deposit' : 'withdraw';
        navigation.setParams({
          tab: newTab,
        } as any);
      }
    },
    [
      focusedTab,
      tabData,
      navigation,
      protocolInfo,
      appNavigation,
      account,
      networkId,
      tokenInfo,
      symbol,
      provider,
    ],
  );

  return (
    <Page scrollEnabled>
      <Page.Header title={symbol} />
      <Page.Body>
        {!tokenInfo || isLoading ? (
          <ManagePositionSkeleton />
        ) : (
          <>
            <XStack jc="space-between" px="$5">
              <Tabs.TabBar
                divider={false}
                onTabPress={handleTabChange}
                tabNames={TabNames}
                focusedTab={focusedTab}
                renderItem={({ name, isFocused }) => (
                  <XStack
                    px="$2"
                    py="$1.5"
                    mr="$1"
                    bg={isFocused ? '$bgActive' : '$bg'}
                    borderRadius="$2"
                    borderCurve="continuous"
                    onPress={() => handleTabChange(name)}
                  >
                    <SizableText
                      size="$bodyMdMedium"
                      color={isFocused ? '$text' : '$textSubdued'}
                      letterSpacing={-0.15}
                    >
                      {name}
                    </SizableText>
                  </XStack>
                )}
              />
              <HeaderRight
                historyAction={historyAction}
                onHistory={onHistory}
              />
            </XStack>
            {selectedTabIndex === 0 ? (
              <StakeSection
                accountId={earnAccount?.account?.id || ''}
                networkId={networkId}
                tokenInfo={tokenInfo}
                protocolInfo={protocolInfo}
                isDisabled={depositDisabled}
              />
            ) : null}
            {selectedTabIndex === 1 ? (
              <WithdrawSection
                accountId={earnAccount?.account?.id || ''}
                networkId={networkId}
                tokenInfo={tokenInfo}
                protocolInfo={protocolInfo}
                isDisabled={withdrawDisabled}
              />
            ) : null}
            <YStack px="$5">
              <EarnAlert alerts={alerts} />
            </YStack>
          </>
        )}
      </Page.Body>
    </Page>
  );
};

function ManagePositionPageWithProvider() {
  return (
    <AccountSelectorProviderMirror
      config={{
        sceneName: EAccountSelectorSceneName.home,
        sceneUrl: '',
      }}
      enabledNum={[0]}
    >
      <EarnProviderMirror storeName={EJotaiContextStoreNames.earn}>
        <DiscoveryBrowserProviderMirror>
          <ManagePositionPage />
        </DiscoveryBrowserProviderMirror>
      </EarnProviderMirror>
    </AccountSelectorProviderMirror>
  );
}

export default ManagePositionPageWithProvider;
