import type { ReactNode } from 'react';
import { useCallback, useState } from 'react';

import type { IScrollViewProps, IStackProps } from '@onekeyhq/components';
import {
  Badge,
  Heading,
  Icon,
  Image,
  ScrollView,
  Select,
  SizableText,
  Stack,
  XStack,
  useMedia,
} from '@onekeyhq/components';
import { ImageSource } from '@onekeyhq/components/src/primitives/Image/ImageSource';

import useAppNavigation from '../../../../hooks/useAppNavigation';
import { EModalRoutes } from '../../../../routes/Modal/type';
import { EChainSelectorPages } from '../../../ChainSelector/router/type';

import { DashboardSectionHeader } from './DashboardSectionHeader';

import type { GetProps } from 'tamagui';

type IDapp = {
  imgUrl: string;
  name: string;
  description: string;
  badge?: {
    children: GetProps<typeof Badge>['children'];
    type: GetProps<typeof Badge>['badgeType'];
  };
};

type IDapps = {
  title?: string;
  data: IDapp[];
}[];

const generateRepeatedData = (count: number) => {
  const data = [];
  for (let i = 0; i < count; i += 1) {
    data.push({
      imgUrl: 'https://placehold.jp/200x200.png',
      name: 'Name',
      description:
        'Cillum commodo ex veniam labore ipsum Lorem qui consectetur labore nulla.',
    });
  }
  return data;
};

const SuggestedData: IDapps = [
  {
    title: 'Trendy',
    data: [
      {
        imgUrl: 'https://placehold.jp/200x200.png',
        name: 'Long Long Name',
        description:
          'Cillum commodo ex veniam labore ipsum Lorem qui consectetur labore nulla. Cillum commodo ex veniam labore ipsum Lorem qui consectetur labore nulla.',
        badge: {
          children: '🔥 Hot',
          type: 'critical',
        },
      },
      {
        imgUrl: 'https://placehold.jp/200x200.png',
        name: 'Name',
        description:
          'Cillum commodo ex veniam labore ipsum Lorem qui consectetur labore nulla.',
        badge: {
          children: '⭐ New',
          type: 'success',
        },
      },
      {
        imgUrl: 'https://placehold.jp/200x200.png',
        name: 'Name',
        description:
          'Cillum commodo ex veniam labore ipsum Lorem qui consectetur labore nulla.',
        badge: {
          children: '🎈 Airdrop',
          type: 'info',
        },
      },
      ...generateRepeatedData(10),
    ],
  },
  {
    title: 'Lightning Network',
    data: [
      {
        imgUrl: 'https://placehold.jp/200x200.png',
        name: 'Long Long Name',
        description:
          'Cillum commodo ex veniam labore ipsum Lorem qui consectetur labore nulla.',
        badge: {
          children: '🔥 Hot',
          type: 'critical',
        },
      },
      {
        imgUrl: 'https://placehold.jp/200x200.png',
        name: 'Name',
        description:
          'Cillum commodo ex veniam labore ipsum Lorem qui consectetur labore nulla.',
        badge: {
          children: '⭐ New',
          type: 'success',
        },
      },
      {
        imgUrl: 'https://placehold.jp/200x200.png',
        name: 'Name',
        description:
          'Cillum commodo ex veniam labore ipsum Lorem qui consectetur labore nulla.',
        badge: {
          children: '🎈 Airdrop',
          type: 'info',
        },
      },
      ...generateRepeatedData(10),
    ],
  },
];

const ExploreData: IDapps = [
  {
    data: [
      {
        imgUrl: 'https://placehold.jp/200x200.png',
        name: 'Long Long Name',
        description:
          'Cillum commodo ex veniam labore ipsum Lorem qui consectetur labore nulla. Cillum commodo ex veniam labore ipsum Lorem qui consectetur labore nulla.',
        badge: {
          children: '🔥 Hot',
          type: 'critical',
        },
      },
      {
        imgUrl: 'https://placehold.jp/200x200.png',
        name: 'Name',
        description:
          'Cillum commodo ex veniam labore ipsum Lorem qui consectetur labore nulla.',
        badge: {
          children: '⭐ New',
          type: 'success',
        },
      },
      {
        imgUrl: 'https://placehold.jp/200x200.png',
        name: 'Name',
        description:
          'Cillum commodo ex veniam labore ipsum Lorem qui consectetur labore nulla.',
        badge: {
          children: '🎈 Airdrop',
          type: 'info',
        },
      },
      ...generateRepeatedData(20),
    ],
  },
];

