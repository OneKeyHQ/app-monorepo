import type { IStackProps } from '@onekeyhq/components';
import {
  Heading,
  Image,
  LinearGradient,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';

const DATA = [
  {
    title: 'Sent',
    description: 'Account 1 sent 10 MATIC',
    time: 'now',
    stacked: true,
  },
  {
    title: 'Received',
    description: 'Account 2 received 10 MATIC',
    time: '10m ago',
  },
  {
    title: 'Approved USDC',
    description: 'Account 3 • Polygon',
    time: '1h ago',
  },
];

function Item({
  title,
  description,
  time,
  stacked,
}: {
  title?: string;
  description?: string;
  time?: string;
  stacked?: boolean;
}) {
  return (
    <YStack {...(stacked ? { pb: '$2.5' } : {})}>
      {stacked ? (
        <Stack
          position="absolute"
          bottom="$0"
          left="$2.5"
          right="$2.5"
          top="$2.5"
          bg="$gray3"
          borderRadius="$6"
          borderCurve="continuous"
          overflow="hidden"
          $gtMd={{
            borderRadius: '$4',
          }}
        >
          <LinearGradient
            h="$2.5"
            mt="auto"
            colors={['$gray5', '$gray3']}
            start={[0, 0]}
            end={[0, 1]}
          />
        </Stack>
      ) : null}
      <XStack
        alignItems="center"
        gap="$2.5"
        p="$3"
        bg="$gray3"
        borderRadius="$4"
        borderCurve="continuous"
        $platform-native={{
          p: '$4',
          borderRadius: '$6',
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
              size="$headingSm"
              $platform-native={{
                size: '$headingMd',
              }}
              flex={1}
            >
              {title}
            </Heading>
            <SizableText
              size="$bodySm"
              $platform-native={{
                size: '$bodyMd',
              }}
              color="$textSubdued"
            >
              {time}
            </SizableText>
          </XStack>
          <SizableText
            size="$bodyMd"
            $platform-native={{
              size: '$bodyLg',
            }}
          >
            {description}
          </SizableText>
        </Stack>
      </XStack>
    </YStack>
  );
}

function NotificationIntroIllustration({ ...rest }: IStackProps) {
  return (
    <Stack gap="$2.5" w="100%" maxWidth="$96" mx="auto" {...rest}>
      {DATA.map((item) => (
        <Item key={item.title} {...item} />
      ))}
    </Stack>
  );
}

export default NotificationIntroIllustration;
