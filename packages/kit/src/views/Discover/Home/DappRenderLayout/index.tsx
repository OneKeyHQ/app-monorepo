import type { FC } from 'react';
import {
  Children,
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';

import { chunk, debounce } from 'lodash';

import { Box, Stack, useIsVerticalLayout } from '@onekeyhq/components';

import type { LayoutChangeEvent } from 'react-native';

type IDappItemPlainLayoutContext = {
  width?: number;
};

const DappItemPlainLayoutContext = createContext<IDappItemPlainLayoutContext>(
  {},
);

const Min = 280;
const Max = 360;

export const DappItemPlainLayout: FC = ({ children }) => {
  const isSmall = useIsVerticalLayout();
  const { width } = useContext(DappItemPlainLayoutContext);

  if (isSmall) {
    return <Box>{children}</Box>;
  }
  return (
    <Box
      minW={`${Min}px`}
      maxW={`${Max}px`}
      width={width ? `${width}px` : undefined}
      mb={width ? '4' : undefined}
    >
      {children}
    </Box>
  );
};

type DappItemPlainContainerLayoutProps = {
  space: number;
};

const DappItemPlainContainerStaticLayout: FC<
  DappItemPlainContainerLayoutProps
> = ({ children, space }) => {
  const memo = useMemo(() => ({ width: 0 }), []);
  return (
    <DappItemPlainLayoutContext.Provider value={memo}>
      <Stack direction="column" space={space}>
        {children}
      </Stack>
    </DappItemPlainLayoutContext.Provider>
  );
};

const DappItemPlainContainerDynamicLayout: FC<
  DappItemPlainContainerLayoutProps
> = ({ children, space }) => {
  const [state, setState] = useState<{ width?: number; num?: number }>({});
  const onLayout = useCallback(
    (e: LayoutChangeEvent) => {
      const { width } = e.nativeEvent.layout;
      let num = 6;
      if (width > 0) {
        for (; num >= 2; num -= 1) {
          const total = width - space * 4 * (num - 1);
          const current = Math.ceil(total / num);
          if ((current >= Min && current <= Max) || num === 2) {
            setState({ width: current, num });
            break;
          }
        }
      }
    },
    [space],
  );

  const memo = useMemo(() => {
    if (!state.num) {
      return (
        <Stack direction="row" space={space} w="full">
          {children}
        </Stack>
      );
    }
    const data = chunk(Children.toArray(children), state.num);
    return (
      <Box>
        {data.map((o, index) => (
          <Stack key={index} direction="row" space={space} w="full">
            {o}
          </Stack>
        ))}
      </Box>
    );
  }, [state, space, children]);
  return (
    <DappItemPlainLayoutContext.Provider value={state}>
      <Box onLayout={debounce(onLayout, 500, { trailing: true })} />
      {memo}
    </DappItemPlainLayoutContext.Provider>
  );
};

export const DappItemPlainContainerLayout: FC<
  DappItemPlainContainerLayoutProps
> = ({ children, space }) => {
  const isSmall = useIsVerticalLayout();
  if (isSmall) {
    return (
      <DappItemPlainContainerStaticLayout space={space}>
        {children}
      </DappItemPlainContainerStaticLayout>
    );
  }
  return (
    <DappItemPlainContainerDynamicLayout space={space}>
      {children}
    </DappItemPlainContainerDynamicLayout>
  );
};
