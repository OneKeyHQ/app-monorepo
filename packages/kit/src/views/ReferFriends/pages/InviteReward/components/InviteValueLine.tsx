import { useMemo } from 'react';
import type { ReactElement } from 'react';

import { useIntl } from 'react-intl';

import {
  Icon,
  Image,
  Popover,
  SizableText,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import { CardTextAction } from '@onekeyhq/kit/src/views/ReferFriends/pages/InviteReward/components/CardTextAction';
import { useNavigateToReferralLevel } from '@onekeyhq/kit/src/views/ReferFriends/pages/ReferralLevel/hooks/useNavigateToReferralLevel';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IInviteLevelDetail } from '@onekeyhq/shared/src/referralCode/type';

import { ReferFriendsTestIDs } from '../../../testIDs';

import { useCurrentLevelCardFromDetail } from './CurrentLevelCard/hooks/useCurrentLevelCard';
import {
  getInviteValueSummary,
  selectInviteValueLineItems,
} from './getInviteValueLine';
import { INVITE_POPOVER_PANEL_PROPS } from './useInviteCardStyle';

import type { ICurrentLevelCardProps } from './CurrentLevelCard/types';
import type {
  IInviteValueRow,
  IInviteValueSummary,
} from './getInviteValueLine';

function RateBreakdown({
  title,
  titleIcon,
  rows,
  youLabel,
  friendLabel,
  onOpenLevels,
}: {
  // Desktop popovers have no header bar, so the title opens the content; the
  // compact sheet shows it in its own header instead.
  title?: string;
  titleIcon?: string;
  rows: IInviteValueRow[];
  youLabel: string;
  friendLabel: string;
  onOpenLevels: () => void;
}) {
  const intl = useIntl();
  return (
    <YStack px="$5" py="$4" gap="$2">
      {title ? (
        <XStack ai="center" gap="$2" pb="$1">
          {titleIcon ? <Image w="$4" h="$4" src={titleIcon} /> : null}
          <SizableText size="$bodyMdMedium">{title}</SizableText>
        </XStack>
      ) : null}
      <XStack gap="$3">
        <SizableText
          flex={1}
          flexBasis={0}
          minWidth={0}
          size="$bodySmMedium"
          color="$textSubdued"
        >
          {intl.formatMessage({ id: ETranslations.referral_product__title })}
        </SizableText>
        <SizableText
          w={64}
          flexShrink={0}
          size="$bodySmMedium"
          color="$textSubdued"
          ta="right"
        >
          {youLabel}
        </SizableText>
        <SizableText
          w={88}
          flexShrink={0}
          size="$bodySmMedium"
          color="$textSubdued"
          ta="right"
        >
          {friendLabel}
        </SizableText>
      </XStack>
      {rows.map((row) => (
        // Fixed value columns; a long product name wraps rather than
        // squeezing them out of line.
        <XStack key={row.subject} gap="$3" ai="flex-start">
          <SizableText flex={1} flexBasis={0} minWidth={0} size="$bodyMd">
            {intl.formatMessage({ id: row.labelId })}
          </SizableText>
          <SizableText w={64} flexShrink={0} size="$bodyMdMedium" ta="right">
            {row.you}
          </SizableText>
          <SizableText
            w={88}
            flexShrink={0}
            size="$bodyMdMedium"
            color={row.friend ? '$text' : '$textDisabled'}
            ta="right"
          >
            {row.friend ?? '—'}
          </SizableText>
        </XStack>
      ))}
      <XStack pt="$2">
        <CardTextAction
          testID={ReferFriendsTestIDs.inviteAllLevelsBtn}
          label={intl.formatMessage({
            id: ETranslations.referral_level_details__action,
          })}
          onPress={onOpenLevels}
        />
      </XStack>
    </YStack>
  );
}

