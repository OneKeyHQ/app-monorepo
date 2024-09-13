import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import {
  Heading,
  Icon,
  Image,
  Page,
  SizableText,
  Stack,
  Switch,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ENotificationPermission } from '@onekeyhq/shared/types/notification';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';

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

function NotificationIntroduction() {
  const intl = useIntl();

  const shouldShowCancelButton = useMemo(() => {
    if (platformEnv.isNativeIOS || platformEnv.isExtension) {
      return false;
    }
    return true;
  }, []);

  return (
    <Page>
      <Page.Header />
      <Page.Body flex={1} gap="$8" px="$5" justifyContent="center">
        <Stack gap="$2" w="100%" maxWidth="$96" mx="auto">
          <Heading size="$heading3xl" textAlign="center">
            {intl.formatMessage({ id: ETranslations.global_notifications })}
          </Heading>
          <SizableText color="$textSubdued" textAlign="center">
            {intl.formatMessage({ id: ETranslations.notifications_intro_desc })}
          </SizableText>
        </Stack>
        <Stack gap="$2.5" w="100%" maxWidth="$96" mx="auto">
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
        {/* Mac tutorials */}
        {platformEnv.isDesktopMac ? (
          <YStack
            gap="$2"
            w="100%"
            maxWidth="$96"
            mx="auto"
            p="$2"
            bg="$bgSubdued"
            borderRadius="$3"
            outlineColor="$neutral3"
            outlineWidth={1}
            outlineStyle="solid"
            elevation={0.5}
          >
            <XStack
              gap="$2"
              p="$2"
              bg="$neutral2"
              outlineColor="$neutral3"
              outlineWidth={1}
              outlineStyle="solid"
              borderRadius="$2"
              elevation={10}
            >
              <Image
                source={require('@onekeyhq/kit/assets/logo-decorated.png')}
                w="$8"
                h="$8"
              />
              <Stack flex={1}>
                <Heading size="$bodyMd">Allow notifications</Heading>
                <SizableText size="$bodySm" color="$textSubdued">
                  OneKey
                </SizableText>
              </Stack>
              <Switch value size="small" />
            </XStack>
            <SizableText size="$bodySm" color="$textSubdued" textAlign="center">
              {intl.formatMessage({
                id: ETranslations.notifications_intro_mac_desc,
              })}
            </SizableText>
            <Icon
              name="HandDrawRightDownArrowIllus"
              color="$text"
              position="absolute"
              bottom="$-10"
              right={-56}
              w="$10"
              h="$24"
            />
          </YStack>
        ) : null}
      </Page.Body>

      <Page.Footer
        onConfirmText={intl.formatMessage({ id: ETranslations.global_enable })}
        onConfirm={async (close) => {
          const permission =
            await backgroundApiProxy.serviceNotification.enableNotificationPermissions();
          if (
            permission.isSupported &&
            permission.permission === ENotificationPermission.granted
          ) {
            close();
          }
        }}
        {...(shouldShowCancelButton && {
          onCancelText: intl.formatMessage({ id: ETranslations.global_done }),
          onCancel: () => console.log('clicked'),
        })}
      />
    </Page>
  );
}

export default NotificationIntroduction;
