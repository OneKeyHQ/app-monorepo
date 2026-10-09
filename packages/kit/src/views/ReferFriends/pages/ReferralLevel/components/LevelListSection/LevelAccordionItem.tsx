import { Fragment, useMemo } from 'react';
import type { ReactNode } from 'react';

import BigNumber from 'bignumber.js';
import { type IntlShape, useIntl } from 'react-intl';

import {
  Accordion,
  Badge,
  Icon,
  Image,
  SizableText,
  Stack,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import { ANIMATE_ONLY_TRANSFORM } from '@onekeyhq/components/src/utils/animationConstants';
import { useCurrency } from '@onekeyhq/kit/src/components/Currency';
import {
  INVITE_CARD_BORDER_COLOR,
  PRESSABLE_SURFACE_PROPS,
} from '@onekeyhq/kit/src/views/ReferFriends/pages/InviteReward/components/useInviteCardStyle';
import {
  formatCommissionRateText,
  getDisplayLabel,
  sortCommissionRateItems,
} from '@onekeyhq/kit/src/views/ReferFriends/utils';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  IInviteLevelCommissionRate,
  IInviteLevelDetail,
  IInviteLevelUpgradeCondition,
} from '@onekeyhq/shared/src/referralCode/type';

import { getLevelCommissionRateItems } from '../../getLevelOverview';
import { LEVEL_SUBJECT_SHORT_LABEL_IDS } from '../../levelCopy';

import { CommissionRateCard } from './CommissionRateCard';
import { OrDivider } from './OrDivider';
import {
  SubjectMilestoneCard,
  formatFiatCompact,
} from './SubjectMilestoneCard';

// Compact layouts read each level as one small table: a row per product
// with what keeps the level, what upgrades from it, and what it pays. The
// user's own progress lives in the status card above, so it is not repeated
// per level.
// Header labels wrap to a second line past this width instead of widening
// their column; figures never wrap or truncate.
const RULE_HEADER_MAX_WIDTH = 80;
const RULE_HEADER_HEIGHT = 32;
const RULE_ROW_HEIGHT = 32;

interface ILevelRuleRow {
  subject: string;
  label: string;
  keep?: string;
  upgrade?: string;
  rate?: string;
}

// A level's icon (or emoji) at header size, so each column names the level
// it is about without spelling it out.
function LevelGlyph({ icon, emoji }: { icon?: string; emoji?: string }) {
  if (icon) {
    return <Image w="$3.5" h="$3.5" src={icon} />;
  }
  return emoji ? <SizableText size="$bodySm">{emoji}</SizableText> : null;
}

// One figure column, laid out top to bottom so it takes the width of its
// widest value: currency symbols and localized figures vary in length
// ("$8K", "Rp15,6M"), and a figure must never be cut off. Fixed-height
// cells keep the columns' rows aligned with the label column.
function RuleColumn({
  header,
  glyph,
  values,
}: {
  header: string;
  glyph?: ReactNode;
  values: (string | undefined)[];
}) {
  return (
    // Starts at its widest value and takes an equal share of any spare
    // width, so the figures spread across the row instead of bunching on
    // the right; it never shrinks below its content.
    <YStack flexGrow={1} flexShrink={0} flexBasis="auto" ai="flex-end">
      <XStack h={RULE_HEADER_HEIGHT} ai="flex-end" jc="flex-end" gap="$1">
        <SizableText
          size="$bodySm"
          color="$textSubdued"
          textAlign="right"
          numberOfLines={2}
          maxWidth={RULE_HEADER_MAX_WIDTH}
        >
          {header}
        </SizableText>
        {glyph}
      </XStack>
      {values.map((value, index) => (
        <XStack key={index} h={RULE_ROW_HEIGHT} ai="center">
          <SizableText
            size="$bodyMdMedium"
            color={value ? '$text' : '$textSubdued'}
            numberOfLines={1}
          >
            {value ?? '–'}
          </SizableText>
        </XStack>
      ))}
    </YStack>
  );
}

