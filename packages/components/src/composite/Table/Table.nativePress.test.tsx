/** @jest-environment jsdom */

import type { PropsWithChildren } from 'react';

import { Table } from '.';

import { act, render } from '@testing-library/react';

import type { ITableProps } from './types';
import type { GestureResponderEvent, PressableProps } from 'react-native';

const mockPressable = jest.fn<void, [PressableProps]>();

jest.mock('react-native', () => ({
  Pressable: (props: PropsWithChildren<PressableProps>) => {
    mockPressable(props);
    return <div>{props.children}</div>;
  },
  StyleSheet: { hairlineWidth: 1 },
}));
jest.mock('react-native-draggable-flatlist/src/context/globalRef', () => ({
  globalRef: {},
}));
jest.mock('@onekeyhq/components', () => ({
  useMedia: () => ({ md: true }),
  useThemeName: () => 'light',
  withStaticProperties: Object.assign,
}));
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isNative: true },
}));
jest.mock('@onekeyhq/shared/src/style', () => ({ listItemPressStyle: {} }));
jest.mock('../../actions/IconButton', () => ({ IconButton: () => null }));
jest.mock('../../layouts/ListView', () => ({ ListView: () => null }));
jest.mock('../../primitives', () => ({
  XStack: ({ children }: PropsWithChildren) => <div>{children}</div>,
}));
jest.mock('../../primitives/Haptics', () => ({
  Haptics: {},
  ImpactFeedbackStyle: {},
}));
jest.mock('../ScrollContentRegistration', () => ({}));
jest.mock('./components', () => ({}));

const event = {} as GestureResponderEvent;
const token = { symbol: 'BTC' };
const columns: ITableProps<typeof token>['columns'] = [];

beforeEach(() => {
  jest.clearAllMocks();
});

it.each(['tap', 'hold', 'cancel'] as const)(
  'keeps native %s notifications separate from the row action',
  (gesture) => {
    const onPress = jest.fn();
    const onPressIn = jest.fn();
    const onPressOut = jest.fn();
    const onRow = jest.fn(() => ({ onPress, onPressIn, onPressOut }));
    render(
      <Table.Row item={token} index={0} columns={columns} onRow={onRow} />,
    );
    const props = mockPressable.mock.calls[0][0];

    act(() => {
      props.onPressIn?.(event);
    });
    expect(onPressIn).toHaveBeenCalledTimes(1);
    expect(onPress).not.toHaveBeenCalled();
    if (gesture === 'hold') {
      // The internal long-press handler existed before diagnostics were added.
      act(() => {
        props.onLongPress?.(event);
      });
      expect(onPress).not.toHaveBeenCalled();
    }
    act(() => {
      props.onPressOut?.(event);
    });
    expect(onPressOut).toHaveBeenCalledTimes(1);
    expect(onPress).not.toHaveBeenCalled();
    if (gesture === 'tap') {
      act(() => {
        props.onPress?.(event);
      });
      expect(onPress).toHaveBeenCalledTimes(1);
    }
  },
);

it('preserves an existing business long-press action', () => {
  const onPress = jest.fn();
  const onLongPress = jest.fn();
  const onRow = jest.fn(() => ({ onPress, onLongPress }));
  render(<Table.Row item={token} index={0} columns={columns} onRow={onRow} />);
  act(() => {
    mockPressable.mock.calls[0][0].onLongPress?.(event);
  });
  expect(onLongPress).toHaveBeenCalledTimes(1);
  expect(onPress).not.toHaveBeenCalled();
});
