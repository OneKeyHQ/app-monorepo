import type { ReactNode } from 'react';

import { useIntl } from 'react-intl';

import {
  Button,
  Icon,
  IconButton,
  SizableText,
  Stack,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import { useNavigateToYourReferred } from '@onekeyhq/kit/src/views/ReferFriends/pages/YourReferred/hooks';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { ReferFriendsTestIDs } from '../../../testIDs';
import { INVITE_COPY } from '../inviteCopy';

import { InviteReferAnimation } from './InviteReferAnimation';
import { InviteValueLine } from './InviteValueLine';
import { useReferralCodeCard } from './ReferralCodeCard/hooks/useReferralCodeCard';
import { ReferralLinkDropdown } from './ReferralLinkDropdown';
import { PRESSABLE_SURFACE_PROPS } from './useInviteCardStyle';

import type { IInviteValueSummaryResult } from './InviteValueLine';

function InviteLinkField({
  inviteUrl,
  displayUrl,
  trailing,
}: {
  inviteUrl: string;
  displayUrl: string;
  trailing?: ReactNode;
}) {
  return (
    <XStack
      flex={1}
      minHeight={trailing ? 48 : 44}
      ai="center"
      gap="$2"
      pl={trailing ? '$4' : '$3'}
      pr={trailing ? '$1' : '$3'}
      // A pill field matches the pill button it hosts.
      borderRadius={trailing ? '$full' : '$2'}
      borderWidth={1}
      borderColor="$borderSubdued"
      bg="$bgStrong"
    >
      <SizableText flex={1} numberOfLines={1} size="$bodyLg">
        {displayUrl}
      </SizableText>
      <ReferralLinkDropdown inviteUrl={inviteUrl} />
      {trailing}
    </XStack>
  );
}

function InviteCodeLine({
  inviteCode,
  codeLabel,
  manageLabel,
  showManageLabel,
  onCopy,
  onManage,
}: {
  inviteCode: string;
  codeLabel: string;
  manageLabel: string;
  showManageLabel: boolean;
  onCopy: () => void;
  onManage: () => void;
}) {
  return (
    <XStack ai="center" minHeight={32} gap="$2">
      <XStack
        testID={ReferFriendsTestIDs.inviteCodeLine}
        flexShrink={1}
        ai="center"
        gap="$2"
        // Numeric: negative space tokens are not applied here.
        mx={-8}
        px="$2"
        py="$1"
        borderRadius="$2"
        {...PRESSABLE_SURFACE_PROPS}
        onPress={onCopy}
      >
        <SizableText size="$bodyMd" color="$textSubdued">
          {codeLabel}
        </SizableText>
        <SizableText size="$bodyMdMedium" numberOfLines={1} flexShrink={1}>
          {inviteCode}
        </SizableText>
        <Icon name="Copy3Outline" size="$4" color="$iconSubdued" />
      </XStack>
      <Stack flex={1} />
      {showManageLabel ? (
        <Button
          testID={ReferFriendsTestIDs.inviteManageCodes}
          variant="tertiary"
          size="small"
          iconAfter="ChevronRightSmallOutline"
          onPress={onManage}
        >
          {manageLabel}
        </Button>
      ) : (
        <IconButton
          testID={ReferFriendsTestIDs.inviteManageCodes}
          variant="tertiary"
          size="small"
          icon="ChevronRightSmallOutline"
          title={manageLabel}
          onPress={onManage}
        />
      )}
    </XStack>
  );
}

function InviteLinkActions({
  inviteUrl,
  displayUrl,
  copyLabel,
  copyLink,
  shareButton,
  isCompact,
}: {
  inviteUrl: string;
  displayUrl: string;
  copyLabel: string;
  copyLink: () => void;
  shareButton: ReactNode;
  isCompact: boolean;
}) {
  const linkField = (
    <InviteLinkField inviteUrl={inviteUrl} displayUrl={displayUrl} />
  );
  // Native pins the copy action to the page footer, so the hero keeps only
  // the link field and share.
  if (platformEnv.isNative) {
    return (
      <XStack ai="center" gap="$2">
        {linkField}
        {shareButton}
      </XStack>
    );
  }
  const copyButton = (
    <Button
      flex={isCompact ? 1 : undefined}
      variant="primary"
      size="medium"
      onPress={copyLink}
      testID={ReferFriendsTestIDs.copyLinkBtn}
    >
      {copyLabel}
    </Button>
  );

  if (isCompact) {
    return (
      <YStack gap="$2">
        {linkField}
        <XStack ai="center" gap="$2">
          {copyButton}
          {shareButton}
        </XStack>
      </YStack>
    );
  }

  return (
    <InviteLinkField
      inviteUrl={inviteUrl}
      displayUrl={displayUrl}
      trailing={copyButton}
    />
  );
}

// Desktop puts the referral list beside the invite title; compact layouts keep
// it on the earnings card.
function ReferralListLink() {
  const intl = useIntl();
  const navigateToYourReferred = useNavigateToYourReferred();
  return (
    <Button
      testID={ReferFriendsTestIDs.inviteYourReferred}
      variant="tertiary"
      size="small"
      iconAfter="ChevronRightSmallOutline"
      onPress={navigateToYourReferred}
    >
      {intl.formatMessage({ id: ETranslations.referral_referral_list })}
    </Button>
  );
}

export function InviteLinkHero({
  inviteUrl,
  inviteCode,
  onManageCodes,
  valueSummary,
}: {
  inviteUrl: string;
  inviteCode: string;
  onManageCodes: () => void;
  valueSummary: IInviteValueSummaryResult;
}) {
  const intl = useIntl();
  const { md } = useMedia();
  const { handleCopy, copyLink, handleShare, inviteCodeUrl } =
    useReferralCodeCard({
      inviteUrl,
      inviteCode,
    });

  return (
    <YStack gap={md ? '$2' : '$4'}>
      {md ? <InviteReferAnimation /> : null}
      <XStack ai="flex-start" gap="$3">
        <YStack flex={1} gap="$1">
          <SizableText size="$headingLg">{INVITE_COPY.headline}</SizableText>
          <InviteValueLine {...valueSummary} />
        </YStack>
        {md ? null : <ReferralListLink />}
      </XStack>
      <InviteLinkActions
        inviteUrl={inviteUrl}
        displayUrl={inviteCodeUrl}
        copyLabel={INVITE_COPY.copyLink}
        copyLink={copyLink}
        isCompact={md}
        shareButton={
          platformEnv.isNative ? (
            <IconButton
              testID={ReferFriendsTestIDs.inviteShareBtn}
              variant="secondary"
              icon="ShareOutline"
              title={intl.formatMessage({ id: ETranslations.explore_share })}
              onPress={handleShare}
            />
          ) : null
        }
      />
      <InviteCodeLine
        inviteCode={inviteCode}
        codeLabel={intl.formatMessage({
          id: ETranslations.referral_your_code,
        })}
        manageLabel={INVITE_COPY.manageCodes}
        showManageLabel={!md}
        onCopy={handleCopy}
        onManage={onManageCodes}
      />
    </YStack>
  );
}
