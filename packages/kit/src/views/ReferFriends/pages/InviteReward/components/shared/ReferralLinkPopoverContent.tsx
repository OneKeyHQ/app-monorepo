import { useCallback, useMemo } from 'react';
import type { ReactNode } from 'react';

import { useIntl } from 'react-intl';

import {
  Divider,
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
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';

import { buildReferralLinks } from './referralLinks';
import { useReferralWebAppUrl } from './useReferralWebAppUrl';

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
      // The whole row copies; keep the arrow cursor and no text selection
      // over its labels.
      cursor="default"
      userSelect="none"
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
  // Below the links, under a hairline: settings about what the invite pages
  // show, which the invite card's menu carries.
  footer?: ReactNode;
}

export function ReferralLinkPopoverContent({
  inviteUrl,
  footer,
}: IReferralLinkPopoverContentProps) {
  const intl = useIntl();
  const { copyUrl } = useClipboard();
  const { closePopover } = usePopoverContext();
  const webAppUrl = useReferralWebAppUrl();

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
      {footer ? (
        <>
          <Divider mx="$4" my="$1" />
          <YStack px="$4" py="$3">
            {footer}
          </YStack>
        </>
      ) : null}
    </YStack>
  );
}

export const REFERRAL_LINK_POPOVER_WIDTH = 321;
