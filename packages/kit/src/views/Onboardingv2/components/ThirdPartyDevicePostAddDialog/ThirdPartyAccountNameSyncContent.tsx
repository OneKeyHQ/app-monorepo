import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import type {
  ISelectItem,
  ISizableTextProps,
} from '@onekeyhq/components';
import {
  Button,
  Checkbox,
  Divider,
  ScrollView,
  Select,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IThirdPartyAccountNameCandidate } from '@onekeyhq/shared/src/referralCode/type';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

import type { IAccountNameSyncSelection } from './migrationSelection';

// Column geometry, mirroring BatchCreateAccountPreview's table so rows line up
// instead of each one laying itself out independently.
const CHECKBOX_COLUMN_WIDTH = 22;
const ACCOUNT_COLUMN_FLEX = 5;
const NAME_COLUMN_FLEX = 3;
const ROW_GAP = '$4';
const ROW_MIN_HEIGHT = '$12';

function getCandidateNames(
  candidate: IThirdPartyAccountNameCandidate,
): string[] {
  return candidate.sourceNames?.length
    ? candidate.sourceNames
    : [candidate.sourceName];
}

function CandidateRow({
  candidate,
  state,
  onToggle,
  onPickName,
}: {
  candidate: IThirdPartyAccountNameCandidate;
  state: { checked: boolean; sourceName: string } | undefined;
  onToggle: (indexedAccountId: string, checked: boolean) => void;
  onPickName: (indexedAccountId: string, sourceName: string) => void;
}) {
  const intl = useIntl();
  const checked = Boolean(state?.checked);
  const names = useMemo(() => getCandidateNames(candidate), [candidate]);
  // Ledger Live reuses one address across chains, so several names can point at
  // the same account and the user has to say which one wins.
  const hasChoice = names.length > 1;
  const selectedName = names.includes(state?.sourceName ?? '')
    ? (state?.sourceName as string)
    : names[0];

  const selectItems = useMemo<ISelectItem[]>(
    () => names.map((name) => ({ label: name, value: name })),
    [names],
  );

  const handleToggle = useCallback(
    () => onToggle(candidate.indexedAccountId, !checked),
    [candidate.indexedAccountId, checked, onToggle],
  );

  return (
    <XStack
      gap={ROW_GAP}
      px="$3"
      minHeight={ROW_MIN_HEIGHT}
      alignItems="center"
      borderRadius="$2"
      borderCurve="continuous"
      userSelect="none"
      hoverStyle={{ bg: '$bgHover' }}
      pressStyle={{ bg: '$bgActive' }}
      onPress={handleToggle}
    >
      <Stack width={CHECKBOX_COLUMN_WIDTH}>
        <Checkbox
          value={checked}
          onChange={handleToggle}
          containerProps={{ pointerEvents: 'none' }}
        />
      </Stack>

      <Stack flexGrow={ACCOUNT_COLUMN_FLEX} flexBasis={0} minWidth={0}>
        <SizableText size="$bodyMd" numberOfLines={1}>
          {candidate.currentName}
        </SizableText>
        <SizableText size="$bodyMd" color="$textSubdued" numberOfLines={1}>
          {accountUtils.shortenAddress({
            address: candidate.matchedAddress,
            leadingLength: 6,
            trailingLength: 4,
          })}
        </SizableText>
      </Stack>

      <Stack
        flexGrow={NAME_COLUMN_FLEX}
        flexBasis={0}
        minWidth={0}
        alignItems="flex-end"
      >
        {hasChoice ? (
          <Select
            title={intl.formatMessage({
              id: ETranslations.v4_select_account_name_label,
            })}
            items={selectItems}
            value={selectedName}
            onChange={(value: string) =>
              onPickName(candidate.indexedAccountId, value)
            }
            floatingPanelProps={{ maxHeight: 272 }}
            renderTrigger={() => (
              <Button
                size="small"
                variant="tertiary"
                iconAfter="ChevronDownSmallOutline"
                disabled={!checked}
              >
                {selectedName}
              </Button>
            )}
          />
        ) : (
          <SizableText
            size="$bodyMd"
            numberOfLines={1}
            textAlign="right"
            color={checked ? '$text' : '$textSubdued'}
          >
            {selectedName}
          </SizableText>
        )}
      </Stack>
    </XStack>
  );
}

