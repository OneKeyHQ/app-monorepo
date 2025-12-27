import type { IStackProps } from '@onekeyhq/components';
import {
  Heading,
  Image,
  LinearGradient,
  SizableText,
  Stack,
  XStack,
  YStack,
  useTheme,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';

const DATA = [
  {
    title: appLocale.intl.formatMessage({
      id: ETranslations.global_wallet_activity,
    }),
    description: appLocale.intl.formatMessage({
      id: ETranslations.global_real_time_updates,
    }),
    time: 'now',
    stacked: true,
  },
  {
    title: appLocale.intl.formatMessage({
      id: ETranslations.global_market_moves,
    }),
    description: appLocale.intl.formatMessage({
      id: ETranslations.global_daily_price_change,
    }),
    time: '10m ago',
  },
  {
    title: appLocale.intl.formatMessage({
      id: ETranslations.global_perps_alert,
    }),
    description: appLocale.intl.formatMessage({
      id: ETranslations.global_instant_update_liquidation,
    }),
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
