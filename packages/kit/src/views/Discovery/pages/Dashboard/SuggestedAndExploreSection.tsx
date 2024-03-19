import type { ReactNode } from 'react';
import { useCallback, useMemo, useState } from 'react';

import type {
  IBadgeType,
  IScrollViewProps,
  IStackProps,
} from '@onekeyhq/components';
import {
  Badge,
  Empty,
  Heading,
  Icon,
  Image,
  ScrollView,
  Select,
  SizableText,
  Skeleton,
  Stack,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import { ImageSource } from '@onekeyhq/components/src/primitives/Image/ImageSource';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import type { ICategory, IDApp } from '@onekeyhq/shared/types/discovery';

import { DashboardSectionHeader } from './DashboardSectionHeader';

import type { IMatchDAppItemType } from '../../types';

const chunkArray = (array: ICategory['dapps'], chunkSize: number) => {
  const chunks = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
};

function ItemsContainer({
  children,
  ...rest
}: {
  children: ReactNode;
} & IStackProps &
  IScrollViewProps) {
  const media = useMedia();

  if (media.gtMd) {
    return <Stack {...rest}>{children}</Stack>;
  }

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} {...rest}>
      {children}
    </ScrollView>
  );
}

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
  const media = useMedia();

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

  const chunkSize = media.gtMd && media.lg ? 2 : 3;
  const chunkedSuggestedData = useMemo(
    () =>
      suggestedData.map((i) => ({
        ...i,
        dataChunks: chunkArray(i.dapps, chunkSize),
      })),
    [suggestedData, chunkSize],
  );

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

  const renderChunkItemView = useCallback(
    (dataChunks: IDApp[][], categoryId: string) => (
      <ItemsContainer key={categoryId} mx="$-5">
        <XStack
          px="$2"
          $gtMd={{
            flexDirection: 'column',
          }}
        >
          {dataChunks.map((chunk, chunkIndex) => (
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
              {chunk.map((item) => (
                <XStack
                  key={item.dappId}
                  p="$3"
                  space="$3"
                  alignItems="center"
                  $gtMd={{
                    flexBasis: '50%',
                  }}
                  $gtLg={{
                    flexBasis: '33.3333%',
                  }}
                  onPress={() => {
                    handleOpenWebSite({
                      webSite: {
                        url: item.url,
                        title: item.name,
                      },
                    });
                  }}
                >
                  <Image w="$14" h="$14" borderRadius="$3">
                    <Image.Source
                      source={{
                        uri: item.logo,
                      }}
                    />
                  </Image>
                  <Stack flex={1}>
                    <XStack alignItems="center">
                      <SizableText
                        size="$bodyLgMedium"
                        $gtMd={{
                          size: '$bodyMdMedium',
                        }}
                        numberOfLines={1}
                      >
                        {item.name}
                      </SizableText>
                      {Array.isArray(item.tags) && item.tags.length ? (
                        <Badge
                          badgeSize="sm"
                          badgeType={item.tags[0].type as IBadgeType}
                          ml="$2"
                        >
                          {item.tags[0].name}
                        </Badge>
                      ) : null}
                    </XStack>
                    <SizableText
                      size="$bodyMd"
                      color="$textSubdued"
                      numberOfLines={1}
                      $gtMd={{
                        size: '$bodySm',
                        numberOfLines: 2,
                        whiteSpace: 'break-spaces',
                      }}
                    >
                      {item.description}
                    </SizableText>
                  </Stack>
                </XStack>
              ))}
            </Stack>
          ))}
        </XStack>
      </ItemsContainer>
    ),
    [handleOpenWebSite],
  );

  const suggestedView = useMemo(
    () => (
      <>
        {chunkedSuggestedData.map((i, index) => (
          <Stack key={`${i.name}--${i.categoryId}`}>
            <Heading
              size="$headingMd"
              pt="$2"
              {...(index !== 0 && {
                pt: '$5',
              })}
            >
              {i.name}
            </Heading>
            {renderChunkItemView(i.dataChunks, i.categoryId)}
          </Stack>
        ))}
      </>
    ),
    [chunkedSuggestedData, renderChunkItemView],
  );

  const selectOptions = useMemo(
    () =>
      Array.isArray(result?.categoryList)
        ? result.categoryList.map((i) => ({
            value: i.categoryId,
            label: i.name,
          }))
        : [],
    [result?.categoryList],
  );
  const networkOptions = useMemo(
    () =>
      Array.isArray(result?.networks)
        ? result.networks.map((i) => ({
            value: i.id,
            label: i.name,
            logoURI: i.logoURI,
          }))
        : [],
    [result?.networks],
  );

  const exploreView = useMemo(() => {
    const isEmpty = !dAppList?.data || dAppList?.data.length === 0;
    return (
      <>
        <XStack py="$2">
          <Select
            title="Categories"
            items={selectOptions}
            value={selectedCategory}
            onChange={setSelectedCategory}
            renderTrigger={({ label }) => (
              <XStack
                mr="$2.5"
                py="$1.5"
                px="$2"
                bg="$bgStrong"
                borderRadius="$3"
                userSelect="none"
                style={{
                  borderCurve: 'continuous',
                }}
                hoverStyle={{
                  bg: '$bgStrongHover',
                }}
                pressStyle={{
                  bg: '$bgStrongActive',
                }}
              >
                <SizableText size="$bodyMdMedium" px="$1">
                  {label}
                </SizableText>
                <Icon
                  name="ChevronDownSmallOutline"
                  size="$5"
                  color="$iconSubdued"
                />
              </XStack>
            )}
          />
          <Select
            title="Categories"
            items={networkOptions}
            value={selectedNetwork}
            onChange={setSelectedNetwork}
            renderTrigger={({ label, value }) => (
              <XStack
                py="$1.5"
                px="$2"
                bg="$bgStrong"
                borderRadius="$3"
                userSelect="none"
                style={{
                  borderCurve: 'continuous',
                }}
                hoverStyle={{
                  bg: '$bgStrongHover',
                }}
                pressStyle={{
                  bg: '$bgStrongActive',
                }}
              >
                <Image w="$5" h="$5">
                  <ImageSource
                    source={{
                      uri:
                        networkOptions.find((i) => i.value === value)
                          ?.logoURI ?? '',
                    }}
                  />
                </Image>
                <SizableText size="$bodyMdMedium" px="$1">
                  {label}
                </SizableText>
                <Icon
                  name="ChevronDownSmallOutline"
                  size="$5"
                  color="$iconSubdued"
                />
              </XStack>
            )}
          />
        </XStack>
        {isEmpty ? (
          <Empty icon="SearchOutline" title="No Results" />
        ) : (
          renderChunkItemView(
            chunkArray(dAppList?.data ?? [], chunkSize),
            selectedCategory,
          )
        )}
      </>
    );
  }, [
    selectOptions,
    selectedCategory,
    networkOptions,
    selectedNetwork,
    dAppList?.data,
    chunkSize,
    renderChunkItemView,
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
      {/* eslint-disable-next-line no-nested-ternary */}
      {isLoading
        ? renderSkeletonView()
        : isExploreView
        ? exploreView
        : suggestedView}
    </Stack>
  );
}
