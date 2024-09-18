import { useIntl } from 'react-intl';

import type { IYStackProps } from '@onekeyhq/components';
import {
  Heading,
  Icon,
  Image,
  SizableText,
  Stack,
  Switch,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import NotificationsHelpCenterInstruction from '../../Setting/components/NotificationsHelpCenterInstruction';
import NotificationsTestButton from '../../Setting/components/NotificationsTestButton';

function SharedWrapper({ children, ...rest }: IYStackProps) {
  return (
    <YStack
      gap="$2"
      w="100%"
      maxWidth="$96"
      mx="auto"
      p="$2"
      bg="$bgInfoSubdued"
      borderRadius="$3"
      outlineColor="$borderInfoSubdued"
      outlineWidth={1}
      outlineStyle="solid"
      elevation={0.5}
      {...rest}
    >
      {children}
    </YStack>
  );
}

function EnablePushNotificationsTutorial() {
  const intl = useIntl();

  if (platformEnv.isDesktopMac) {
    return (
      <SharedWrapper>
        <XStack
          alignItems="center"
          gap="$2"
          p="$2"
          bg="$bg"
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
            <Heading size="$bodyMd">
              {intl.formatMessage({
                id: ETranslations.notifications_mac_permission_title,
              })}
            </Heading>
            <SizableText size="$bodySm" color="$textSubdued">
              OneKey
            </SizableText>
          </Stack>
          <Switch value size="small" bg="$bgInfoStrong" />
        </XStack>
        <SizableText size="$bodySm" color="$textInfo" textAlign="center">
          {intl.formatMessage({
            id: ETranslations.notifications_intro_mac_desc,
          })}
        </SizableText>
        <Icon
          name="HandDrawRightDownArrowIllus"
          color="$bgInfoStrong"
          position="absolute"
          bottom="$-10"
          right={-56}
          w="$10"
          h="$24"
        />
      </SharedWrapper>
    );
  }

  if (platformEnv.isDesktopWin) {
    <SharedWrapper>
      <XStack
        alignItems="center"
        gap="$2"
        p="$2"
        bg="$bg"
        outlineColor="$neutral3"
        outlineWidth={1}
        outlineStyle="solid"
        borderRadius="$2"
        elevation={10}
      >
        <Icon name="BellOutline" />
        <Stack flex={1}>
          <Heading size="$bodyMd">
            {intl.formatMessage({
              id: ETranslations.global_notifications,
            })}
          </Heading>
          <SizableText size="$bodySm" color="$textSubdued">
            OneKey
          </SizableText>
        </Stack>
        <Switch value size="small" bg="$bgInfoStrong" />
      </XStack>
      <SizableText size="$bodySm" color="$textInfo" textAlign="center">
        {intl.formatMessage({
          id: ETranslations.notifications_windows_notifications_permission_desc,
        })}
      </SizableText>
      <Icon
        name="HandDrawRightDownArrowIllus"
        color="$bgInfoStrong"
        position="absolute"
        bottom="$-10"
        right={-56}
        w="$10"
        h="$24"
      />
    </SharedWrapper>;
  }

  if (platformEnv.isExtension) {
    return (
      <SharedWrapper bg="$bgSubdued" outlineColor="$neutral3">
        <XStack alignItems="center" p="$2" gap="$3">
          <NotificationsHelpCenterInstruction />
          <NotificationsTestButton size="small" />
        </XStack>
      </SharedWrapper>
    );
  }

  return null;
}

export default EnablePushNotificationsTutorial;
