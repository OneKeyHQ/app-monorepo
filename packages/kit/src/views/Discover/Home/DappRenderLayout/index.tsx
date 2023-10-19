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

import { Box, Stack, VStack, useIsVerticalLayout } from '@onekeyhq/components';

import type { LayoutChangeEvent } from 'react-native';

type IPageWidthLayoutContext = {
  fullwidth?: number;
};

export const PageWidthLayoutContext = createContext<IPageWidthLayoutContext>(
  {},
);

export const PageLayout: FC = ({ children }) => {
  const [state, setState] = useState<{ fullwidth?: number }>({});

  const setNewState = useCallback(
    debounce(setState, 500, { trailing: true }),
    [],
  );

  const onLayout = useCallback(
    (e: LayoutChangeEvent) => {
      const { width } = e.nativeEvent.layout;
      setNewState({ fullwidth: width });
    },
    [setNewState],
  );

  return (
    <Box>
      <Box onLayout={onLayout} />
      <PageWidthLayoutContext.Provider value={state}>
        {children}
      </PageWidthLayoutContext.Provider>
    </Box>
  );
};

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
    >
      {children}
    </Box>
  );
};

type DappItemPlainContainerLayoutProps = {
  space: number;
  offset?: number;
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
> = ({ children, space, offset }) => {
  const { fullwidth } = useContext(PageWidthLayoutContext);

  const state = useMemo<{ width?: number; num?: number }>(() => {
    let result = {};
    if (!fullwidth) {
      return result;
    }
    let num = 6;
    for (; num >= 2; num -= 1) {
      let total = fullwidth - space * 4 * (num - 1);
      if (offset !== undefined) {
        total += offset;
      }
      const current = Math.ceil(total / num);
      if ((current >= Min && current <= Max) || num === 2) {
        result = { width: current, num };
        return result;
      }
    }
    return result;
  }, [fullwidth, offset, space]);

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
      <Stack direction="column" space="4">
        {data.map((o, index) => (
          <Stack key={index} direction="row" space={space} w="full">
            {o}
          </Stack>
        ))}
      </Stack>
    );
  }, [state, space, children]);
  return (
    <DappItemPlainLayoutContext.Provider value={state}>
      {memo}
    </DappItemPlainLayoutContext.Provider>
  );
};

export const DappItemPlainContainerLayout: FC<
  DappItemPlainContainerLayoutProps
> = ({ children, space, offset }) => {
  const isSmall = useIsVerticalLayout();
  if (isSmall) {
    return (
      <DappItemPlainContainerStaticLayout space={space} offset={offset}>
        {children}
      </DappItemPlainContainerStaticLayout>
    );
  }
  return (
    <DappItemPlainContainerDynamicLayout space={space} offset={offset}>
      {children}
    </DappItemPlainContainerDynamicLayout>
  );
};