const chunkArray = (array: IDapp[], chunkSize: number) => {
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

export function SuggestedAndExploreSection() {
  const [isExploreView, setIsExploreView] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('new');
  const media = useMedia();
  const navigation = useAppNavigation();

  const handleChainButtonPressed = useCallback(() => {
    navigation.pushModal(EModalRoutes.ChainSelectorModal, {
      screen: EChainSelectorPages.ChainSelector,
    });
  }, [navigation]);

  return (
    <Stack p="$5" tag="section">
      <DashboardSectionHeader>
        <DashboardSectionHeader.Heading
          selected={!isExploreView}
          onPress={() => setIsExploreView(false)}
        >
          Suggested
        </DashboardSectionHeader.Heading>
        <DashboardSectionHeader.Heading
          selected={isExploreView}
          onPress={() => setIsExploreView(true)}
        >
          Explore
        </DashboardSectionHeader.Heading>
      </DashboardSectionHeader>
      {(isExploreView ? ExploreData : SuggestedData).map(
        ({ title, data }, index) => {
          const getItemsPerChunk = () => {
            if (media.gtMd && media.lg) {
              return 2;
            }

            return 3;
          };

          const dataChunks = chunkArray(
            isExploreView
              ? data
              : data.slice(0, media.gtMd && media.lg ? 8 : 9),
            getItemsPerChunk(),
          );

          return (
            <>
              {title && (
                <Heading
                  size="$headingMd"
                  pt="$2"
                  {...(index !== 0 && {
                    pt: '$5',
                  })}
                >
                  {title}
                </Heading>
              )}
              {isExploreView && (
                <XStack py="$2">
                  <Select
                    title="Categories"
                    items={[
                      {
                        label: 'New',
                        value: 'new',
                      },
                      {
                        label: 'Marketplaces',
                        value: 'marketplaces',
                      },
                      {
                        label: 'Exchanges',
                        value: 'exchanges',
                      },
                      {
                        label: 'Games',
                        value: 'games',
                      },
                    ]}
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
                    onPress={handleChainButtonPressed}
                  >
                    <Image w="$5" h="$5">
                      <ImageSource
                        source={{
                          uri: 'https://cdn.jsdelivr.net/gh/atomiclabs/cryptocurrency-icons@1a63530be6e374711a8554f31b17e4cb92c25fa5/128/color/btc.png',
                        }}
                      />
                    </Image>
                    <SizableText size="$bodyMdMedium" px="$1">
                      Bitcoin
                    </SizableText>
                    <Icon
                      name="ChevronDownSmallOutline"
                      size="$5"
                      color="$iconSubdued"
                    />
                  </XStack>
                </XStack>
              )}
              <ItemsContainer key={title} mx="$-5">
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
                      {chunk.map(
                        ({ imgUrl, name, description, badge }, itemIndex) => (
                          <XStack
                            key={itemIndex}
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
                            <Image w="$14" h="$14" borderRadius="$3">
                              <Image.Source
                                source={{
                                  uri: imgUrl,
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
                                  {name}
                                </SizableText>
                                {badge && (
                                  <Badge
                                    badgeSize="sm"
                                    badgeType={badge.type}
                                    ml="$2"
                                  >
                                    {badge.children}
                                  </Badge>
                                )}
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
                                {description}
                              </SizableText>
                            </Stack>
                          </XStack>
                        ),
                      )}
                    </Stack>
                  ))}
                </XStack>
              </ItemsContainer>
            </>
          );
        },
      )}
    </Stack>
  );
}
