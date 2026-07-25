import { memo, useCallback, useEffect, useState } from 'react';

import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { SizableText, Stack, XStack, YStack } from '@onekeyhq/components';

import {
  KEYTAG_CELL_BORDER,
  KEYTAG_GRID_GAP,
  KEYTAG_HEADER_H,
  KEYTAG_ROW_LABEL_W,
  KeyTagBrandMark,
  KeyTagPlateFrame,
  KeyTagScaleHeader,
  useKeyTagLine,
} from './plate';
import {
  EKeyTagRowStatus,
  KEY_TAG_ROW_BITS,
  decodeKeyTagRow,
  isKeyTagRowBitOn,
} from './utils';

import type { IKeyTagLine } from './plate';

const CELL_BORDER = KEYTAG_CELL_BORDER;
const ROW_LABEL_W = KEYTAG_ROW_LABEL_W;
const HEADER_H = KEYTAG_HEADER_H;

export type IKeyTagHoleToggleHandler = (
  rowIndex: number,
  holeIndex: number,
) => void;

function GridCell({
  on,
  size,
  isFirstRow,
  isFirstCol,
  invalid,
  banded,
  line,
  onPress,
  onHoverIn,
  onHoverOut,
}: {
  on: boolean;
  size: number;
  isFirstRow: boolean;
  isFirstCol: boolean;
  invalid?: boolean;
  // On the hover cross-hair: this cell's row or column is highlighted.
  banded?: boolean;
  line: IKeyTagLine;
  onPress?: () => void;
  onHoverIn?: () => void;
  onHoverOut?: () => void;
}) {
  const dotSize = Math.max(6, Math.round(size * 0.42));
  const guideSize = Math.max(2.5, size * 0.1);
  return (
    <Stack
      width={size}
      height={size}
      alignItems="center"
      justifyContent="center"
      borderLeftWidth={isFirstCol ? CELL_BORDER : 0}
      borderTopWidth={isFirstRow ? CELL_BORDER : 0}
      borderRightWidth={CELL_BORDER}
      borderBottomWidth={CELL_BORDER}
      borderColor={line.grid}
      backgroundColor={banded ? '$bgHover' : undefined}
      {...(onPress && {
        onPress,
        onHoverIn,
        onHoverOut,
        focusable: true,
        pressStyle: { bg: '$bgActive' },
        focusVisibleStyle: {
          outlineColor: '$focusRing',
          outlineStyle: 'solid',
          outlineWidth: 2,
        },
      })}
    >
      {on ? (
        <Stack
          width={dotSize}
          height={dotSize}
          borderRadius="$full"
          backgroundColor={invalid ? '$textCritical' : '$brand10'}
        />
      ) : (
        <Stack
          width={guideSize}
          height={guideSize}
          borderRadius="$full"
          backgroundColor={line.guide}
        />
      )}
    </Stack>
  );
}

// --- grid row (inside the frame): row number + 12 holes -------------------

type IKeyTagGridRowProps = {
  rowIndex: number;
  localIndex: number;
  displayLabel: string;
  value: number;
  touched: boolean;
  cellSize: number;
  placeholder?: boolean;
  // Set after a Confirm on an incomplete grid: rows still missing a valid word
  // flag their number red so the user sees which ones to fill.
  flagIncomplete?: boolean;
  // Backup verify: this row's entered value differs from the wallet's true
  // value (a valid-but-wrong word) — flag it red like an invalid row.
  mismatch?: boolean;
  // Hover cross-hair: which local row / column is currently highlighted.
  hoverRow?: number;
  hoverCol?: number;
  line: IKeyTagLine;
  onToggleHole?: IKeyTagHoleToggleHandler;
  onHoverCell?: (localRow: number, col: number) => void;
  onHoverOut?: () => void;
};

