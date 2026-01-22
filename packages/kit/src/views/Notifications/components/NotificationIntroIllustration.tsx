import type { IKeyOfIcons, IStackProps } from '@onekeyhq/components';
import {
  Heading,
  Icon,
  LinearGradient,
  SizableText,
  Stack,
  XStack,
  YStack,
  useTheme,
} from '@onekeyhq/components';

const DATA: {
  icon: IKeyOfIcons;
  title: string;
  description: string;
  time: string;
  stacked?: boolean;
}[] = [
  {
    icon: 'ArrowBottomOutline',
    title: 'Received 1.25 ETH',
    description: 'Your transaction from 0x71...c2 is confirmed.',
    time: 'now',
    stacked: true,
  },
  {
    icon: 'SpeakerPromoteOutline',
    title: 'BTC broke $100,000',
    description: 'Your watched token BTC is up 5.2% in 1 day.',
    time: '10m ago',
  },
  {
    icon: 'InfoCircleOutline',
    title: 'Take-profit triggered',
    description: 'Your ETH-PERP position has reached the target price and was closed.',
    time: '1h ago',
  },
];

function Item({
  icon,
  title,
  description,
  time,
  stacked,
}: {
  icon: IKeyOfIcons;
  title?: string;
  description?: string;
  time?: string;
  stacked?: boolean;
}) {
  const theme = useTheme();
  const gray5Color = theme.gray5.val;
  const gray3Color = theme.gray3.val;
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
            colors={[gray5Color, gray3Color]}
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
        <Stack
          w={28}
          h={28}
          bg="$bgStrong"
          borderRadius="$full"
          borderWidth={0.5}
          borderColor="$borderSubdued"
          alignItems="center"
          justifyContent="center"
        >
          <Icon name={icon} size={18} color="$icon" />
        </Stack>
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