function LevelRuleTable({
  rows,
  level,
  nextLevel,
}: {
  rows: ILevelRuleRow[];
  level: { icon?: string; emoji?: string };
  nextLevel?: { icon?: string; emoji?: string };
}) {
  const intl = useIntl();
  const hasKeep = rows.some((row) => row.keep);
  const hasUpgrade = rows.some((row) => row.upgrade);
  return (
    // Headers name the level each column is about by its icon (keep this
    // one, reach the next) and spell out whose rate is whose. Spare width is
    // shared by all four columns; only the product names give way when space
    // runs out.
    <XStack gap="$3">
      <YStack flexGrow={1} flexShrink={1} flexBasis="auto" minWidth={0}>
        <Stack h={RULE_HEADER_HEIGHT} />
        {rows.map((row) => (
          <XStack key={row.subject} h={RULE_ROW_HEIGHT} ai="center">
            <SizableText size="$bodyMd" color="$textSubdued" numberOfLines={1}>
              {row.label}
            </SizableText>
          </XStack>
        ))}
      </YStack>
      {hasKeep ? (
        <RuleColumn
          header={intl.formatMessage({
            id: ETranslations.referral_keep__title,
          })}
          glyph={<LevelGlyph icon={level.icon} emoji={level.emoji} />}
          values={rows.map((row) => row.keep)}
        />
      ) : null}
      {hasUpgrade ? (
        <RuleColumn
          header={intl.formatMessage({
            id: ETranslations.referral_reach__title,
          })}
          glyph={
            nextLevel ? (
              <LevelGlyph icon={nextLevel.icon} emoji={nextLevel.emoji} />
            ) : null
          }
          values={rows.map((row) => row.upgrade)}
        />
      ) : null}
      <RuleColumn
        header={intl.formatMessage({
          id: ETranslations.referral_rate_column__title,
        })}
        values={rows.map((row) => row.rate)}
      />
    </XStack>
  );
}

function getCommissionRateLabel(
  intl: IntlShape,
  subject: string,
  rate: IInviteLevelCommissionRate,
): string {
  return getDisplayLabel(
    intl,
    rate.commissionRatesLabelKey || rate.labelKey,
    rate.commissionRatesLabel ?? rate.label ?? subject,
  );
}

