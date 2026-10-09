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
  useMedia,
} from '@onekeyhq/components';
import { useNavigateToYourReferred } from '@onekeyhq/kit/src/views/ReferFriends/pages/YourReferred/hooks';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { ReferFriendsTestIDs } from '../../../testIDs';
import { INVITE_COPY } from '../inviteCopy';

import { InviteValueLine, RatePopover } from './InviteValueLine';
import { useReferralCodeCard } from './ReferralCodeCard/hooks/useReferralCodeCard';
import { ReferralLinkDropdown } from './ReferralLinkDropdown';
import {
  INVITE_CARD_BORDER_COLOR,
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
        // Bleed the hover surface so the label stays aligned with the text above.
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

// One label/value line of the compact invite card; the value side holds the
// figure and its inline actions (copy, more links). These rows show facts
// rather than open pages, so they sit tighter than the 44px list rows: 8px
// above and below the text, 16px between lines.
function InviteFieldRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <XStack ai="center" gap="$3" minHeight={36}>
      <SizableText size="$bodyMd" color="$textSubdued" flexShrink={0}>
        {label}
      </SizableText>
      <XStack flex={1} minWidth={0} ai="center" jc="flex-end" gap="$1">
        {children}
      </XStack>
    </XStack>
  );
}

// Compact layouts keep this card to sharing: the code leads, then the link
// and rates as label/value rows with copy beside each value.
// Sharing itself is the page's main action, pinned to the footer.
export function InviteCompactCard({
  inviteUrl,
  inviteCode,
  valueSummary,
  cardStyle,
  levelValue,
  onManageCodes,
}: {
  inviteUrl: string;
  inviteCode: string;
  valueSummary: IInviteValueSummaryResult;
  cardStyle: IInviteCardStyle;
  // The level sits right above the rates it sets.
  levelValue?: ReactNode;
  onManageCodes: () => void;
}) {
  const intl = useIntl();
  const { handleCopy, copyLink, inviteCodeUrl } = useReferralCodeCard({
    inviteUrl,
    inviteCode,
  });
  const { summary } = valueSummary;
  const rateValue = summary
    ? `${summary.isUniform ? '' : `${INVITE_COPY.upTo} `}${summary.rate} / ${
        summary.friendRate ?? '0%'
      }`
    : null;

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
        <Button
          testID={ReferFriendsTestIDs.inviteManageCodes}
          variant="tertiary"
          size="small"
          iconAfter="ChevronRightSmallOutline"
          onPress={onManageCodes}
        >
          {INVITE_COPY.manageCodes}
        </Button>
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
      <InviteFieldRow
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
          title={INVITE_COPY.copyLink}
          onPress={copyLink}
        />
      </InviteFieldRow>
      {levelValue ? (
        <InviteFieldRow
          label={intl.formatMessage({
            id: ETranslations.referral_referral_level,
          })}
        >
          {levelValue}
        </InviteFieldRow>
      ) : null}
      {rateValue ? (
        <InviteFieldRow label={INVITE_COPY.rateLabel}>
          <RatePopover
            valueSummary={valueSummary}
            trigger={
              <XStack ai="center" gap="$1">
                <SizableText size="$bodyMdMedium" color="$textSuccess">
                  {rateValue}
                </SizableText>
                <Icon name="InfoCircleOutline" size="$5" color="$iconSubdued" />
              </XStack>
            }
          />
        </InviteFieldRow>
      ) : null}
    </YStack>
  );
}

// Compact layouts: the caption over the invite card, with the referral list
// (the people its codes brought in) on the right, like Payout history on
// the earnings card.
export function InviteOverviewCaption() {
  const intl = useIntl();
  const navigateToYourReferred = useNavigateToYourReferred();

  return (
    <XStack ai="center" jc="space-between" gap="$3">
      <SizableText size="$bodyMdMedium" color="$textSubdued">
        {intl.formatMessage({ id: ETranslations.global_overview })}
      </SizableText>
      <Button
        testID={ReferFriendsTestIDs.inviteYourReferred}
        variant="tertiary"
        size="small"
        iconAfter="ChevronRightSmallOutline"
        onPress={navigateToYourReferred}
      >
        {intl.formatMessage({ id: ETranslations.referral_referral_list })}
      </Button>
    </XStack>
  );
}
