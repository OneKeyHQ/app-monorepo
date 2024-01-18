import { useEffect, useState } from 'react';

import type { IXStackProps } from '@onekeyhq/components';
import {
  Image,
  SizableText,
  Stack,
  XStack,
  useMedia,
} from '@onekeyhq/components';

import { DashboardSectionHeader } from './DashboardSectionHeader';

const data = [
  {
    imgUrl: 'https://placehold.jp/200x200.png',
    name: 'Long Long Name',
  },
  {
    imgUrl: 'https://placehold.jp/200x200.png',
    name: 'Name',
  },
  {
    imgUrl: 'https://placehold.jp/200x200.png',
    name: 'Name',
  },
  {
    imgUrl: 'https://placehold.jp/200x200.png',
    name: 'Name',
  },
  {
    imgUrl: 'https://placehold.jp/200x200.png',
    name: 'Name',
  },
  {
    imgUrl: 'https://placehold.jp/200x200.png',
    name: 'Name',
  },
  {
    imgUrl: 'https://placehold.jp/200x200.png',
    name: 'Name',
  },
  {
    imgUrl: 'https://placehold.jp/200x200.png',
    name: 'Name',
  },
  {
    imgUrl: 'https://placehold.jp/200x200.png',
    name: 'Name',
  },
];

function Items(props: IXStackProps) {
  const [numberOfItems, setNumberOfItems] = useState(0);
  const media = useMedia();

  useEffect(() => {
    if (media.gtXl) {
      setNumberOfItems(8);
    } else if (media.gtLg) {
      setNumberOfItems(6);
    } else if (media.gtSm) {
      setNumberOfItems(5);
    } else {
      setNumberOfItems(4);
    }
  }, [media.gtLg, media.gtMd, media.gtSm, media.gtXl]);

  return (
    <XStack
      flexWrap="wrap"
      mx="$-5"
      $gtLg={{
        mx: '$-3',
      }}
      {...props}
    >
      {data.slice(0, numberOfItems).map(({ imgUrl, name }, index) => (
        <Stack
          key={index}
          flexBasis="25%"
          alignItems="center"
          space="$2"
          py="$2"
          $gtSm={{
            flexBasis: '20%',
          }}
          $gtLg={{
            p: '$3',
            flexBasis: '33.3333%',
            flexDirection: 'row',
            space: '$5',
          }}
          $gtXl={{
            flexBasis: '25%',
          }}
          userSelect="none"
        >
          <Image
            w="$14"
            h="$14"
            borderRadius="$3"
            $gtLg={{
              w: '$12',
              h: '$12',
            }}
          >
            <Image.Source
              source={{
                uri: imgUrl,
              }}
            />
          </Image>
          <SizableText
            size="$bodyLgMedium"
            textAlign="center"
            numberOfLines={1}
          >
            {name}
          </SizableText>
        </Stack>
      ))}
    </XStack>
  );
}

export function BookmarksAndHistoriesSection() {
  const [isHistoriesView, setIsHistoriesView] = useState(false);

  return (
    <Stack px="$5">
      <DashboardSectionHeader>
        <DashboardSectionHeader.Heading
          selected={!isHistoriesView}
          onPress={() => setIsHistoriesView(false)}
        >
          Bookmarks
        </DashboardSectionHeader.Heading>
        <DashboardSectionHeader.Heading
          selected={isHistoriesView}
          onPress={() => setIsHistoriesView(true)}
        >
          Histories
        </DashboardSectionHeader.Heading>
        <DashboardSectionHeader.Button>See All</DashboardSectionHeader.Button>
      </DashboardSectionHeader>
      <Items />
    </Stack>
  );
}