export function LevelAccordionItem({
  level,
  isCurrent,
  isLast,
  isHighestLevel,
  isLowestLevel,
  retentionConditions,
  nextLevelLabel,
  nextLevelGlyph,
}: {
  level: IInviteLevelDetail['levels'][0];
  isCurrent: boolean;
  isLast: boolean;
  isHighestLevel: boolean;
  isLowestLevel: boolean;
  retentionConditions?: IInviteLevelUpgradeCondition[];
  nextLevelLabel?: string;
  nextLevelGlyph?: { icon?: string; emoji?: string };
}) {
  const intl = useIntl();
  const { md } = useMedia();
  const commissionRateItems = useMemo(
    () => getLevelCommissionRateItems(level.commissionRates),
    [level.commissionRates],
  );

  const subjectGroups = useMemo(() => {
    const map = new Map<
      string,
      {
        upgrade?: IInviteLevelUpgradeCondition;
        retention?: IInviteLevelUpgradeCondition;
      }
    >();
    if (!isHighestLevel) {
      for (const condition of level.upgradeConditions) {
        map.set(condition.subject, {
          ...map.get(condition.subject),
          upgrade: condition,
        });
      }
    }
    if (!isLowestLevel && retentionConditions) {
      for (const condition of retentionConditions) {
        map.set(condition.subject, {
          ...map.get(condition.subject),
          retention: condition,
        });
      }
    }
    const items = Array.from(map.entries()).map(([subject, milestones]) => {
      const reference = milestones.upgrade ?? milestones.retention;
      const subjectLabel = getDisplayLabel(
        intl,
        reference?.levelUpLabelKey,
        reference?.levelUpLabel ?? reference?.label ?? subject,
      );
      return { subject, milestones, subjectLabel };
    });
    return sortCommissionRateItems(items);
  }, [
    intl,
    level.upgradeConditions,
    retentionConditions,
    isHighestLevel,
    isLowestLevel,
  ]);

  const isMultiSubject = subjectGroups.length > 1;
  const currencySymbol = useCurrency().symbol;
  const ruleRows = useMemo(() => {
    // Only compact layouts show the rule table.
    if (!md) {
      return [];
    }
    const formatThreshold = (condition: IInviteLevelUpgradeCondition) =>
      `${currencySymbol}${formatFiatCompact(
        new BigNumber(condition.thresholdFiatValue ?? 0),
      )}`;
    const bySubject = new Map<string, ILevelRuleRow>();
    const rowFor = (subject: string, fallbackLabel: string) => {
      const existing = bySubject.get(subject);
      if (existing) {
        return existing;
      }
      const labelId = LEVEL_SUBJECT_SHORT_LABEL_IDS[subject];
      const row: ILevelRuleRow = {
        subject,
        label: labelId ? intl.formatMessage({ id: labelId }) : fallbackLabel,
      };
      bySubject.set(subject, row);
      return row;
    };
    for (const { subject, milestones, subjectLabel } of subjectGroups) {
      const row = rowFor(subject, subjectLabel);
      if (milestones.retention) {
        row.keep = formatThreshold(milestones.retention);
      }
      if (milestones.upgrade) {
        row.upgrade = formatThreshold(milestones.upgrade);
      }
    }
    commissionRateItems.forEach(({ subject, rate }, index) => {
      const row = rowFor(
        subject || `${index}`,
        getCommissionRateLabel(intl, subject, rate),
      );
      row.rate = formatCommissionRateText({
        rebate: rate.rebate,
        discount: rate.discount,
      });
    });
    // Earn and Onchain share the DeFi name: fold them into one row, the first
    // one's figures leading and the other filling any cell the first lacks,
    // so a threshold or rate set on only one of them is not lost.
    const byLabel = new Map<string, ILevelRuleRow>();
    for (const row of sortCommissionRateItems(Array.from(bySubject.values()))) {
      const existing = byLabel.get(row.label);
      if (existing) {
        existing.keep ??= row.keep;
        existing.upgrade ??= row.upgrade;
        existing.rate ??= row.rate;
      } else {
        byLabel.set(row.label, row);
      }
    }
    return Array.from(byLabel.values());
  }, [commissionRateItems, currencySymbol, intl, md, subjectGroups]);
  let headerNode: React.ReactNode = null;
  if (isMultiSubject) {
    headerNode = (
      // Same wording as the level card above, so the rule reads one way.
      <SizableText size="$bodyMdMedium" color="$text">
        {intl.formatMessage({ id: ETranslations.referral_meet_any__desc })}
      </SizableText>
    );
  } else if (subjectGroups.length === 1) {
    const only = subjectGroups[0];
    const titleId =
      only.milestones.retention && !only.milestones.upgrade
        ? ETranslations.referral_level_maintenance_conditions
        : ETranslations.referral_level_upgrade_conditions;
    headerNode = (
      <SizableText size="$bodyMdMedium" color="$text">
        {intl.formatMessage({ id: titleId })}
      </SizableText>
    );
  }

  return (
    <Accordion.Item value={`level-${level.level}`}>
      {/* Unstyled: the default trigger keeps a focus background after a
          click, which reads as a stuck hover. */}
      <Accordion.Trigger
        unstyled
        w="100%"
        borderWidth={0}
        p={0}
        bg="$transparent"
        {...PRESSABLE_SURFACE_PROPS}
      >
        {({ open }: { open: boolean }) => (
          <XStack
            flex={1}
            ai="center"
            jc="space-between"
            py="$3.5"
            px="$5"
            // Phones inset the row (and so its divider) 16px from the card
            // edges, like the dividers in the page's other cards.
            $md={{ px: 0, mx: '$4' }}
            borderColor={INVITE_CARD_BORDER_COLOR}
            // An open row flows into its content; the content's bottom edge
            // separates it from the next level instead.
            borderBottomWidth={open || isLast ? 0 : 1}
            borderTopWidth={0}
            borderRightWidth={0}
            borderLeftWidth={0}
          >
            <XStack flex={1} gap="$3" ai="center">
              <Stack borderRadius="$2" w="$6" h="$6" ai="center" jc="center">
                {level.icon ? (
                  <Image w="$6" h="$6" src={level.icon} />
                ) : (
                  <SizableText size="$bodyLg">{level.emoji ?? ''}</SizableText>
                )}
              </Stack>
              <XStack gap="$2" ai="center">
                <SizableText size="$bodyLgMedium">{level.label}</SizableText>
                {isCurrent ? (
                  <Badge badgeSize="sm">
                    {intl.formatMessage({
                      id: ETranslations.referral_current_level,
                    })}
                  </Badge>
                ) : null}
              </XStack>
            </XStack>
            <Stack
              transition="quick"
              animateOnly={ANIMATE_ONLY_TRANSFORM}
              rotate={open ? '180deg' : '0deg'}
            >
              <Icon
                name="ChevronDownSmallOutline"
                color={open ? '$iconActive' : '$iconSubdued'}
                size="$5"
              />
            </Stack>
          </XStack>
        )}
      </Accordion.Trigger>
      <Accordion.HeightAnimator transition="quick">
        <Accordion.Content
          borderBottomWidth={isLast ? 0 : 1}
          borderTopWidth={0}
          borderRightWidth={0}
          borderLeftWidth={0}
          unstyled
          borderBottomColor={INVITE_CARD_BORDER_COLOR}
          px="$5"
          pt="$1"
          pb="$5"
          $md={{ px: 0, mx: '$4', pb: '$4' }}
        >
          {md ? (
            <YStack gap="$2">
              {subjectGroups.length > 0 ? (
                <SizableText size="$bodyMd" color="$textSubdued">
                  {isMultiSubject
                    ? intl.formatMessage({
                        id: ETranslations.referral_table_rule__desc,
                      })
                    : intl.formatMessage({
                        id: ETranslations.referral_table_rule_single__desc,
                      })}
                </SizableText>
              ) : null}
              <LevelRuleTable
                rows={ruleRows}
                level={level}
                nextLevel={nextLevelGlyph}
              />
            </YStack>
          ) : (
            <YStack gap="$4">
              {subjectGroups.length > 0 ? (
                <YStack gap="$3">
                  {headerNode}
                  <XStack gap="$2" ai="stretch">
                    {subjectGroups.map(
                      ({ subject, milestones, subjectLabel }, index) => (
                        <Fragment key={subject}>
                          <SubjectMilestoneCard
                            subjectLabel={subjectLabel}
                            milestones={milestones}
                            nextLevelLabel={nextLevelLabel}
                          />
                          {index < subjectGroups.length - 1 ? (
                            <OrDivider />
                          ) : null}
                        </Fragment>
                      ),
                    )}
                  </XStack>
                </YStack>
              ) : null}

              <YStack gap="$2">
                <SizableText size="$bodyMdMedium">
                  {intl.formatMessage({
                    id: ETranslations.referral_rates__title,
                  })}
                </SizableText>

                <XStack gap="$3">
                  {commissionRateItems.map(({ subject, rate }, index) => {
                    const label = getCommissionRateLabel(intl, subject, rate);
                    return (
                      <CommissionRateCard
                        key={subject || `${index}`}
                        label={label}
                        rate={rate}
                      />
                    );
                  })}
                </XStack>
              </YStack>
            </YStack>
          )}
        </Accordion.Content>
      </Accordion.HeightAnimator>
    </Accordion.Item>
  );
}
