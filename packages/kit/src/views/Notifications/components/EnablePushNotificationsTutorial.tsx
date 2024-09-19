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

function PlatformNotification({
  icon,
  titleId,
  descriptionId,
}: {
  icon: React.ReactNode;
  titleId: ETranslations;
  descriptionId: ETranslations;
}) {
  const intl = useIntl();

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
        {icon}
        <Stack flex={1}>
          <Heading size="$bodyMd">
            {intl.formatMessage({
              id: titleId,
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
          id: descriptionId,
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

function EnablePushNotificationsTutorial() {
  if (platformEnv.isDesktopMac) {
    return (
      <PlatformNotification
        icon={
          <Image
            source={require('@onekeyhq/kit/assets/logo-decorated.png')}
            w="$8"
            h="$8"
          />
        }
        titleId={ETranslations.notifications_mac_permission_title}
        descriptionId={ETranslations.notifications_intro_mac_desc}
      />
    );
  }

  if (platformEnv.isDesktopWin) {
    return (
      <PlatformNotification
        icon={<Icon name="BellOutline" />}
        titleId={ETranslations.global_notifications}
        descriptionId={
          ETranslations.notifications_windows_notifications_permission_desc
        }
      />
    );
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
