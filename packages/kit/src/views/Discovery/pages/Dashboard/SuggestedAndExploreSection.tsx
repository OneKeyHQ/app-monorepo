import { useState } from 'react';

import {
  Badge,
  Image,
  ScrollView,
  SizableText,
  Stack,
  XStack,
} from '@onekeyhq/components';

import { DashboardSectionHeader } from './DashboardSectionHeader';

const data = [
  {
    imgUrl: 'https://placehold.jp/200x200.png',
    name: 'Long Long Name',
    description:
      'Cillum commodo ex veniam labore ipsum Lorem qui consectetur labore nulla.',
    badge: '🔥 Hot',
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
];

export function SuggestedAndExploreSection() {
  const [isExploreView, setIsExploreView] = useState(false);

  return (
    <Stack px="$5" pt="$5">
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
      <ScrollView>
        {data.map(({ imgUrl, name, description, badge }, index) => (
          <XStack key={index} p="$3" space="$3" alignItems="center">
            <Image w="$14" h="$14" borderRadius="$3">
              <Image.Source
                source={{
                  uri: imgUrl,
                }}
              />
            </Image>
            <Stack>
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
                  <Badge badgeSize="sm" ml="$2">
                    {badge}
                  </Badge>
                )}
              </XStack>
              <SizableText
                size="$bodyMd"
                $gtMd={{
                  size: '$bodySm',
                }}
                color="$textSubdued"
              >
                {description}
              </SizableText>
            </Stack>
          </XStack>
        ))}
      </ScrollView>
    </Stack>
  );
}
