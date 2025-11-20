import { StyleSheet } from 'react-native';

import { Skeleton, YStack } from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

export function CloudBackupLoadingSkeleton() {
  return (
    <YStack gap="$5">
      {[...Array(3)].map((_, index) => (
        <ListItem
          key={index}
          gap="$3"
          bg="$bg"
          $platform-web={{
            boxShadow:
              '0 0 0 1px rgba(0, 0, 0, 0.04), 0 0 2px 0 rgba(0, 0, 0, 0.08), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
          }}
          $theme-dark={{
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: '$neutral3',
          }}
          $platform-native={{
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: '$borderSubdued',
          }}
          borderRadius="$5"
          borderCurve="continuous"
          p="$3"
          m="$0"
          userSelect="none"
        >
          <YStack gap={2} flex={1}>
            {platformEnv.isNative ? (
              <>
                <Skeleton.BodyLg />
                <Skeleton.BodyMd />
              </>
            ) : (
              <>
                <Skeleton.BodyMd />
                <Skeleton.BodySm />
              </>
            )}
          </YStack>
        </ListItem>
      ))}
    </YStack>
  );
}
