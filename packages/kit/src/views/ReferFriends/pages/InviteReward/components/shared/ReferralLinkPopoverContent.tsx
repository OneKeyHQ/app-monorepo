import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import {
  IconButton,
  SizableText,
  Stack,
  XStack,
  YStack,
  useClipboard,
  useMedia,
  usePopoverContext,
} from '@onekeyhq/components';
import { formatInviteUrlForDisplay } from '@onekeyhq/kit/src/views/ReferFriends/utils';
import { useDevSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/devSettings';
import {
  WEB_APP_URL,
  WEB_APP_URL_DEV,
} from '@onekeyhq/shared/src/config/appConfig';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';

import { buildReferralLinks } from './referralLinks';

interface IReferralLinkItemProps {
  title: string;
  description: string;
  displayUrl: string;
  onCopy: () => void;
}

function ReferralLinkItem({
  title,
  description,
  displayUrl,
  onCopy,
}: IReferralLinkItemProps) {
  const { md } = useMedia();

  return (
    <XStack
      gap="$2.5"
      px="$4"
      py="$2"
      alignItems="center"
      borderRadius="$3"
      borderCurve="continuous"
      onPress={onCopy}
      {...(!md && {
        hoverStyle: {
          bg: '$bgHover',
        },
        pressStyle: {
          bg: '$bgActive',
        },
      })}
    >
      <YStack flex={1} gap="$0.5">
        <SizableText size="$headingSm">{title}</SizableText>
        <SizableText size="$bodyMd" color="$textSubdued">
          {description}
        </SizableText>
        <Stack
          borderWidth={1}
          borderColor="$borderSubdued"
          borderRadius="$1"
          px="$1"
          py="$0.5"
          alignSelf="flex-start"
          mt="$0.5"
        >
          <SizableText size="$bodySmMedium" color="$textDisabled">
            {displayUrl}
          </SizableText>
        </Stack>
      </YStack>
      <IconButton
        testID="refer-friends-icon-btn"
        icon="Copy3Outline"
        variant="tertiary"
        size="small"
        iconProps={{ color: '$iconDisabled' }}
        onPress={onCopy}
      />
    </XStack>
  );
}

interface IReferralLinkPopoverContentProps {
  inviteUrl: string;
}

export function ReferralLinkPopoverContent({
  inviteUrl,
}: IReferralLinkPopoverContentProps) {
  const intl = useIntl();
  const { copyUrl } = useClipboard();
  const { closePopover } = usePopoverContext();
  const [devSettings] = useDevSettingsPersistAtom();

  const webAppUrl = useMemo(() => {
    const useTestUrl =
      devSettings.enabled && devSettings.settings?.enableTestEndpoint;
    return useTestUrl ? WEB_APP_URL_DEV : WEB_APP_URL;
  }, [devSettings.enabled, devSettings.settings?.enableTestEndpoint]);

  const handleCopyLink = useCallback(
    (url: string) => {
      copyUrl(url);
      defaultLogger.referral.page.shareReferralLink('copy');
      void closePopover?.();
    },
    [closePopover, copyUrl],
  );

  const links = useMemo(
    () => buildReferralLinks({ inviteUrl, webAppUrl }),
    [inviteUrl, webAppUrl],
  );

  return (
    <YStack p="$1" $md={{ pb: '$3' }}>
      {links.map((link) => (
        <ReferralLinkItem
          key={link.pathSuffix}
          title={intl.formatMessage({ id: link.titleId })}
          description={intl.formatMessage({ id: link.descId })}
          displayUrl={formatInviteUrlForDisplay(link.url)}
          onCopy={() => handleCopyLink(link.url)}
        />
      ))}
    </YStack>
  );
}

export const REFERRAL_LINK_POPOVER_WIDTH = 321;
