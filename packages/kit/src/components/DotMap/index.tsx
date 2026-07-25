import { useCallback, useMemo, useState } from 'react';

import { SizableText, Stack, XStack, YStack } from '@onekeyhq/components';

import { KeyTagFlipCard } from './KeyTagFlipCard';
import {
  KEYTAG_CELL_BORDER,
  KEYTAG_GRID_GAP,
  KEYTAG_HEADER_H,
  KEYTAG_ROW_LABEL_W,
  KeyTagBrandMark,
  KeyTagPlateEntrance,
  KeyTagPlateFrame,
  KeyTagScaleHeader,
  useKeyTagCellSize,
  useKeyTagLine,
} from './plate';
import { mnemonicToDotMapValues } from './utils';

import type { IKeyTagLine } from './plate';
import type { IDotMapValues } from './types';

const FALLBACK_CELL = 18;
const ROW_LABEL_W = KEYTAG_ROW_LABEL_W;
const HEADER_H = KEYTAG_HEADER_H;
const CELL_BORDER = KEYTAG_CELL_BORDER;

function GridCell({
  on,
  size,
  line,
  banded,
  onHoverIn,
  onHoverOut,
}: {
  on: boolean;
  size: number;
  line: IKeyTagLine;
  // On the hover cross-hair: this cell's row or column is highlighted.
  banded?: boolean;
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
      borderRightWidth={CELL_BORDER}
      borderBottomWidth={CELL_BORDER}
      borderColor={line.grid}
      backgroundColor={banded ? '$bgHover' : undefined}
      onHoverIn={onHoverIn}
      onHoverOut={onHoverOut}
    >
      {on ? (
        <Stack
          width={dotSize}
          height={dotSize}
          borderRadius="$full"
          backgroundColor="$brand10"
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

function toBits(values: boolean[]): boolean[] {
  if (values.length === 12) {
    return values;
  }
  return Array.from({ length: 12 }, () => false);
}

type IPlateRow = { label: string; bits: boolean[] };

export const DotMapBase = ({
  items,
  cellSize = FALLBACK_CELL,
}: {
  items: IDotMapValues[];
  cellSize?: number;
}) => {
  const line = useKeyTagLine();
  const rows = useMemo<IPlateRow[]>(
    () =>
      items.map((item) => ({
        label: String(item.index),
        bits: toBits(item.values),
      })),
    [items],
  );
  // Hover cross-hair: the plate is read-only, but pointing at a dot still
  // highlights its whole row and column so the row number and 2^n weight are
  // easy to trace while copying dots onto the steel. Pointer devices only.
  const [hover, setHover] = useState<{ row: number; col: number } | null>(null);
  const handleHoverOut = useCallback(() => setHover(null), []);

  return (
    <KeyTagPlateFrame>
      <XStack gap={KEYTAG_GRID_GAP}>
        {/* left column: brand mark + row labels */}
        <YStack width={ROW_LABEL_W}>
          <Stack height={HEADER_H} alignItems="center" justifyContent="center">
            <KeyTagBrandMark line={line} />
          </Stack>
          {/* spacer matching the header→grid gap so labels stay row-aligned */}
          <Stack height={KEYTAG_GRID_GAP} />
          {rows.map((row, index) => (
            <Stack
              key={index}
              height={cellSize}
              justifyContent="center"
              alignItems="flex-end"
            >
              <SizableText
                size="$headingXs"
                color={hover?.row === index ? '$text' : '$textDisabled'}
              >
                {row.label}
              </SizableText>
            </Stack>
          ))}
        </YStack>
        {/* right area: 2^n header + grid */}
        <YStack gap={KEYTAG_GRID_GAP}>
          <KeyTagScaleHeader cellSize={cellSize} highlightedCol={hover?.col} />
          <Stack
            borderTopWidth={CELL_BORDER}
            borderLeftWidth={CELL_BORDER}
            borderColor={line.grid}
          >
            {rows.map((row, rowIndex) => (
              <XStack key={rowIndex}>
                {row.bits.map((bit, col) => (
                  <GridCell
                    key={col}
                    on={bit}
                    size={cellSize}
                    line={line}
                    banded={hover?.row === rowIndex || hover?.col === col}
                    onHoverIn={() => setHover({ row: rowIndex, col })}
                    onHoverOut={handleHoverOut}
                  />
                ))}
              </XStack>
            ))}
          </Stack>
        </YStack>
      </XStack>
    </KeyTagPlateFrame>
  );
};

type IDotMapProps = {
  mnemonic: string;
  // Which face of the plate is showing; only meaningful past 12 words.
  side?: 'front' | 'back';
};

export const DotMap = ({ mnemonic, side = 'front' }: IDotMapProps) => {
  // Elastic plate: fill whatever width the host gives us (alignSelf stretch
  // beats centering parents); both faces share one measurement.
  const { cellSize, measured, onLayout } = useKeyTagCellSize(FALLBACK_CELL);
  const { first12: front, last12: back } = useMemo(() => {
    const resp = mnemonicToDotMapValues(mnemonic);
    const first12 = resp.slice(0, 12);
    let last12 = resp.slice(12);
    if (last12.length > 0) {
      last12 = Array.from(
        { length: 12 },
        (v, i) => last12[i] || { index: i + 13, values: [] },
      );
    }
    return { first12, last12 };
  }, [mnemonic]);

  return (
    <YStack
      alignSelf="stretch"
      alignItems="center"
      $gtMd={{ alignItems: 'flex-start' }}
      onLayout={onLayout}
    >
      <KeyTagPlateEntrance active={measured} zoom={false}>
        {back.length > 0 ? (
          <KeyTagFlipCard
            flipped={side === 'back'}
            front={<DotMapBase items={front} cellSize={cellSize} />}
            back={<DotMapBase items={back} cellSize={cellSize} />}
          />
        ) : (
          <DotMapBase items={front} cellSize={cellSize} />
        )}
      </KeyTagPlateEntrance>
    </YStack>
  );
};
