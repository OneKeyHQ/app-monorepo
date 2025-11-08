import { StyleSheet } from 'react-native';

import {
  Button,
  IconButton,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useReferralCodeCard } from '../hooks/useReferralCodeCard';

import type { IReferralCodeCardProps } from '../types';

export function ReferralCodeCardDesktop({
  inviteUrl,
  inviteCode,
}: IReferralCodeCardProps) {
  const {
    handleCopy,
    copyLink,
    inviteCodeUrl,
    toYourReferredPage,
    handleShare,
    intl,
  } = useReferralCodeCard({ inviteUrl, inviteCode });

  return (
    <>
      <YStack px="$5" pt="$6" pb="$5" $platform-native={{ pb: '$8' }}>
        <YStack>
          <XStack jc="space-between">
            <SizableText size="$headingMd">{intl.yourCode}</SizableText>
            <Button
              onPress={toYourReferredPage}
              variant="tertiary"
              iconAfter="ChevronRightOutline"
              jc="center"
            >
              {intl.referred}
            </Button>
          </XStack>
          <XStack pt="$2">
            <XStack
              flexShrink={1}
              onPress={handleCopy}
              gap="$3"
              borderRadius="$2"
              ml="$-2"
              px="$2"
              borderCurve="continuous"
              ai="center"
              hoverStyle={{ bg: '$bgHover' }}
              pressStyle={{ bg: '$bgActive' }}
            >
              <SizableText size="$heading4xl">{inviteCode}</SizableText>
              <IconButton
                title={intl.copy}
                variant="tertiary"
                icon="Copy3Outline"
                size="large"
                iconColor="$iconSubdued"
                hoverStyle={undefined}
                pressStyle={undefined}
                onPress={handleCopy}
              />
            </XStack>
            <XStack flex={1} />
          </XStack>
          <Stack
            mt="$2.5"
            ai="center"
            gap="$2.5"
            flexDirection="row"
            $platform-native={{
              flexDirection: 'column',
              gap: '$4',
            }}
          >
            <XStack
              borderColor="rgba(0, 0, 0, 0.13)"
              bg="$bgDisabled"
              px="$3"
              py="$1.5"
              flex={1}
              width="100%"
              borderWidth={StyleSheet.hairlineWidth}
              jc="space-between"
              ai="center"
              onPress={copyLink}
              borderRadius="$2.5"
              hoverStyle={{ bg: '$bgActive' }}
              pressStyle={{ bg: '$bgActive' }}
            >
              <SizableText
                size="$bodyLg"
                flexShrink={platformEnv.isNative ? undefined : 1}
                textBreakStrategy={
                  platformEnv.isNativeAndroid ? 'simple' : undefined
                }
              >
                {inviteCodeUrl}
              </SizableText>
              {platformEnv.isNative ? null : (
                <IconButton
                  title={intl.copy}
                  icon="Copy3Outline"
                  variant="tertiary"
                  size="medium"
                  iconColor="$iconSubdued"
                  onPress={copyLink}
                  hoverStyle={undefined}
                  pressStyle={undefined}
                />
              )}
            </XStack>
            {platformEnv.isNative ? (
              <XStack
                ai="center"
                gap="$2.5"
                $md={{
                  width: '100%',
                }}
              >
                <Button
                  icon="Copy3Outline"
                  variant={platformEnv.isNative ? undefined : 'primary'}
                  $md={{
                    flex: 1,
                  }}
                  size="medium"
                  onPress={copyLink}
                >
                  {intl.copy}
                </Button>
                <Button
                  variant="primary"
                  icon="ShareOutline"
                  size="medium"
                  $md={{
                    flex: 1,
                  }}
                  onPress={handleShare}
                >
                  {intl.share}
                </Button>
              </XStack>
            ) : null}
          </Stack>
        </YStack>
      </YStack>
    </>
  );
}
