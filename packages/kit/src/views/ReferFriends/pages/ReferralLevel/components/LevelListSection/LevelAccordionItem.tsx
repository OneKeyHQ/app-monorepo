import { Fragment, useMemo } from 'react';

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
  sortCommissionRateItems,
} from '@onekeyhq/kit/src/views/ReferFriends/utils';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  IInviteLevelDetail,
  IInviteLevelUpgradeCondition,
} from '@onekeyhq/shared/src/referralCode/type';

import { getLevelCommissionRateItems } from '../../getLevelOverview';
import { LEVEL_COPY } from '../../levelCopy';

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
const SHORT_SUBJECT_LABELS: Record<string, string> = {
  HardwareSales: 'Hardware',
  Perp: 'Perps',
  Swap: 'Swap',
  Earn: 'DeFi',
  Onchain: 'DeFi',
};

const RULE_COLUMN_WIDTHS = { keep: 56, upgrade: 64, rate: 84 } as const;

interface ILevelRuleRow {
  subject: string;
  label: string;
  keep?: string;
  upgrade?: string;
  rate?: string;
}

function RuleCell({
  width,
  value,
  isHeader,
}: {
  width: number;
  value?: string;
  isHeader?: boolean;
}) {
  return (
    <SizableText
      w={width}
      flexShrink={0}
      textAlign="right"
      numberOfLines={1}
      size={isHeader ? '$bodySm' : '$bodyMdMedium'}
      color={isHeader || !value ? '$textSubdued' : '$text'}
    >
      {value ?? '–'}
    </SizableText>
  );
}

function LevelRuleTable({ rows }: { rows: ILevelRuleRow[] }) {
  const hasKeep = rows.some((row) => row.keep);
  const hasUpgrade = rows.some((row) => row.upgrade);
  return (
    <YStack>
      <XStack minHeight={24} ai="center" gap="$2">
        <Stack flex={1} />
        {hasKeep ? (
          <RuleCell isHeader width={RULE_COLUMN_WIDTHS.keep} value="Keep" />
        ) : null}
        {hasUpgrade ? (
          <RuleCell
            isHeader
            width={RULE_COLUMN_WIDTHS.upgrade}
            value="Upgrade"
          />
        ) : null}
        <RuleCell isHeader width={RULE_COLUMN_WIDTHS.rate} value="Rate" />
      </XStack>
      {rows.map((row) => (
        <XStack key={row.subject} minHeight={32} ai="center" gap="$2">
          <SizableText
            flex={1}
            size="$bodyMd"
            color="$textSubdued"
            numberOfLines={1}
          >
            {row.label}
          </SizableText>
          {hasKeep ? (
            <RuleCell width={RULE_COLUMN_WIDTHS.keep} value={row.keep} />
          ) : null}
          {hasUpgrade ? (
            <RuleCell width={RULE_COLUMN_WIDTHS.upgrade} value={row.upgrade} />
          ) : null}
          <RuleCell width={RULE_COLUMN_WIDTHS.rate} value={row.rate} />
        </XStack>
      ))}
    </YStack>
  );
}

export function getDisplayLabel(
  intl: IntlShape,
  labelKey?: string,
  fallback?: string,
): string {
  if (labelKey) {
    return intl.formatMessage({
      id: labelKey as ETranslations,
      defaultMessage: fallback,
    });
  }
  return fallback ?? '';
}

export function LevelAccordionItem({
  level,
  isCurrent,
  isLast,
  isHighestLevel,
  isLowestLevel,
  retentionConditions,
  nextLevelLabel,
}: {
  level: IInviteLevelDetail['levels'][0];
  isCurrent: boolean;
  isLast: boolean;
  isHighestLevel: boolean;
  isLowestLevel: boolean;
  retentionConditions?: IInviteLevelUpgradeCondition[];
  nextLevelLabel?: string;
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
      const row: ILevelRuleRow = {
        subject,
        label: SHORT_SUBJECT_LABELS[subject] ?? fallbackLabel,
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
        getDisplayLabel(
          intl,
          rate.commissionRatesLabelKey || rate.labelKey,
          rate.commissionRatesLabel ?? rate.label ?? subject,
        ),
      );
      row.rate = formatCommissionRateText({
        rebate: rate.rebate,
        discount: rate.discount,
      });
    });
    // Earn and Onchain share the DeFi name; keep only the first of them.
    const seenLabels = new Set<string>();
    return sortCommissionRateItems(Array.from(bySubject.values())).filter(
      (row) => {
        if (seenLabels.has(row.label)) {
          return false;
        }
        seenLabels.add(row.label);
        return true;
      },
    );
  }, [commissionRateItems, currencySymbol, intl, subjectGroups]);
  let headerNode: React.ReactNode = null;
  if (isMultiSubject) {
    headerNode = (
      // Same wording as the level card above, so the rule reads one way.
      <SizableText size="$bodyMdMedium" color="$text">
        {LEVEL_COPY.upgradeRule(true)}
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
            $md={{ px: '$4' }}
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
          $md={{ px: '$4', pb: '$4' }}
        >
          {md ? (
            <YStack gap="$2">
              {subjectGroups.length > 0 ? (
                <SizableText size="$bodyMd" color="$textSubdued">
                  {LEVEL_COPY.upgradeRule(isMultiSubject)}
                </SizableText>
              ) : null}
              <LevelRuleTable rows={ruleRows} />
            </YStack>
          ) : (
            <YStack gap="$4">
              {subjectGroups.length > 0 ? (
                <YStack gap="$3">
                  {headerNode}
                  <XStack
                    gap="$2"
                    ai="stretch"
                    $md={{ flexDirection: 'column' }}
                  >
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
                  {/* Compact rows show "10% / 10%" without labels, so they
                    keep the "(You / Invitee)" key; desktop cards label each
                    value themselves. */}
                  {md
                    ? intl.formatMessage({ id: ETranslations.referral_rate })
                    : LEVEL_COPY.commissionRatesTitle}
                </SizableText>

                <XStack gap="$3" $md={{ flexDirection: 'column', gap: '$2' }}>
                  {commissionRateItems.map(({ subject, rate }, index) => {
                    const label = getDisplayLabel(
                      intl,
                      rate.commissionRatesLabelKey || rate.labelKey,
                      rate.commissionRatesLabel ?? rate.label ?? subject,
                    );
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
