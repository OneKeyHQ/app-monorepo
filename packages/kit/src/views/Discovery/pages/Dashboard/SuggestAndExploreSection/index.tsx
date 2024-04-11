import { useCallback, useState } from 'react';

import { isNil } from 'lodash';

import { Skeleton, Stack, useMedia } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import type { IServerNetwork } from '@onekeyhq/shared/types';
import type { ICategory, IDApp } from '@onekeyhq/shared/types/discovery';

import { DashboardSectionHeader } from '../DashboardSectionHeader';

import { ChunkedItemsSkeletonView } from './ChunkedItemsSkeletonView';
import { chunkArray } from './ChunkedItemsView';
import { ExploreView } from './ExploreView';
import { SuggestedView } from './SuggestedView';

import type { IMatchDAppItemType } from '../../../types';

export function SuggestedAndExploreSection({
  suggestedData,
  handleOpenWebSite,
  isLoading,
}: {
  suggestedData: ICategory[];
  handleOpenWebSite: ({ dApp, webSite }: IMatchDAppItemType) => void;
  isLoading: boolean | undefined;
}) {
  const [isExploreView, setIsExploreView] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedNetwork, setSelectedNetwork] = useState<IServerNetwork>();

  const { result } = usePromiseResult(async () => {
    const [categoryList, defaultNetwork, allNetworks] = await Promise.all([
      backgroundApiProxy.serviceDiscovery.fetchCategoryList(),
      backgroundApiProxy.serviceNetwork.getNetwork({
        networkId: getNetworkIdsMap().eth,
      }),
      backgroundApiProxy.serviceNetwork.getAllNetworks(),
    ]);
    const networkList = allNetworks.networks
      .filter((n) => !n.isTestnet)
      .map((n) => n.id);
    setSelectedCategory(categoryList[0].categoryId);
    setSelectedNetwork(defaultNetwork);
    return {
      categoryList,
      networkList,
    };
  }, []);

  // Dependent on networkId and categoryId, a separate usePromiseResult is required.
  const { result: dAppList, isLoading: isLoadingDappList } = usePromiseResult(
    async () => {
      if (!selectedCategory || !selectedNetwork) {
        return {
          data: [],
          next: '',
        };
      }
      return backgroundApiProxy.serviceDiscovery.fetchDAppListByCategory({
        category: selectedCategory,
        network: selectedNetwork.id,
      });
    },
    [selectedCategory, selectedNetwork],
    {
      watchLoading: true,
    },
  );

  const media = useMedia();
  const chunkSize = media.gtMd && media.lg ? 2 : 3;
  const renderSkeletonView = useCallback(
    () => (
      <Stack space="$5">
        {Array.from({ length: 4 }).map((_, index) => (
          <Stack space="$3" key={index}>
            <Skeleton w="$14" h="$6" />
            <ChunkedItemsSkeletonView
              key="skeleton-view"
              isExploreView
              dataChunks={chunkArray(
                Array.from({ length: chunkSize }).map(
                  (_i, idx) =>
                    ({
                      dappId: `first-${idx}`,
                    } as IDApp),
                ),
                chunkSize,
              )}
            />
          </Stack>
        ))}
      </Stack>
    ),
    [chunkSize],
  );

  const renderContent = useCallback(() => {
    if (isNil(isLoading) || isLoading) {
      return renderSkeletonView();
    }
    if (isExploreView) {
      return (
        <ExploreView
          isLoading={isLoadingDappList}
          dAppList={dAppList}
          categoryResult={result}
          selectedCategory={selectedCategory}
          selectedNetwork={selectedNetwork}
          setSelectedCategory={setSelectedCategory}
          setSelectedNetwork={setSelectedNetwork}
          networkList={result?.networkList ?? []}
          handleOpenWebSite={handleOpenWebSite}
        />
      );
    }
    return (
      <SuggestedView
        suggestedData={suggestedData}
        handleOpenWebSite={handleOpenWebSite}
      />
    );
  }, [
    isLoadingDappList,
    isExploreView,
    isLoading,
    renderSkeletonView,
    suggestedData,
    handleOpenWebSite,
    dAppList,
    result,
    selectedCategory,
    selectedNetwork,
    setSelectedCategory,
    setSelectedNetwork,
  ]);

  return (
    <Stack
      p="$5"
      $platform-native={{
        pb: '$16',
      }}
      tag="section"
    >
      <DashboardSectionHeader>
        <DashboardSectionHeader.Heading
          key="suggested"
          selected={!isExploreView}
          onPress={() => setIsExploreView(false)}
        >
          Suggested
        </DashboardSectionHeader.Heading>
        <DashboardSectionHeader.Heading
          key="explore"
          selected={isExploreView}
          onPress={() => setIsExploreView(true)}
        >
          Explore
        </DashboardSectionHeader.Heading>
      </DashboardSectionHeader>
      {renderContent()}
    </Stack>
  );
}
