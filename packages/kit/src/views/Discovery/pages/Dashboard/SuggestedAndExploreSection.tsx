import type { ReactNode } from 'react';
import { useState } from 'react';

import type { IScrollViewProps, IStackProps } from '@onekeyhq/components';
import {
  Badge,
  Heading,
  Image,
  ScrollView,
  SizableText,
  Stack,
  XStack,
  useMedia,
} from '@onekeyhq/components';

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

const SuggestedData: IDapps = [
  {
    title: 'Trendy',
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
      {
        imgUrl: 'https://placehold.jp/200x200.png',
        name: 'Name',
        description:
          'Cillum commodo ex veniam labore ipsum Lorem qui consectetur labore nulla.',
      },
      {
        imgUrl: 'https://placehold.jp/200x200.png',
        name: 'Name',
        description:
          'Cillum commodo ex veniam labore ipsum Lorem qui consectetur labore nulla.',
      },
      {
        imgUrl: 'https://placehold.jp/200x200.png',
        name: 'Name',
        description:
          'Cillum commodo ex veniam labore ipsum Lorem qui consectetur labore nulla.',
      },
      {
        imgUrl: 'https://placehold.jp/200x200.png',
        name: 'Name',
        description:
          'Cillum commodo ex veniam labore ipsum Lorem qui consectetur labore nulla.',
      },
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
      {
        imgUrl: 'https://placehold.jp/200x200.png',
        name: 'Name',
        description:
          'Cillum commodo ex veniam labore ipsum Lorem qui consectetur labore nulla.',
      },
      {
        imgUrl: 'https://placehold.jp/200x200.png',
        name: 'Name',
        description:
          'Cillum commodo ex veniam labore ipsum Lorem qui consectetur labore nulla.',
      },
      {
        imgUrl: 'https://placehold.jp/200x200.png',
        name: 'Name',
        description:
          'Cillum commodo ex veniam labore ipsum Lorem qui consectetur labore nulla.',
      },
      {
        imgUrl: 'https://placehold.jp/200x200.png',
        name: 'Name',
        description:
          'Cillum commodo ex veniam labore ipsum Lorem qui consectetur labore nulla.',
      },
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

  return (
    <Stack px="$5" pt="$5" tag="section">
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
      {SuggestedData.map(({ title, data }, index) => {
        const dataChunks = chunkArray(data, 3);

        return (
          <ItemsContainer
            key={title}
            {...(index !== 0 && {
              pt: '$5',
            })}
          >
            <Stack>
              <Heading size="$headingMd" pt="$2">
                {title}
              </Heading>
              <XStack mx="$-3">
                {dataChunks.map((chunk, chunkIndex) => (
                  <Stack
                    key={chunkIndex}
                    flexBasis="90%"
                    $gtMd={{
                      flexBasis: '33.33333%',
                    }}
                  >
                    {chunk.map(
                      ({ imgUrl, name, description, badge }, itemIndex) => (
                        <XStack
                          key={itemIndex}
                          p="$3"
                          space="$3"
                          alignItems="center"
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
            </Stack>
          </ItemsContainer>
        );
      })}
    </Stack>
  );
}