export function ThirdPartyAccountNameSyncContent({
  candidates,
  selection,
  onSelectionChange,
}: {
  candidates: IThirdPartyAccountNameCandidate[];
  selection: IAccountNameSyncSelection;
  onSelectionChange: (selection: IAccountNameSyncSelection) => void;
}) {
  const intl = useIntl();

  const handleToggle = useCallback(
    (indexedAccountId: string, checked: boolean) => {
      const current = selection[indexedAccountId];
      onSelectionChange({
        ...selection,
        [indexedAccountId]: {
          checked,
          sourceName: current?.sourceName ?? '',
        },
      });
    },
    [selection, onSelectionChange],
  );

  const handlePickName = useCallback(
    (indexedAccountId: string, sourceName: string) => {
      const current = selection[indexedAccountId];
      onSelectionChange({
        ...selection,
        [indexedAccountId]: {
          checked: current?.checked ?? true,
          sourceName,
        },
      });
    },
    [selection, onSelectionChange],
  );

  const checkedCount = candidates.filter(
    (candidate) => selection[candidate.indexedAccountId]?.checked,
  ).length;
  // Mirrors NetworkListHeader: a partial selection counts as "on", so the
  // button clears it rather than expanding it.
  const isAllSelected =
    checkedCount === 0
      ? false
      : checkedCount === candidates.length || 'indeterminate';

  // Checkbox semantics: a partial selection fills up rather than clears.
  const handleToggleAll = useCallback(() => {
    const selectAll = isAllSelected !== true;
    const next: IAccountNameSyncSelection = { ...selection };
    for (const candidate of candidates) {
      const current = next[candidate.indexedAccountId];
      next[candidate.indexedAccountId] = {
        checked: selectAll,
        sourceName:
          current?.sourceName ?? getCandidateNames(candidate)[0] ?? '',
      };
    }
    onSelectionChange(next);
  }, [isAllSelected, candidates, selection, onSelectionChange]);

  return (
    <YStack>
      {/* Header doubles as the select-all row so its checkbox lines up with the
          per-row ones, the way BatchCreateAccountPreview does it. */}
      <XStack gap={ROW_GAP} px="$3" py="$2" minHeight={36} alignItems="center">
        <XStack
          flexGrow={ACCOUNT_COLUMN_FLEX}
          flexBasis={0}
          minWidth={0}
          alignItems="center"
        >
          <Checkbox
            value={isAllSelected}
            onChange={handleToggleAll}
            label={intl.formatMessage({
              id: ETranslations.global_generate_amount_select,
            })}
            labelProps={{ size: '$bodyMd' } as ISizableTextProps}
          />
        </XStack>
        <Stack
          flexGrow={NAME_COLUMN_FLEX}
          flexBasis={0}
          minWidth={0}
          alignItems="flex-end"
        >
          <SizableText size="$bodyMd" color="$textDisabled" numberOfLines={1}>
            New name
          </SizableText>
        </Stack>
      </XStack>
      <Divider />

      {/* A wallet can match many accounts, so the list scrolls inside the
          dialog instead of growing it past the screen. */}
      <ScrollView maxHeight={320}>
        {candidates.map((candidate) => (
          <CandidateRow
            key={candidate.indexedAccountId}
            candidate={candidate}
            state={selection[candidate.indexedAccountId]}
            onToggle={handleToggle}
            onPickName={handlePickName}
          />
        ))}
      </ScrollView>
    </YStack>
  );
}
