import { useCallback, useState } from 'react';

import { isNil } from 'lodash';

import { Skeleton, Stack, XStack, YStack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import type { ICategory } from '@onekeyhq/shared/types/discovery';

import { DashboardSectionHeader } from '../DashboardSectionHeader';

import { ItemsContainer } from './ChunkedItemsView';
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
  const [selectedNetwork, setSelectedNetwork] = useState('');

  const { result } = usePromiseResult(async () => {
    const [categoryList, allNetworks] = await Promise.all([
      backgroundApiProxy.serviceDiscovery.fetchCategoryList(),
      backgroundApiProxy.serviceNetwork.getAllNetworks(),
    ]);
    const { networks } = allNetworks;
    setSelectedCategory(categoryList[0].categoryId);
    setSelectedNetwork(networks[0].id);
    return {
      categoryList,
      networks,
    };
  }, []);

  // Dependent on networkId and categoryId, a separate usePromiseResult is required.
  const { result: dAppList } = usePromiseResult(async () => {
    if (!selectedCategory || !selectedNetwork) {
      return {
        data: [],
        next: '',
      };
    }
    return backgroundApiProxy.serviceDiscovery.fetchDAppListByCategory({
      category: selectedCategory,
      network: selectedNetwork,
    });
  }, [selectedCategory, selectedNetwork]);

  const renderSkeletonView = useCallback(
    () => (
      <Stack space="$5">
        {Array.from({ length: 2 }).map((_, index) => (
          <Stack space="$3" key={index}>
            <Skeleton w="$14" h="$6" />

            <ItemsContainer key="skeleton-view" mx="$-5">
              <XStack
                px="$2"
                $gtMd={{
                  flexDirection: 'column',
                }}
              >
                {[
                  Array.from({ length: 3 }),
                  Array.from({ length: 3 }),
                  Array.from({ length: 3 }),
                ].map((chunk, chunkIndex) => (
                  <Stack
                    key={chunkIndex}
                    $md={{
                      w: '$96',
                    }}
                    $gtMd={{
                      flexDirection: 'row',
                      flexWrap: 'wrap',
                    }}
                  >
                    {chunk.map((_chunkItem, chunkItemIndex) => (
                      <XStack
                        key={`${chunkIndex}-${chunkItemIndex}`}
                        p="$3"
                        space="$3"
                        alignItems="center"
                        $gtMd={{
                          flexBasis: '50%',
                        }}
                        $gtLg={{
                          flexBasis: '33.3333%',
                        }}
                      >
                        <XStack space="$3">
                          <Skeleton w="$14" h="$14" />
                          <YStack space="$1">
                            <Skeleton w="$10" h="$4" />
                            <Skeleton
                              w={216}
                              h="$4"
                              $md={{
                                w: 186,
                              }}
                            />
                            <Skeleton
                              w={216}
                              h="$4"
                              $md={{
                                w: 186,
                              }}
                            />
                          </YStack>
                        </XStack>
                      </XStack>
                    ))}
                  </Stack>
                ))}
              </XStack>
            </ItemsContainer>
          </Stack>
        ))}
      </Stack>
    ),
    [],
  );

  const renderContent = useCallback(() => {
    if (isNil(isLoading) || isLoading) {
      return renderSkeletonView();
    }
    if (isExploreView) {
      return (
        <ExploreView
          dAppList={dAppList}
          categoryResult={result}
          selectedCategory={selectedCategory}
          selectedNetwork={selectedNetwork}
          setSelectedCategory={setSelectedCategory}
          setSelectedNetwork={setSelectedNetwork}
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
