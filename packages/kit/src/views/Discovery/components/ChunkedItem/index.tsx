import { StyleSheet } from 'react-native';

import {
  Badge,
  Icon,
  Image,
  SizableText,
  Skeleton,
  Stack,
  XStack,
} from '@onekeyhq/components';
import type { IBadgeType } from '@onekeyhq/components';
import type { IDApp } from '@onekeyhq/shared/types/discovery';

export function ChunkedItem({
  item,
  isExploreView,
  onPress,
}: {
  item: IDApp;
  isExploreView?: boolean;
  onPress?: () => void;
}) {
  return (
    <XStack
      group="card"
      key={item.dappId}
      p="$3"
      alignItems="center"
      $md={
        isExploreView
          ? {
              flexBasis: '100%',
            }
          : undefined
      }
      $gtMd={{
        px: '$5',
        flexBasis: '50%',
      }}
      $gtLg={{
        px: '$5',
        flexBasis: '33.3333%',
      }}
      onPress={onPress}
      userSelect="none"
      testID={`dapp-${item.dappId}`}
    >
      <Image
        w="$14"
        h="$14"
        borderRadius="$3"
        $group-card-hover={{
          opacity: 0.75,
        }}
        borderWidth={StyleSheet.hairlineWidth}
        borderColor="$borderSubdued"
        borderCurve="continuous"
      >
        <Image.Source
          source={{
            uri: item.logo,
          }}
        />
        <Image.Fallback>
          <Icon name="GlobusOutline" width="100%" height="100%" />
        </Image.Fallback>
        <Image.Loading>
          <Skeleton width="100%" height="100%" />
        </Image.Loading>
      </Image>
      <Stack flex={1} ml="$3">
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
          $gtMd={
            {
              size: '$bodySm',
              numberOfLines: 2,
              whiteSpace: 'break-spaces',
            } as any
          }
        >
          {item.description}
        </SizableText>
      </Stack>
    </XStack>
  );
}
