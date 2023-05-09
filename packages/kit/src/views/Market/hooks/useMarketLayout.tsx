import type { FC } from 'react';
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';

import { Box, useIsVerticalLayout, useUserDevice } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import type { LayoutChangeEvent } from 'react-native';

export type IGridLayoutContext = {
  width?: number;
};

export const GridLayoutContext = createContext<IGridLayoutContext>({});

export const GridLayout: FC = ({ children }) => {
  const [value, setValue] = useState<IGridLayoutContext>({});
  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const { width } = e.nativeEvent.layout;
    setValue({ width });
  }, []);
  return (
    <GridLayoutContext.Provider value={value}>
      <Box w="full">
        <Box onLayout={onLayout} w="full" />
        <Box>{children}</Box>
      </Box>
    </GridLayoutContext.Provider>
  );
};

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
  const { screenWidth, size } = useUserDevice();
  const leftSliderWidth = useMemo(
    () => (['XLARGE'].includes(size) ? 256 : 224),
    [size],
  );
  const { width: containerWidth } = useContext(GridLayoutContext);

  const gridSpace = space ?? (isVerticalLayout ? 12 : 24);
  const gridMaxWidth = maxW ?? GRID_MAX_WIDTH;
  let layoutWidth = isVerticalLayout
    ? screenWidth - (outPadding ?? 0)
    : screenWidth - leftSliderWidth - (outPadding ?? 0);
  if (containerWidth) {
    layoutWidth = containerWidth;
  }
  const gridWidth = layoutWidth < gridMaxWidth ? layoutWidth : gridMaxWidth;
  const lgRowCount = gridWidth > GRID_MAX_WIDTH ? 4 : 3;
  const rowCount = isVerticalLayout ? 2 : lgRowCount;

  const ml = useMemo(
    () =>
      !index
        ? '0px'
        : `${
            index % (isVerticalLayout ? 2 : rowCount) !== 0 ? gridSpace : 0
          }px`,
    [index, isVerticalLayout, gridSpace, rowCount],
  );
  const my = useMemo(() => `${gridSpace / 2}px`, [gridSpace]);
  const width = useMemo(
    () =>
      index === undefined
        ? 'full'
        : Math.floor((gridWidth - gridSpace * (rowCount - 1)) / rowCount),
    [gridWidth, gridSpace, rowCount, index],
  );
  return { ml, my, width };
};

export const useMarketMidLayout = () => {
  const { size } = useUserDevice();
  return useMemo(() => size === 'NORMAL', [size]);
};

export const useDevicePixelRatio = () =>
  useMemo(() => (platformEnv.isNative ? 1 : window.devicePixelRatio || 1), []);
