import { useMemo } from 'react';

import { Page, Skeleton, XStack, YStack } from '@onekeyhq/components';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { useAppRoute } from '@onekeyhq/kit/src/hooks/useAppRoute';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type {
  EModalStakingRoutes,
  IModalStakingParamList,
} from '@onekeyhq/shared/src/routes';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import { type ISupportedSymbol } from '@onekeyhq/shared/types/earn';

import { DiscoveryBrowserProviderMirror } from '../../../Discovery/components/DiscoveryBrowserProviderMirror';
import { EarnProviderMirror } from '../../../Earn/EarnProviderMirror';

import { ManagePositionContent } from './components/ManagePositionContent';
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
  const route = useAppRoute<
    IModalStakingParamList,
    EModalStakingRoutes.ManagePosition
  >();
  const { activeAccount } = useActiveAccount({ num: 0 });

  // parse route params, support two types of routes
  const resolvedParams = useMemo<{
    accountId: string;
    indexedAccountId: string | undefined;
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

  const { account, indexedAccount } = activeAccount;
  const { accountId, indexedAccountId, networkId, symbol, provider, vault } =
    resolvedParams;

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

  return (
    <Page scrollEnabled>
      <Page.Header title={symbol} />
      <Page.Body>
        {!tokenInfo || isLoading ? (
          <ManagePositionSkeleton />
        ) : (
          <ManagePositionContent
            networkId={networkId}
            symbol={symbol}
            provider={provider}
            vault={vault}
            account={account}
            indexedAccount={indexedAccount}
            earnAccount={earnAccount}
            tokenInfo={tokenInfo}
            protocolInfo={protocolInfo}
            managePageData={managePageData}
            depositDisabled={depositDisabled}
            withdrawDisabled={withdrawDisabled}
            alerts={alerts}
            isLoading={isLoading}
            defaultTab={defaultTab}
          />
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
