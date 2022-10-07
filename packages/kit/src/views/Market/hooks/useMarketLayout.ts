import { useIsVerticalLayout, useUserDevice } from '@onekeyhq/components/src';
import { useMemo } from 'react';

export const GRID_MAX_WIDTH = 700;
export const useGridBoxStyle = ({
  index,
  space,
  maxW,
  outPadding,
}: {
  index?: number;
  space?: number;
  maxW?: number;
  outPadding?: number;
}) => {
  const isVerticalLayout = useIsVerticalLayout();
  const { screenWidth } = useUserDevice();
  const gridSpace = space ?? (isVerticalLayout ? 12 : 24);
  const graidMaxWidth = maxW ?? GRID_MAX_WIDTH;
  const layoutWidth = isVerticalLayout
    ? screenWidth - (outPadding ?? 0)
    : screenWidth - 224 - (outPadding ?? 0); // 224 is desktop left width
  const gridWidth = layoutWidth < graidMaxWidth ? layoutWidth : graidMaxWidth;
  const lgRowCount = gridWidth > GRID_MAX_WIDTH ? 4 : 3;
  const ml = useMemo(
    () =>
      !index
        ? '0px'
        : `${
            index % (isVerticalLayout ? 2 : lgRowCount) !== 0 ? gridSpace : 0
          }px`,
    [index, isVerticalLayout, gridSpace, lgRowCount],
  );
  const my = useMemo(() => `${gridSpace / 2}px`, [gridSpace]);
  const width = useMemo(
    () =>
      index === undefined
        ? 'full'
        : Math.floor(
            isVerticalLayout
              ? (gridWidth - gridSpace) / 2
              : (gridWidth - gridSpace * (lgRowCount - 1)) / lgRowCount,
          ),
    [isVerticalLayout, gridWidth, gridSpace, lgRowCount, index],
  );
  return { ml, my, width };
};
