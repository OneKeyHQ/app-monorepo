import type { IStackProps } from '@onekeyhq/components';
import {
  Heading,
  Image,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';

const DATA = [
  {
    title: '💸 Sent',
    description: 'Account 1 sent 10 MATIC',
    time: 'now',
    stacked: true,
  },
  {
    title: '🤑 Received',
    description: 'Account 2 received 10 MATIC',
    time: '10m ago',
  },
  {
    title: '🔓 Approved USDC',
    description: 'Account 3 • Polygon',
    time: '1h ago',
  },
];

function NotificationIntroIllustration({ ...rest }: IStackProps) {
  return (
    <Stack gap="$2.5" w="100%" maxWidth="$96" mx="auto" {...rest}>
      {DATA.map((item) => (
        <YStack key={item.title} {...(item.stacked ? { pb: '$2.5' } : {})}>
          {item.stacked ? (
            <Stack
              position="absolute"
              bottom="$0"
              left="$2.5"
              right="$2.5"
              top="$2.5"
              bg="$gray2"
              borderRadius="$6"
              borderCurve="continuous"
              $gtMd={{
                borderRadius: '$4',
              }}
            />
          ) : null}
          <XStack
            alignItems="center"
            gap="$2.5"
            p="$4"
            bg="$gray3"
            borderRadius="$6"
            borderCurve="continuous"
            $gtMd={{
              p: '$3',
              borderRadius: '$4',
            }}
          >
            <Image
              source={require('@onekeyhq/kit/assets/logo-decorated.png')}
              w="$10"
              h="$10"
            />
            <Stack flex={1}>
              <XStack gap="$2.5" alignItems="baseline">
                <Heading
                  size="$headingMd"
                  $gtMd={{
                    size: '$headingSm',
                  }}
                  flex={1}
                >
                  {item.title}
                </Heading>
                <SizableText
                  size="$bodyMd"
                  $gtMd={{
                    size: '$bodySm',
                  }}
                  color="$textSubdued"
                >
                  {item.time}
                </SizableText>
              </XStack>
              <SizableText
                $gtMd={{
                  size: '$bodyMd',
                }}
              >
                {item.description}
              </SizableText>
            </Stack>
          </XStack>
        </YStack>
      ))}
    </Stack>
  );
}

export default NotificationIntroIllustration;