const KeyTagGridRow = memo(function KeyTagGridRowBase({
  rowIndex,
  localIndex,
  displayLabel,
  value,
  touched,
  cellSize,
  placeholder,
  flagIncomplete,
  mismatch,
  hoverRow,
  hoverCol,
  line,
  onToggleHole,
  onHoverCell,
  onHoverOut,
}: IKeyTagGridRowProps) {
  const isFirstRow = localIndex === 0;
  const editable = !placeholder;
  const status = editable
    ? decodeKeyTagRow(value, { touched }).status
    : EKeyTagRowStatus.Verified;
  const invalidValue = status === EKeyTagRowStatus.Invalid;
  const mismatched = editable && !!mismatch;
  // Red dots: an impossible (>2048) OR a valid-but-wrong (verify) row.
  const invalid = invalidValue || mismatched;
  // Missing a valid word and the user just tried to confirm.
  const flaggedEmpty =
    editable && !!flagIncomplete && status !== EKeyTagRowStatus.Verified;
  // Any reason this row's number should read red / blink on a failed Confirm.
  const flagged = flaggedEmpty || mismatched;
  const rowHovered = hoverRow === localIndex;

  let labelColor = '$textDisabled';
  if (invalid || flagged) {
    labelColor = '$textCritical';
  } else if (rowHovered) {
    labelColor = '$text';
  }

  // On a failed Confirm the flagged row's number is already red; blink just
  // that number a few times to draw the eye, then hold it solid. Only the
  // number blinks — flashing the whole row reads as too loud when several rows
  // fail at once. Fires only on Confirm (flagged), never live.
  const reducedMotion = useReducedMotion();
  const numberPulse = useSharedValue(1);
  useEffect(() => {
    if (!flagged || reducedMotion) {
      numberPulse.value = 1;
      return;
    }
    numberPulse.value = withSequence(
      withTiming(0.25, { duration: 220 }),
      withTiming(1, { duration: 220 }),
      withTiming(0.25, { duration: 220 }),
      withTiming(1, { duration: 220 }),
      withTiming(0.25, { duration: 220 }),
      withTiming(1, { duration: 220 }),
    );
  }, [flagged, reducedMotion, numberPulse]);
  const numberPulseStyle = useAnimatedStyle(() => ({
    opacity: numberPulse.value,
  }));

  return (
    <XStack alignItems="center" gap={KEYTAG_GRID_GAP}>
      <Stack
        width={ROW_LABEL_W}
        height={cellSize}
        justifyContent="center"
        alignItems="flex-end"
        opacity={placeholder ? 0.4 : 1}
      >
        <Animated.View style={numberPulseStyle}>
          <SizableText size="$headingXs" color={labelColor}>
            {displayLabel}
          </SizableText>
        </Animated.View>
      </Stack>
      <XStack opacity={placeholder ? 0.4 : 1}>
        {Array.from({ length: KEY_TAG_ROW_BITS }).map((_, col) => (
          <GridCell
            key={col}
            on={editable && isKeyTagRowBitOn(value, col)}
            invalid={invalid}
            size={cellSize}
            isFirstRow={isFirstRow}
            isFirstCol={col === 0}
            banded={editable && (rowHovered || hoverCol === col)}
            line={line}
            onPress={
              editable && onToggleHole
                ? () => {
                    onToggleHole(rowIndex, col);
                    // Anchor the active row on touch too (no hover fires there).
                    onHoverCell?.(localIndex, col);
                  }
                : undefined
            }
            onHoverIn={
              editable && onHoverCell
                ? () => onHoverCell(localIndex, col)
                : undefined
            }
            onHoverOut={editable ? onHoverOut : undefined}
          />
        ))}
      </XStack>
    </XStack>
  );
});

// --- plate ----------------------------------------------------------------

type IPlateRowDescriptor = {
  key: string;
  rowIndex: number;
  localIndex: number;
  displayLabel: string;
  value: number;
  touched: boolean;
  placeholder: boolean;
  mismatch: boolean;
};

// The interactive plate shares its visual language with the read-only DotMap.
// cellSize comes from the host via useKeyTagCellSize (elastic plate); cells
// toggle directly on every platform, so touch and pointer behave identically.
export function KeyTagInputPlate({
  rowOffset,
  values,
  touchedMask,
  cellSize,
  placeholderRows = 0,
  flagIncomplete,
  mismatchMask,
  onToggleHole,
}: {
  rowOffset: number;
  values: number[];
  touchedMask: boolean[];
  cellSize: number;
  placeholderRows?: number;
  flagIncomplete?: boolean;
  // Backup verify: rows whose entered value differs from the wallet's true
  // value. Flags a valid-but-WRONG word red — which the empty/>2048 red paths
  // cannot express — so the fund-losing mistap is visible. Global row index.
  mismatchMask?: boolean[];
  onToggleHole?: IKeyTagHoleToggleHandler;
}) {
  const line = useKeyTagLine();
  // Hover/active cross-hair: highlight the active cell's whole row and column so
  // the row number and 2^n weight are easy to trace. Set on pointer hover and,
  // so touch gets the same anchor, on every tap.
  const [hover, setHover] = useState<{ row: number; col: number } | null>(null);
  const handleHoverCell = useCallback(
    (row: number, col: number) => setHover({ row, col }),
    [],
  );
  const handleHoverOut = useCallback(() => setHover(null), []);
  const hoverRow = hover?.row;
  const hoverCol = hover?.col;

  const dataRowCount = values.length;
  const rows: IPlateRowDescriptor[] = [
    ...values.map((value, index) => ({
      key: `data-${index}`,
      rowIndex: rowOffset + index,
      localIndex: index,
      displayLabel: String(rowOffset + index + 1),
      value,
      touched: touchedMask[rowOffset + index] ?? false,
      placeholder: false,
      mismatch: mismatchMask?.[rowOffset + index] ?? false,
    })),
    ...Array.from({ length: placeholderRows }, (_, index) => ({
      key: `placeholder-${index}`,
      rowIndex: -1,
      localIndex: dataRowCount + index,
      displayLabel: String(rowOffset + dataRowCount + index + 1),
      value: 0,
      touched: false,
      placeholder: true,
      mismatch: false,
    })),
  ];

  return (
    <KeyTagPlateFrame>
      <XStack height={HEADER_H} gap={KEYTAG_GRID_GAP}>
        <Stack
          width={ROW_LABEL_W}
          height={HEADER_H}
          alignItems="center"
          justifyContent="center"
        >
          <KeyTagBrandMark line={line} />
        </Stack>
        <KeyTagScaleHeader cellSize={cellSize} highlightedCol={hoverCol} />
      </XStack>
      <YStack>
        {rows.map((row) => (
          <KeyTagGridRow
            key={row.key}
            rowIndex={row.rowIndex}
            localIndex={row.localIndex}
            displayLabel={row.displayLabel}
            value={row.value}
            touched={row.touched}
            cellSize={cellSize}
            placeholder={row.placeholder}
            flagIncomplete={flagIncomplete}
            mismatch={row.mismatch}
            hoverRow={hoverRow}
            hoverCol={hoverCol}
            line={line}
            onToggleHole={onToggleHole}
            onHoverCell={handleHoverCell}
            onHoverOut={handleHoverOut}
          />
        ))}
      </YStack>
    </KeyTagPlateFrame>
  );
}
