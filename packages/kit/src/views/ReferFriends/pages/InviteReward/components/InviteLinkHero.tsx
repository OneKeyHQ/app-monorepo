import type { ReactNode } from 'react';

import { useIntl } from 'react-intl';

import {
  Button,
  Divider,
  Icon,
  IconButton,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { useNavigateToYourReferred } from '@onekeyhq/kit/src/views/ReferFriends/pages/YourReferred/hooks';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { CompactFieldRow } from '../../../components/CompactFieldRow';
import { ReferFriendsTestIDs } from '../../../testIDs';

import { CardTextAction } from './CardTextAction';
import { RateLineTrigger } from './InviteValueLine';
import { useReferralCodeCard } from './ReferralCodeCard/hooks/useReferralCodeCard';
import { ReferralLinkDropdown } from './ReferralLinkDropdown';
import {
  INVITE_CARD_BORDER_COLOR,
  POINTER_ROW_BLEED_PROPS,
  PRESSABLE_SURFACE_PROPS,
} from './useInviteCardStyle';

import type { IInviteValueSummaryResult } from './InviteValueLine';
import type { IInviteCardStyle } from './useInviteCardStyle';

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
      // A pill field matches the pill button it hosts. $bgStrong reads on
      // the card in both themes; $bgSubdued matches the dark card.
      borderRadius={trailing ? '$full' : '$2'}
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
  onCopy,
  onManage,
}: {
  inviteCode: string;
  codeLabel: string;
  manageLabel: string;
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
        // Bleed the hover surface so the label stays aligned with the text above.
        {...POINTER_ROW_BLEED_PROPS}
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
      <CardTextAction
        testID={ReferFriendsTestIDs.inviteManageCodes}
        label={manageLabel}
        onPress={onManage}
      />
    </XStack>
  );
}

function InviteLinkActions({
  inviteUrl,
  displayUrl,
  copyLabel,
  copyLink,
  shareButton,
}: {
  inviteUrl: string;
  displayUrl: string;
  copyLabel: string;
  copyLink: () => void;
  shareButton: ReactNode;
}) {
  const linkField = (
    <InviteLinkField inviteUrl={inviteUrl} displayUrl={displayUrl} />
  );
  // Native pins sharing to the page footer, so the hero keeps only the link
  // field and share.
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
      variant="primary"
      size="medium"
      onPress={copyLink}
      testID={ReferFriendsTestIDs.copyLinkBtn}
    >
      {copyLabel}
    </Button>
  );

  return (
    <InviteLinkField
      inviteUrl={inviteUrl}
      displayUrl={displayUrl}
      trailing={copyButton}
    />
  );
}

// Desktop puts the referral list beside the invite title; compact layouts
// keep it on the earnings caption.
export function ReferralListLink() {
  const intl = useIntl();
  const navigateToYourReferred = useNavigateToYourReferred();
  return (
    <CardTextAction
      testID={ReferFriendsTestIDs.inviteYourReferred}
      label={intl.formatMessage({ id: ETranslations.referral_referral_list })}
      onPress={navigateToYourReferred}
    />
  );
}

// Pointer layouts only; compact layouts use InviteCompactCard.
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
  const { handleCopy, copyLink, handleShare, inviteCodeUrl } =
    useReferralCodeCard({
      inviteUrl,
      inviteCode,
    });

  return (
    <YStack gap="$4">
      <XStack ai="flex-start" gap="$3">
        <YStack flex={1} gap="$1">
          <SizableText size="$headingLg">
            {intl.formatMessage({ id: ETranslations.referral_home__title })}
          </SizableText>
          <RateLineTrigger valueSummary={valueSummary} />
        </YStack>
        <ReferralListLink />
      </XStack>
      <InviteLinkActions
        inviteUrl={inviteUrl}
        displayUrl={inviteCodeUrl}
        copyLabel={intl.formatMessage({
          id: ETranslations.referral_copy_link__action,
        })}
        copyLink={copyLink}
        shareButton={
          <IconButton
            testID={ReferFriendsTestIDs.inviteShareBtn}
            variant="secondary"
            icon="ShareOutline"
            title={intl.formatMessage({ id: ETranslations.explore_share })}
            onPress={handleShare}
          />
        }
      />
      <InviteCodeLine
        inviteCode={inviteCode}
        codeLabel={intl.formatMessage({
          id: ETranslations.referral_your_code,
        })}
        manageLabel={intl.formatMessage({
          id: ETranslations.referral_manage_codes__action,
        })}
        onCopy={handleCopy}
        onManage={onManageCodes}
      />
    </YStack>
  );
}

// Compact layouts keep this card to sharing: the code leads, then the link
// with its copy and more-links actions. Sharing itself is the page's main
// action, pinned to the footer.
export function InviteCompactCard({
  inviteUrl,
  inviteCode,
  cardStyle,
  onManageCodes,
}: {
  inviteUrl: string;
  inviteCode: string;
  cardStyle: IInviteCardStyle;
  onManageCodes: () => void;
}) {
  const intl = useIntl();
  const { handleCopy, copyLink, inviteCodeUrl } = useReferralCodeCard({
    inviteUrl,
    inviteCode,
  });
  return (
    // 16px from the text to the card edge on every side, like the other
    // cards (the last row brings 8px of its own); 12px around the divider.
    <YStack px="$4" pt="$4" pb="$2" {...cardStyle}>
      {/* Same header as the earnings card: the label with its one-step-away
          entry beside it, so managing codes needs no row of its own. */}
      <XStack ai="center" jc="space-between" gap="$3">
        <SizableText size="$bodyMd" color="$textSubdued">
          {intl.formatMessage({ id: ETranslations.referral_your_code })}
        </SizableText>
        <CardTextAction
          testID={ReferFriendsTestIDs.inviteManageCodes}
          label={intl.formatMessage({
            id: ETranslations.referral_manage_codes__action,
          })}
          onPress={onManageCodes}
        />
      </XStack>
      {/* The code is what people share and type, so it leads the card; its
          copy action sits on it like the link's, as a quiet icon. */}
      <XStack ai="center" gap="$1" pb="$3">
        <SizableText size="$headingXl" numberOfLines={1} flexShrink={1}>
          {inviteCode}
        </SizableText>
        <IconButton
          testID={ReferFriendsTestIDs.inviteCodeLine}
          variant="tertiary"
          size="small"
          icon="Copy3Outline"
          title={intl.formatMessage({ id: ETranslations.global_copy })}
          onPress={handleCopy}
        />
      </XStack>
      <Divider mb="$1" borderColor={INVITE_CARD_BORDER_COLOR} />
      <CompactFieldRow
        label={intl.formatMessage({ id: ETranslations.referral_referral_link })}
      >
        <SizableText size="$bodyMdMedium" numberOfLines={1} flexShrink={1}>
          {inviteCodeUrl}
        </SizableText>
        <ReferralLinkDropdown inviteUrl={inviteUrl} />
        <IconButton
          testID={ReferFriendsTestIDs.copyLinkBtn}
          variant="tertiary"
          size="small"
          icon="Copy3Outline"
          title={intl.formatMessage({
            id: ETranslations.referral_copy_link__action,
          })}
          onPress={copyLink}
        />
      </CompactFieldRow>
    </YStack>
  );
}
