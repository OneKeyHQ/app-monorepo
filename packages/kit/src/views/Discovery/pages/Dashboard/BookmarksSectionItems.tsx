import { useEffect, useState } from 'react';

import { StyleSheet } from 'react-native';

import type { IXStackProps } from '@onekeyhq/components';
import {
  Icon,
  Image,
  SizableText,
  Skeleton,
  Stack,
  XStack,
  useMedia,
} from '@onekeyhq/components';

import type { IBrowserBookmark, IMatchDAppItemType } from '../../types';

export function BookmarksSectionItems({
  dataSource,
  handleOpenWebSite,
  ...restProps
}: IXStackProps & {
  dataSource: IBrowserBookmark[];
  handleOpenWebSite: ({ dApp, webSite }: IMatchDAppItemType) => void;
}) {
  const [numberOfItems, setNumberOfItems] = useState(0);
  const media = useMedia();

  useEffect(() => {
    const calculateNumberOfItems = () => {
      if (media.gtXl) return 8;
      if (media.gtLg) return 6;
      if (media.gtSm) return 5;
      return 4;
    };
    setNumberOfItems(calculateNumberOfItems());
  }, [media.gtXl, media.gtLg, media.gtSm, media.gtMd]);

  return (
    <XStack
      flexWrap="wrap"
      mx="$-5"
      $gtLg={{
        mx: '$-3',
      }}
      {...restProps}
    >
      {dataSource.slice(0, numberOfItems).map(({ logo, title, url }, index) => (
        <Stack
          key={index}
          flexBasis="25%"
          alignItems="center"
          gap="$2"
          py="$2"
          $gtSm={{
            flexBasis: '20%',
          }}
          $gtLg={{
            p: '$3',
            flexBasis: '33.3333%',
            flexDirection: 'row',
            gap: '$5',
          }}
          $gtXl={{
            flexBasis: '25%',
          }}
          userSelect="none"
          onPress={() =>
            handleOpenWebSite({
              webSite: {
                url,
                title,
              },
            })
          }
        >
          <Image
            size="$14"
            borderRadius="$3"
            $gtLg={{
              w: '$12',
              h: '$12',
            }}
            borderCurve="continuous"
            borderWidth={StyleSheet.hairlineWidth}
            borderColor="$borderSubdued"
          >
            <Image.Source
              source={{
                uri: logo,
              }}
            />
            <Image.Fallback>
              <Icon
                size="$14"
                $gtLg={{
                  size: '$12',
                }}
                name="GlobusOutline"
              />
            </Image.Fallback>
            <Image.Loading>
              <Skeleton width="100%" height="100%" />
            </Image.Loading>
          </Image>
          <SizableText
            size="$bodyLgMedium"
            px="$2"
            $gtMd={{
              size: '$bodyMdMedium',
              px: '$0',
            }}
            textAlign="center"
            numberOfLines={1}
          >
            {title}
          </SizableText>
        </Stack>
      ))}
    </XStack>
  );
}
