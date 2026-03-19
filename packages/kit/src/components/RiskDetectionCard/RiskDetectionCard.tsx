import { useCallback, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import { Icon, SizableText, Stack, XStack, YStack } from '@onekeyhq/components';
import type { IKeyOfIcons } from '@onekeyhq/components';
import type { ColorTokens } from '@onekeyhq/components/src/shared/tamagui';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { ERiskSeverity } from './types';

import type { IRiskCheckItem, IRiskDetectionCardProps } from './types';

// ---------------------------------------------------------------------------
// Theme helpers
// ---------------------------------------------------------------------------

function getHighestSeverity(checks: IRiskCheckItem[]): ERiskSeverity | null {
  const failed = checks.filter((c) => !c.passed);
  if (failed.length === 0) return null;
  if (failed.some((c) => c.highestSeverity === ERiskSeverity.Critical)) {
    return ERiskSeverity.Critical;
  }
  if (failed.some((c) => c.highestSeverity === ERiskSeverity.Warning)) {
    return ERiskSeverity.Warning;
  }
  return ERiskSeverity.Info;
}

type ICardTheme = {
  borderColor: ColorTokens;
  headerBg: ColorTokens;
  headerIcon: ColorTokens;
  headerText: ColorTokens;
};

const CARD_THEMES: Record<ERiskSeverity, ICardTheme> = {
  [ERiskSeverity.Critical]: {
    borderColor: '$borderCritical',
    headerBg: '$bgCriticalSubdued',
    headerIcon: '$iconCritical',
    headerText: '$textCritical',
  },
  [ERiskSeverity.Warning]: {
    borderColor: '$borderCautionSubdued',
    headerBg: '$bgCautionSubdued',
    headerIcon: '$iconCaution',
    headerText: '$textCaution',
  },
  [ERiskSeverity.Info]: {
    borderColor: '$borderInfoSubdued',
    headerBg: '$bgInfoSubdued',
    headerIcon: '$iconInfo',
    headerText: '$textInfo',
  },
};

const CARD_THEME_SUCCESS: ICardTheme = {
  borderColor: '$borderSubdued',
  headerBg: '$bg',
  headerIcon: '$iconSuccess',
  headerText: '$text',
};

const SEVERITY_ICON: Record<
  ERiskSeverity,
  { name: IKeyOfIcons; color: ColorTokens }
> = {
  [ERiskSeverity.Critical]: {
    name: 'XCircleSolid',
    color: '$iconCritical',
  },
  [ERiskSeverity.Warning]: {
    name: 'ErrorSolid',
    color: '$iconCaution',
  },
  [ERiskSeverity.Info]: {
    name: 'InfoCircleSolid',
    color: '$iconInfo',
  },
};

// ---------------------------------------------------------------------------
// CheckRow
// ---------------------------------------------------------------------------

const SIGNAL_TAG_COLORS: Record<
  ERiskSeverity,
  { bg: ColorTokens; text: ColorTokens }
> = {
  [ERiskSeverity.Critical]: {
    bg: '$bgCriticalSubdued',
    text: '$textCritical',
  },
  [ERiskSeverity.Warning]: {
    bg: '$bgCautionSubdued',
    text: '$textCaution',
  },
  [ERiskSeverity.Info]: {
    bg: '$bgInfoSubdued',
    text: '$textInfo',
  },
};

function CheckRow({
  check,
  isLast,
}: {
  check: IRiskCheckItem;
  isLast: boolean;
}) {
  if (check.passed) {
    return (
      <XStack py="$1.5" gap="$2" alignItems="center">
        <Icon name="CheckRadioSolid" size="$4.5" color="$iconSuccess" />
        <SizableText size="$bodyMd" color="$text">
          {check.label}
        </SizableText>
      </XStack>
    );
  }

  const severityIcon =
    SEVERITY_ICON[check.highestSeverity ?? ERiskSeverity.Warning];

  // Signals with description use detailed layout; others use inline tags
  const hasDescription = check.signals.some((s) => !!s.description);

  return (
    <YStack>
      <YStack py="$2" gap="$2">
        <XStack gap="$2" alignItems="center">
          <Icon
            name={severityIcon.name}
            size="$4.5"
            color={severityIcon.color}
          />
          <SizableText size="$bodyMdMedium" color="$text">
            {check.label}
          </SizableText>
        </XStack>
        {hasDescription ? (
          /* Detailed layout for signals with descriptions */
          <YStack pl="$6.5" gap="$1">
            {check.signals.map((signal) => (
              <YStack key={signal.key}>
                <XStack gap="$1.5" alignItems="flex-start">
                  <SizableText size="$bodySm" color="$textSubdued" mt="$0.5">
                    ·
                  </SizableText>
                  <YStack flex={1}>
                    <SizableText size="$bodySm" color="$textSubdued">
                      {signal.title}
                    </SizableText>
                    {signal.description ? (
                      <SizableText size="$bodyXs" color="$textDisabled">
                        {signal.description}
                      </SizableText>
                    ) : null}
                  </YStack>
                </XStack>
              </YStack>
            ))}
          </YStack>
        ) : (
          /* Inline tag layout for short signals / bullet list for sentences */
          <YStack pl="$6.5" gap="$1.5">
            {check.signals.some((s) => s.title.length > 30) ? (
              /* Sentence signals — bullet list */
              check.signals.map((signal) => (
                <XStack key={signal.key} gap="$1.5" alignItems="flex-start">
                  <SizableText size="$bodySm" color="$textSubdued" mt="$0.5">
                    ·
                  </SizableText>
                  <SizableText size="$bodySm" color="$textSubdued" flex={1}>
                    {signal.title}
                  </SizableText>
                </XStack>
              ))
            ) : (
              /* Short tag signals — inline row */
              <XStack gap="$1.5" flexWrap="wrap">
                {check.signals.map((signal) => {
                  const tagColor = SIGNAL_TAG_COLORS[signal.severity];
                  return (
                    <Stack
                      key={signal.key}
                      bg={tagColor.bg}
                      px="$2"
                      py="$0.5"
                      borderRadius="$1"
                    >
                      <SizableText size="$bodySm" color={tagColor.text}>
                        {signal.title}
                      </SizableText>
                    </Stack>
                  );
                })}
              </XStack>
            )}
          </YStack>
        )}
      </YStack>
      {!isLast ? (
        <Stack
          borderBottomWidth={StyleSheet.hairlineWidth}
          borderColor="$borderSubdued"
        />
      ) : null}
    </YStack>
  );
}

// ---------------------------------------------------------------------------
// RiskDetectionCard
// ---------------------------------------------------------------------------

function RiskDetectionCard({ checks }: IRiskDetectionCardProps) {
  const intl = useIntl();

  const { allPassed, theme, sortedChecks } = useMemo(() => {
    const ap = checks.every((c) => c.passed);
    const severity = getHighestSeverity(checks);
    // Sort failed checks to the top
    const sorted = [...checks].toSorted((a, b) => {
      if (a.passed === b.passed) return 0;
      return a.passed ? 1 : -1;
    });
    return {
      allPassed: ap,
      theme: ap ? CARD_THEME_SUCCESS : CARD_THEMES[severity!],
      sortedChecks: sorted,
    };
  }, [checks]);

  // All passed: collapsed by default; has risks: always expanded
  const [expanded, setExpanded] = useState(!allPassed);

  const handleToggle = useCallback(() => {
    if (allPassed) {
      setExpanded((prev) => !prev);
    }
  }, [allPassed]);

  if (checks.length === 0) return null;

  return (
    <Stack
      borderRadius="$3"
      borderWidth={StyleSheet.hairlineWidth}
      borderColor={theme.borderColor}
      overflow="hidden"
    >
      {/* Header — tappable when all passed */}
      <XStack
        px="$3.5"
        py="$2.5"
        bg={theme.headerBg}
        alignItems="center"
        gap="$2"
        onPress={allPassed ? handleToggle : undefined}
        cursor={allPassed ? 'pointer' : undefined}
      >
        <Icon
          name={allPassed ? 'ShieldCheckDoneSolid' : 'ShieldKeyholeOutline'}
          size="$5"
          color={theme.headerIcon}
        />
        <SizableText size="$bodyMdMedium" color={theme.headerText} flex={1}>
          {intl.formatMessage({
            id: ETranslations.dapp_connect_security_checks__title,
          })}
        </SizableText>
        {allPassed ? (
          <Icon
            name={
              expanded ? 'ChevronTopSmallOutline' : 'ChevronDownSmallOutline'
            }
            size="$4.5"
            color={theme.headerText}
          />
        ) : null}
      </XStack>

      {/* Checklist — collapsible when all passed */}
      {expanded || !allPassed ? (
        <YStack px="$3.5" py="$2">
          {sortedChecks.map((check, index) => (
            <CheckRow
              key={check.category}
              check={check}
              isLast={index === sortedChecks.length - 1}
            />
          ))}
        </YStack>
      ) : null}
    </Stack>
  );
}

export { RiskDetectionCard };
