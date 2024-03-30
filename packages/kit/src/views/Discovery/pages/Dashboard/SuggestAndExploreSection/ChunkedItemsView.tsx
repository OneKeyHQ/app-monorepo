import type { ReactNode } from 'react';

import {
  Badge,
  Image,
  ScrollView,
  SizableText,
  Stack,
  XStack,
  useMedia,
} from '@onekeyhq/components';
import type {
  IBadgeType,
  IScrollViewProps,
  IStackProps,
} from '@onekeyhq/components';
import type { ICategory, IDApp } from '@onekeyhq/shared/types/discovery';

import type { IMatchDAppItemType } from '../../../types';

export const chunkArray = (array: ICategory['dapps'], chunkSize: number) => {
  const chunks = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
};

type IChunkedItemsViewProps = {
  dataChunks: IDApp[][];
  handleOpenWebSite: ({ dApp, webSite }: IMatchDAppItemType) => void;
};

export function ItemsContainer({
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

export function ChunkedItemsView({
  dataChunks,
  handleOpenWebSite,
}: IChunkedItemsViewProps) {
  return (
    <ItemsContainer mx="$-5">
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
                onPress={() =>
                  handleOpenWebSite({
                    webSite: {
                      url: item.url,
                      title: item.name,
                    },
                  })
                }
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
  );
}
