import { memo } from 'react';

import { StyleSheet } from 'react-native';

import {
  IconButton,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';

import { KEYTAG_PLATE_RADIUS, KeyTagHoleDot, useKeyTagLine } from './plate';
import {
  EKeyTagRowStatus,
  KEY_TAG_ROW_WEIGHTS,
  decodeKeyTagRow,
  keyTagRowValueToBits,
} from './utils';

import type { IKeyTagHoleToggleHandler } from './KeyTagInput';

// PROTOTYPE (map + pad, small screens): the plate above acts as a read-only
// overview; this pad is the actual input surface for the active row. One row
// of 12 tall cells with gutters between them, so a missed tap lands on dead
// space (no-op, no haptic) instead of silently toggling a neighbour bit.
const PAD_CELL_H = 48;
const PAD_CELL_GAP = 4;
// The dot scales off the cell in KeyTagHoleDot; the pad's cells are taller than
// they are wide, so feed it the narrower dimension to keep dots circular and
// the same visual weight as the map above.
const PAD_DOT_BASIS = 24;

const padStyles = StyleSheet.create({
  weight: { fontSize: 9, lineHeight: 12 },
});

// Static: the engraved weights never change.
const PAD_SCALE_ROW = (
  <XStack gap={PAD_CELL_GAP}>
    {KEY_TAG_ROW_WEIGHTS.map((weight) => (
      // flexBasis 0 so wide labels ("2048") can't skew the column widths away
      // from the cells below.
      <Stack key={weight} flexGrow={1} flexBasis={0} alignItems="center">
        <SizableText color="$textDisabled" style={padStyles.weight}>
          {weight}
        </SizableText>
      </Stack>
    ))}
  </XStack>
);

export const KeyTagRowPad = memo(function KeyTagRowPadBase({
  rowIndex,
  value,
  totalRows,
  onToggleHole,
  onStep,
}: {
  // Global row index of the active row.
  rowIndex: number;
  value: number;
  totalRows: number;
  onToggleHole: IKeyTagHoleToggleHandler;
  // Move the active row by +1 / -1 (the host clamps and flips faces).
  onStep: (delta: 1 | -1) => void;
}) {
  const line = useKeyTagLine();
  // `touched` only distinguishes Empty from Unverified, neither of which the
  // pad paints, so an untouched read is enough to surface an impossible value.
  const { status } = decodeKeyTagRow(value, { touched: false });
  const invalid = status === EKeyTagRowStatus.Invalid;

  return (
    // Same corner radius as the plate frame, and the same fill as the map's
    // highlighted row band — the card reads as "that row, brought down here".
    <YStack
      alignSelf="stretch"
      borderRadius={KEYTAG_PLATE_RADIUS}
      borderWidth={1}
      borderColor={line.frame}
      bg="$bgHover"
      px="$4"
      py="$3"
      gap="$2"
      mb="$3"
    >
      <XStack alignItems="center" justifyContent="space-between">
        <IconButton
          icon="ChevronLeftOutline"
          size="small"
          variant="tertiary"
          disabled={rowIndex === 0}
          onPress={() => onStep(-1)}
          testID="keytag-row-pad-prev"
        />
        <XStack alignItems="baseline" gap="$1">
          <SizableText
            size="$headingXl"
            color={invalid ? '$textCritical' : '$text'}
          >
            {rowIndex + 1}
          </SizableText>
          <SizableText size="$bodyMd" color="$textSubdued">
            / {totalRows}
          </SizableText>
        </XStack>
        <IconButton
          icon="ChevronRightOutline"
          size="small"
          variant="tertiary"
          disabled={rowIndex === totalRows - 1}
          onPress={() => onStep(1)}
          testID="keytag-row-pad-next"
        />
      </XStack>
      <YStack gap="$1">
        {PAD_SCALE_ROW}
        <XStack gap={PAD_CELL_GAP}>
          {keyTagRowValueToBits(value).map((on, col) => (
            <Stack
              key={KEY_TAG_ROW_WEIGHTS[col]}
              flexGrow={1}
              flexBasis={0}
              height={PAD_CELL_H}
              borderRadius="$2"
              borderWidth={1}
              borderColor={on ? '$borderActive' : line.grid}
              alignItems="center"
              justifyContent="center"
              pressStyle={{ bg: '$bgActive' }}
              onPress={() => onToggleHole(rowIndex, col)}
            >
              <KeyTagHoleDot
                on={on}
                invalid={invalid}
                size={PAD_DOT_BASIS}
                line={line}
              />
            </Stack>
          ))}
        </XStack>
      </YStack>
    </YStack>
  );
});
