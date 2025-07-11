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
        size="$14"
        borderRadius="$3"
        $group-card-hover={{
          opacity: 0.75,
        }}
        borderWidth={StyleSheet.hairlineWidth}
        borderColor="$borderSubdued"
        borderCurve="continuous"
        source={{
          uri: item.logo,
        }}
        fallback={
          <Image.Fallback>
            <Icon name="GlobusOutline" size="$14" />
          </Image.Fallback>
        }
      />
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
