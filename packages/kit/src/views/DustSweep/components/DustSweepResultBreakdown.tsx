import { useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import { Icon, SizableText, Stack, XStack, YStack } from '@onekeyhq/components';
import { TokenGroup } from '@onekeyhq/kit/src/components/Token/TokenGroup';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { getDustSweepTotals } from '../stateMachine';
import { groupDustSweepSkips } from '../utils/skipReasons';

import { getDustSweepItemReasonMessage } from './DustSweepTokenRow';

import type { IDustSweepState } from '../stateMachine';
import type { IDustSweepSkipGroup } from '../utils/skipReasons';

const MAX_PREVIEW_TOKENS = 3;
const ICON_PLACEHOLDER = '\u0000';

// "Tap {icon} next to a token…" with the same red info icon as the token rows.
function DustSweepSkipFootnote() {
  const intl = useIntl();
  const [before, after = ''] = intl
    .formatMessage(
      { id: ETranslations.dust_tap_token_info_for_failure_reason },
      { icon: ICON_PLACEHOLDER },
    )
    .split(ICON_PLACEHOLDER);
  return (
    <XStack
      testID="dust-sweep-skip-footnote"
      alignItems="center"
      flexWrap="wrap"
      gap="$1"
    >
      {before.trim() ? (
        <SizableText size="$bodySm" color="$textSubdued">
          {before.trim()}
        </SizableText>
      ) : null}
      <Icon name="InfoCircleSolid" size="$4" color="$iconCritical" />
      {after.trim() ? (
        <SizableText size="$bodySm" color="$textSubdued">
          {after.trim()}
        </SizableText>
      ) : null}
    </XStack>
  );
}

function DustSweepSkipReasonRow({ group }: { group: IDustSweepSkipGroup }) {
  const intl = useIntl();
  const overflow = group.tokens.length - MAX_PREVIEW_TOKENS;
  return (
    <XStack
      testID="dust-sweep-skip-reason"
      height={20}
      alignItems="center"
      justifyContent="space-between"
      gap="$3"
    >
      <SizableText
        size="$bodySm"
        color="$textSubdued"
        flexShrink={1}
        numberOfLines={1}
      >
        {group.label ?? intl.formatMessage({ id: ETranslations.global_others })}
      </SizableText>
      <XStack alignItems="center" gap="$1.5" flexShrink={0}>
        <TokenGroup
          tokens={group.tokens.map((token) => ({
            tokenImageUri: token.logoURI,
          }))}
          size="xxs"
          maxVisible={MAX_PREVIEW_TOKENS}
          backgroundColor="$bgSubdued"
          showRemainingBadge={false}
        />
        {overflow > 0 ? (
          <SizableText size="$bodySm" color="$textSubdued">
            +{overflow}
          </SizableText>
        ) : null}
      </XStack>
    </XStack>
  );
}

// Converted / Skipped counts with the reasons tokens were not converted.
// Desktop always shows the reasons; mobile keeps them behind the Skipped row.
export function DustSweepResultBreakdown({
  state,
  collapsible,
}: {
  state: IDustSweepState;
  collapsible: boolean;
}) {
  const intl = useIntl();
  const [open, setOpen] = useState(!collapsible);
  const totals = getDustSweepTotals(state.items);
  const { notConvertedCount } = totals;
  const nativeTokenSymbol = state.snapshot?.nativeToken.symbol;
  const groups = useMemo(
    () =>
      groupDustSweepSkips(state.items, (item) =>
        getDustSweepItemReasonMessage(intl, item, nativeTokenSymbol),
      ),
    [intl, state.items, nativeTokenSymbol],
  );
  const countLabel = (count: number) =>
    intl.formatMessage(
      { id: ETranslations.dust_sweep_token_count__desc },
      { count },
    );
  const canToggle = collapsible && notConvertedCount > 0;
  return (
    <YStack testID="dust-sweep-result-breakdown" width="100%" gap="$3">
      <XStack height={20} alignItems="center" justifyContent="space-between">
        <SizableText size="$bodyMd" color="$textSubdued">
          {intl.formatMessage({ id: ETranslations.label_converted })}
        </SizableText>
        <SizableText size="$bodyMdMedium">
          {countLabel(totals.successCount)}
        </SizableText>
      </XStack>
      <XStack
        testID="dust-sweep-result-skipped"
        height={20}
        alignItems="center"
        justifyContent="space-between"
        {...(canToggle
          ? {
              role: 'button',
              cursor: 'pointer',
              hitSlop: 8,
              onPress: () => setOpen((value) => !value),
            }
          : {})}
      >
        <SizableText size="$bodyMd" color="$textSubdued">
          {intl.formatMessage({ id: ETranslations.label_skipped })}
        </SizableText>
        <XStack alignItems="center" gap="$1">
          <SizableText size="$bodyMdMedium">
            {countLabel(notConvertedCount)}
          </SizableText>
          {canToggle ? (
            <Icon
              name={open ? 'ChevronTopSmallOutline' : 'ChevronDownSmallOutline'}
              size="$5"
              color="$iconSubdued"
            />
          ) : null}
        </XStack>
      </XStack>
      {open && groups.length ? (
        <>
          <Stack
            testID="dust-sweep-skip-reasons"
            bg="$bgSubdued"
            borderRadius="$3"
            p="$3"
            gap="$2"
          >
            {groups.map((group) => (
              <DustSweepSkipReasonRow
                key={group.label ?? 'others'}
                group={group}
              />
            ))}
          </Stack>
          <DustSweepSkipFootnote />
        </>
      ) : null}
    </YStack>
  );
}
