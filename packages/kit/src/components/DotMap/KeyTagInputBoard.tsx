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
export function KeyTagInputBoard({
  rows,
  touchedMask,
  side,
  flagIncomplete,
  mismatchMask,
  onToggleHole,
}: {
  rows: number[];
  touchedMask: boolean[];
  side: 'front' | 'back';
  flagIncomplete?: boolean;
  mismatchMask?: boolean[];
  onToggleHole: IKeyTagHoleToggleHandler;
}) {
  const { gtMd } = useMedia();
  const { cellSize, measured, onLayout } = useKeyTagCellSize(gtMd ? 26 : 18);

  const frontRows = rows.slice(0, KEY_TAG_PLATE_ROWS);
  const backRows = rows.slice(KEY_TAG_PLATE_ROWS);
  const backPlaceholderRows =
    backRows.length > 0 ? KEY_TAG_PLATE_ROWS - backRows.length : 0;
  const isMultiPlate = backRows.length > 0;

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
                onToggleHole={onToggleHole}
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
                onToggleHole={onToggleHole}
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
            onToggleHole={onToggleHole}
          />
        )}
      </KeyTagPlateEntrance>
    </YStack>
  );
}