export function useInviteValueSummary({
  levelDetail,
  ...props
}: ICurrentLevelCardProps & { levelDetail: IInviteLevelDetail | undefined }) {
  const { levelLabel, levelIcon, commissionRates } =
    useCurrentLevelCardFromDetail(props, levelDetail);
  const summary = useMemo(() => {
    const items = selectInviteValueLineItems({
      commissionRates: commissionRates.map((item) => ({
        subject: item.subject,
        you: item.rate.you,
        invitee: item.rate.invitee,
        enabled: item.rate.enabled,
      })),
      configs: props.rebateConfig.configs,
    });
    return getInviteValueSummary(items);
  }, [commissionRates, props.rebateConfig.configs]);
  return { levelLabel, levelIcon, summary };
}

// Names every paying product in one line; the rate opens the per-product
// split (hover on desktop, a sheet on compact screens).
export type IInviteValueSummaryResult = ReturnType<
  typeof useInviteValueSummary
>;

// The per-product rate split behind any trigger: hover on desktop, a bottom
// sheet on compact screens.
function RatePopover({
  valueSummary,
  trigger,
}: {
  valueSummary: IInviteValueSummaryResult;
  trigger: ReactElement;
}) {
  const intl = useIntl();
  const navigateToReferralLevel = useNavigateToReferralLevel();
  const { gtMd } = useMedia();
  const { levelLabel, levelIcon, summary } = valueSummary;
  const title = intl.formatMessage(
    { id: ETranslations.referral_level_rates__title },
    { level: levelLabel },
  );

  if (!summary) {
    return trigger;
  }

  return (
    <Popover
      title={title}
      hoverable
      placement="bottom-start"
      floatingPanelProps={INVITE_POPOVER_PANEL_PROPS}
      renderTrigger={trigger}
      renderContent={({ closePopover }) => (
        <RateBreakdown
          title={gtMd ? title : undefined}
          titleIcon={levelIcon}
          rows={summary.rows}
          youLabel={intl.formatMessage({
            id: ETranslations.referral_upgrade_you,
          })}
          friendLabel={intl.formatMessage({
            id: ETranslations.referral_upgrade_user,
          })}
          onOpenLevels={() => {
            closePopover();
            void navigateToReferralLevel();
          }}
        />
      )}
    />
  );
}

// "You earn 10% · Invitees save 10% (i)" as one sentence, with the figures
// in green. Products with different rates read "up to"; without an invitee
// discount only the referrer's part shows. The info icon sits inside the
// text, after the last word (as in the verification email hint), so it
// follows the sentence however it wraps.
function RateLine({
  summary,
  textAlign,
}: {
  summary: IInviteValueSummary;
  textAlign?: 'center';
}) {
  const intl = useIntl();
  const highlight = (value: string) => (
    <SizableText size="$bodyMd" fontWeight="600" color="$textSuccess">
      {value}
    </SizableText>
  );
  let id: ETranslations;
  if (summary.friendRate) {
    id = summary.isUniform
      ? ETranslations.referral_rate_line__desc
      : ETranslations.referral_rate_line_up_to__desc;
  } else {
    id = summary.isUniform
      ? ETranslations.referral_you_earn__desc
      : ETranslations.referral_you_earn_up_to__desc;
  }
  return (
    <SizableText size="$bodyMd" color="$textSubdued" textAlign={textAlign}>
      {intl.formatMessage(
        { id },
        {
          rate: highlight(summary.rate),
          inviteeRate: highlight(summary.friendRate ?? ''),
        },
      )}
      {'\u00A0'}
      <Icon
        name="InfoCircleOutline"
        size="$4"
        color="$iconSubdued"
        pointerEvents="none"
        // Inline views sit on the baseline; this centers the icon on the
        // line.
        transform={[{ translateY: 3 }]}
      />
    </SizableText>
  );
}

// The rate line, opening the per-product breakdown.
export function RateLineTrigger({
  valueSummary,
  testID,
  centered = false,
}: {
  valueSummary: IInviteValueSummaryResult;
  testID?: string;
  centered?: boolean;
}) {
  const { summary } = valueSummary;
  if (!summary) {
    return null;
  }
  return (
    <RatePopover
      valueSummary={valueSummary}
      trigger={
        <XStack
          testID={testID}
          jc={centered ? 'center' : undefined}
          cursor="default"
        >
          <RateLine
            summary={summary}
            textAlign={centered ? 'center' : undefined}
          />
        </XStack>
      }
    />
  );
}
