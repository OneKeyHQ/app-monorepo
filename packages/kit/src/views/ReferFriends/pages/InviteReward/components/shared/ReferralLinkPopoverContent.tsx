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
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';

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

const REFERRAL_LINKS = [
  {
    pathSuffix: '/shop',
    titleId: ETranslations.referral_link_hw_title,
    descId: ETranslations.referral_link_hw_desc,
    useWebAppUrl: false,
  },
  {
    pathSuffix: '/app/defi',
    titleId: ETranslations.referral_link_defi_title,
    descId: ETranslations.referral_link_defi_desc,
    useWebAppUrl: true,
  },
  {
    pathSuffix: '/app/perps',
    titleId: ETranslations.referral_link_perps_title,
    descId: ETranslations.referral_link_perps_desc,
    useWebAppUrl: true,
  },
];

function extractInviteCode(url: string): string | undefined {
  const match = url.match(/\/r\/([^/]+)/);
  return match?.[1];
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

  const links = useMemo(() => {
    const inviteCode = extractInviteCode(inviteUrl);
    return REFERRAL_LINKS.map((link) => ({
      ...link,
      url:
        link.useWebAppUrl && inviteCode
          ? `${webAppUrl}/r/${inviteCode}${link.pathSuffix}`
          : `${inviteUrl}${link.pathSuffix}`,
    }));
  }, [inviteUrl, webAppUrl]);

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
