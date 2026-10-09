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
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { useNavigateToYourReferred } from '@onekeyhq/kit/src/views/ReferFriends/pages/YourReferred/hooks';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { ReferFriendsTestIDs } from '../../../testIDs';
import { INVITE_COPY } from '../inviteCopy';

import { InviteValueLine, RatePopover } from './InviteValueLine';
import { useReferralCodeCard } from './ReferralCodeCard/hooks/useReferralCodeCard';
import { ReferralLinkDropdown } from './ReferralLinkDropdown';
import { openReferralRules } from './RulesButton';
import {
  COMPACT_ENTRY_TITLE_PROPS,
  COMPACT_ROW_BLEED_PROPS,
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
// figure and its inline actions (copy, more links).
function InviteFieldRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <XStack ai="center" gap="$3" minHeight={44}>
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
}: {
  inviteUrl: string;
  inviteCode: string;
  valueSummary: IInviteValueSummaryResult;
  cardStyle: IInviteCardStyle;
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
    <YStack px="$4" pt="$4" pb="$1" {...cardStyle}>
      {/* The code is what people share and type, so it leads the card at
          display size; the link and rates follow as detail rows. */}
      <XStack ai="center" gap="$3" pb="$3">
        <YStack flex={1} minWidth={0}>
          <SizableText size="$bodyMd" color="$textSubdued">
            {intl.formatMessage({ id: ETranslations.referral_your_code })}
          </SizableText>
          {/* Below the unpaid amount: the page title and the money lead,
              the code reads as the card's value. */}
          <SizableText size="$headingXl" numberOfLines={1}>
            {inviteCode}
          </SizableText>
        </YStack>
        <Button
          testID={ReferFriendsTestIDs.inviteCodeLine}
          variant="secondary"
          size="small"
          icon="Copy3Outline"
          onPress={handleCopy}
        >
          {intl.formatMessage({ id: ETranslations.global_copy })}
        </Button>
      </XStack>
      <Divider borderColor={INVITE_CARD_BORDER_COLOR} />
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

// Compact layouts: the pages behind the invite card (codes, people invited)
// and the rules, as plain drill-in rows in their own card. The level holds
// the header's right slot, so the rules live here.
export function InviteEntriesCard({
  cardStyle,
  onManageCodes,
}: {
  cardStyle: IInviteCardStyle;
  onManageCodes: () => void;
}) {
  const intl = useIntl();
  const navigateToYourReferred = useNavigateToYourReferred();

  return (
    <YStack px="$4" py="$1" {...cardStyle}>
      <ListItem
        testID={ReferFriendsTestIDs.inviteManageCodes}
        {...COMPACT_ROW_BLEED_PROPS}
        titleProps={COMPACT_ENTRY_TITLE_PROPS}
        title={INVITE_COPY.manageCodes}
        drillIn
        onPress={onManageCodes}
      />
      <ListItem
        testID={ReferFriendsTestIDs.inviteYourReferred}
        {...COMPACT_ROW_BLEED_PROPS}
        titleProps={COMPACT_ENTRY_TITLE_PROPS}
        title={intl.formatMessage({ id: ETranslations.referral_referral_list })}
        drillIn
        onPress={navigateToYourReferred}
      />
      <ListItem
        testID={ReferFriendsTestIDs.rulesBtn}
        {...COMPACT_ROW_BLEED_PROPS}
        titleProps={COMPACT_ENTRY_TITLE_PROPS}
        title={intl.formatMessage({ id: ETranslations.referral_global_rules })}
        drillIn
        onPress={openReferralRules}
      />
    </YStack>
  );
}
