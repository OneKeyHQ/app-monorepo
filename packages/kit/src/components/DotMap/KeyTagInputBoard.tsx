import { YStack, useMedia } from '@onekeyhq/components';

import { KeyTagFlipCard } from './KeyTagFlipCard';
import { KeyTagInputPlate } from './KeyTagInput';
import { KeyTagPlateEntrance, useKeyTagCellSize } from './plate';
import { KEY_TAG_PLATE_ROWS } from './utils';

import type { IKeyTagHoleToggleHandler } from './KeyTagInput';

// The interactive plate the user taps: one elastic-sized plate for <=12 words,
// a flip card (front rows 1-12 / back rows 13-24, back padded to full height)
// past that. Shared by the import page and the backup-verify phase — the only
// difference between them is whether a mismatchMask is supplied.
//
// PROTOTYPE (map + pad, small screens): the plate is a read-only map — tapping
// a row selects it (activeRow/onSelectRow, owned by the host page) — and the
// actual hole toggling happens on the KeyTagRowPad the host docks into its
// footer. gtMd keeps the original direct-toggle interaction (mouse is precise
// enough).
export function KeyTagInputBoard({
  rows,
  touchedMask,
  side,
  flagIncomplete,
  mismatchMask,
  activeRow,
  onSelectRow,
  onToggleHole,
}: {
  rows: number[];
  touchedMask: boolean[];
  side: 'front' | 'back';
  flagIncomplete?: boolean;
  mismatchMask?: boolean[];
  // Map-mode selection state, owned by the host page (which also renders the
  // row pad). Only consumed on small screens.
  activeRow?: number;
  onSelectRow?: (globalRowIndex: number) => void;
  onToggleHole: IKeyTagHoleToggleHandler;
}) {
  const { gtMd } = useMedia();
  const { cellSize, measured, onLayout } = useKeyTagCellSize(gtMd ? 26 : 18);
  const isPadMode = !gtMd;

  const frontRows = rows.slice(0, KEY_TAG_PLATE_ROWS);
  const backRows = rows.slice(KEY_TAG_PLATE_ROWS);
  const backPlaceholderRows =
    backRows.length > 0 ? KEY_TAG_PLATE_ROWS - backRows.length : 0;
  const isMultiPlate = backRows.length > 0;

  // Exactly one of the two interaction paths is wired at a time: map mode
  // selects rows, otherwise cells toggle directly.
  const plateActiveRow = isPadMode ? activeRow : undefined;
  const plateSelectRow = isPadMode ? onSelectRow : undefined;
  const plateToggle = isPadMode ? undefined : onToggleHole;

  return (
    <YStack
      gap="$4"
      alignItems="center"
      $gtMd={{ alignItems: 'flex-start' }}
      onLayout={onLayout}
    >
      <KeyTagPlateEntrance active={measured}>
        {isMultiPlate ? (
          <KeyTagFlipCard
            flipped={side === 'back'}
            front={
              <KeyTagInputPlate
                rowOffset={0}
                values={frontRows}
                touchedMask={touchedMask}
                cellSize={cellSize}
                flagIncomplete={flagIncomplete}
                mismatchMask={mismatchMask}
                onToggleHole={plateToggle}
                activeRow={plateActiveRow}
                onSelectRow={plateSelectRow}
              />
            }
            back={
              <KeyTagInputPlate
                rowOffset={KEY_TAG_PLATE_ROWS}
                values={backRows}
                touchedMask={touchedMask}
                cellSize={cellSize}
                placeholderRows={backPlaceholderRows}
                flagIncomplete={flagIncomplete}
                mismatchMask={mismatchMask}
                onToggleHole={plateToggle}
                activeRow={plateActiveRow}
                onSelectRow={plateSelectRow}
              />
            }
          />
        ) : (
          <KeyTagInputPlate
            rowOffset={0}
            values={frontRows}
            touchedMask={touchedMask}
            cellSize={cellSize}
            flagIncomplete={flagIncomplete}
            mismatchMask={mismatchMask}
            onToggleHole={plateToggle}
            activeRow={plateActiveRow}
            onSelectRow={plateSelectRow}
          />
        )}
      </KeyTagPlateEntrance>
    </YStack>
  );
}
