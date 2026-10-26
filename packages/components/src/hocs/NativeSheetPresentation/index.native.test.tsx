/** @jest-environment jsdom */
import type { ReactNode } from 'react';

import { act, render } from '@testing-library/react';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { NativeSheetPresentation } from './index.native';

import type { IOverlayViewProps } from '@onekeyfe/react-native-native-overlay';

let mockOverlayProps: IOverlayViewProps;
let mockGestureMounts = 0;
let mockGestureUnmounts = 0;
jest.mock('@onekeyfe/react-native-native-overlay', () => ({
  OverlayView: (props: IOverlayViewProps) => {
    mockOverlayProps = props;
    return props.children;
  },
  useNestedOverlayLevel: () => 'modal',
}));
jest.mock('react-native-gesture-handler', () => {
  const React = jest.requireActual('react') as typeof import('react');
  return {
    GestureHandlerRootView: ({
      children,
      style,
    }: {
      children?: ReactNode;
      style?: object;
    }) => {
      React.useEffect(() => {
        mockGestureMounts += 1;
        return () => {
          mockGestureUnmounts += 1;
        };
      }, []);
      return (
        <div
          data-testid="sheet-gesture-root"
          data-style={JSON.stringify(style)}
        >
          {children}
        </div>
      );
    },
  };
});
jest.mock('../../hooks/useStyle', () => ({
  useTheme: () => ({ bg: { val: '#fff' }, bgBackdrop: { val: '#0004' } }),
}));
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isNativeAndroid: true },
}));

const nativeEnv = platformEnv as { isNativeAndroid: boolean };
const sheetProps = {
  open: false,
  onOpenChange: jest.fn(),
  children: <div data-testid="sheet-body">Body</div>,
};

beforeEach(() => {
  mockGestureMounts = 0;
  mockGestureUnmounts = 0;
});
afterEach(() => {
  nativeEnv.isNativeAndroid = true;
});

it('keeps one Android gesture root as a hidden fit sheet gains a measured height', () => {
  const { getByTestId, rerender } = render(
    <NativeSheetPresentation {...sheetProps} />,
  );
  expect(mockOverlayProps.keepContentMounted).toBe(true);
  expect(getByTestId('sheet-gesture-root').getAttribute('data-style')).toBe(
    JSON.stringify({ flexGrow: 0, flexShrink: 1 }),
  );

  rerender(<NativeSheetPresentation {...sheetProps} open height={320} />);
  expect(getByTestId('sheet-gesture-root').getAttribute('data-style')).toBe(
    JSON.stringify({ flex: 1 }),
  );
  expect(
    getByTestId('sheet-gesture-root').contains(getByTestId('sheet-body')),
  ).toBe(true);
  expect(mockGestureMounts).toBe(1);
  expect(mockGestureUnmounts).toBe(0);
});

it('keeps non-Android sheet content unwrapped', () => {
  nativeEnv.isNativeAndroid = false;
  const { queryByTestId } = render(
    <NativeSheetPresentation {...sheetProps} open />,
  );
  expect(queryByTestId('sheet-gesture-root')).toBeNull();
});

it('does not request another close when a programmatic exit completes after reopening', () => {
  const onOpenChange = jest.fn();
  const onAnimationComplete = jest.fn();
  const props = { ...sheetProps, onOpenChange, onAnimationComplete };
  const { rerender } = render(<NativeSheetPresentation {...props} open />);
  rerender(<NativeSheetPresentation {...props} open={false} />);
  rerender(<NativeSheetPresentation {...props} open />);
  act(() => mockOverlayProps.onClose?.('system'));
  expect(onOpenChange).not.toHaveBeenCalled();
  expect(onAnimationComplete).toHaveBeenCalledWith({ open: false });
});

it('does not repeat a native dismiss request through the latest reopened callback', () => {
  const onOpenChange = jest.fn();
  const props = { ...sheetProps, onOpenChange };
  const { rerender } = render(<NativeSheetPresentation {...props} open />);
  act(() => mockOverlayProps.onRequestDismiss?.('pan'));
  expect(onOpenChange).toHaveBeenCalledTimes(1);
  rerender(<NativeSheetPresentation {...props} open={false} />);
  rerender(<NativeSheetPresentation {...props} open />);
  act(() => mockOverlayProps.onClose?.('pan'));
  expect(onOpenChange).toHaveBeenCalledTimes(1);
});

it('requests a close when native removes an open sheet without a prior request', () => {
  const onOpenChange = jest.fn();
  render(
    <NativeSheetPresentation
      {...sheetProps}
      open
      onOpenChange={onOpenChange}
    />,
  );
  act(() => mockOverlayProps.onClose?.('system'));
  expect(onOpenChange).toHaveBeenCalledTimes(1);
  expect(onOpenChange).toHaveBeenCalledWith(false);
});
