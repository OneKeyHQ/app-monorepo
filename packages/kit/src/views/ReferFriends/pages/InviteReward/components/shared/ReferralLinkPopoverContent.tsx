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
} from '@onekeyhq/components';
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

function removeHttpsPrefix(url: string): string {
  return url.replace(/^https?:\/\//, '');
}

interface IReferralLinkPopoverContentProps {
  inviteUrl: string;
}

export function ReferralLinkPopoverContent({
  inviteUrl,
}: IReferralLinkPopoverContentProps) {
  const intl = useIntl();
  const { copyText } = useClipboard();

  const walletInviteUrl = useMemo(() => `${inviteUrl}/app`, [inviteUrl]);
  const shopInviteUrl = useMemo(() => `${inviteUrl}/shop`, [inviteUrl]);

  const handleCopyWalletLink = useCallback(() => {
    copyText(walletInviteUrl);
    defaultLogger.referral.page.shareReferralLink('copy');
  }, [copyText, walletInviteUrl]);

  const handleCopyShopLink = useCallback(() => {
    copyText(shopInviteUrl);
    defaultLogger.referral.page.shareReferralLink('copy');
  }, [copyText, shopInviteUrl]);

  return (
    <YStack p="$1" $md={{ pb: '$3' }}>
      <ReferralLinkItem
        title={intl.formatMessage({
          id: ETranslations.referral_link_hw_title,
        })}
        description={intl.formatMessage({
          id: ETranslations.referral_link_hw_desc,
        })}
        displayUrl={removeHttpsPrefix(shopInviteUrl)}
        onCopy={handleCopyShopLink}
      />
      <ReferralLinkItem
        title={intl.formatMessage({
          id: ETranslations.referral_link_onchain_title,
        })}
        description={intl.formatMessage({
          id: ETranslations.referral_link_onchain_desc,
        })}
        displayUrl={removeHttpsPrefix(walletInviteUrl)}
        onCopy={handleCopyWalletLink}
      />
    </YStack>
  );
}

export const REFERRAL_LINK_POPOVER_WIDTH = 321;
