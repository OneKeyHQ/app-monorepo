/** @jest-environment jsdom */
import type { ReactNode } from 'react';

import { render } from '@testing-library/react';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { OverlayDialogPresentation } from './OverlayDialogPresentation';

import type { IOverlayViewProps } from '@onekeyfe/react-native-native-overlay';
let mockProps: IOverlayViewProps;
let mockSurfaceProps: { width?: unknown };
let mockPlatformOS = 'android';
const mockSafeAreaInsets = { top: 0, right: 0, bottom: 0, left: 0 };
const mockContentFrame = { x: 0, y: 0, width: 1000, height: 800 };
jest.mock('react-native', () => ({
  Platform: {
    select: (spec: Record<string, unknown>) =>
      mockPlatformOS in spec ? spec[mockPlatformOS] : spec.default,
  },
  useWindowDimensions: () => ({ width: 1000, height: 800 }),
}));
jest.mock('../../hooks/useLayout', () => ({
  useSafeAreaFrame: () => mockContentFrame,
  useSafeAreaInsets: () => mockSafeAreaInsets,
}));
jest.mock('react-native-gesture-handler', () => ({
  GestureHandlerRootView: ({ children }: { children?: ReactNode }) => (
    <div data-testid="dialog-gesture-root">{children}</div>
  ),
}));
jest.mock('@onekeyfe/react-native-native-overlay', () => ({
  OverlayView: (props: IOverlayViewProps) => {
    mockProps = props;
    return props.children;
  },
}));
jest.mock('../../hooks/useStyle', () => ({
  useTheme: () => ({ bg: { val: '#fff' }, bgBackdrop: { val: '#0004' } }),
}));
jest.mock('../../primitives', () => ({
  ThemeableStack: ({
    children,
    ...props
  }: {
    children?: ReactNode;
    width?: unknown;
  }) => {
    mockSurfaceProps = props;
    return <div>{children}</div>;
  },
}));
jest.mock('../../layouts/ScrollView', () => ({
  ScrollView: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isNative: true, isNativeAndroid: true },
}));
const nativeEnv = platformEnv as {
  isNative: boolean;
  isNativeAndroid: boolean;
};
const pageScope = { hostKey: 'main', ownerKey: 'screen' };
const dialogProps = {
  open: true,
  level: 'modal' as const,
  isSheet: false,
  dismissOnOverlayPress: true,
  dismissOnBackPress: true,
  disableDrag: false,
  onRequestClose: jest.fn(),
  children: <div data-testid="dialog-body">Body</div>,
};

afterEach(() => {
  nativeEnv.isNative = true;
  nativeEnv.isNativeAndroid = true;
  mockPlatformOS = 'android';
  mockSafeAreaInsets.left = 0;
  mockSafeAreaInsets.right = 0;
  mockContentFrame.width = 1000;
});
it('delivers sheet animation completion only after the host finishes', () => {
  const onRequestClose = jest.fn();
  const onAnimationComplete = jest.fn();
  const onExited = jest.fn();
  render(
    <OverlayDialogPresentation
      open
      level="modal"
      isSheet
      dismissOnOverlayPress
      dismissOnBackPress
      disableDrag={false}
      onRequestClose={onRequestClose}
      onExited={onExited}
      onAnimationComplete={onAnimationComplete}
    >
      <div>Body</div>
    </OverlayDialogPresentation>,
  );
  expect(onAnimationComplete).not.toHaveBeenCalled();
  mockProps.onPresented?.();
  expect(onAnimationComplete).toHaveBeenLastCalledWith({ open: true });
  mockProps.onClose?.('programmatic');
  expect(onAnimationComplete).toHaveBeenLastCalledWith({ open: false });
  expect(onExited).toHaveBeenCalledTimes(1);
});

it.each([true, false])(
  'places the Android gesture root inside the %s presentation',
  (isSheet) => {
    const { getByTestId } = render(
      <OverlayDialogPresentation
        open
        level="modal"
        isSheet={isSheet}
        dismissOnOverlayPress
        dismissOnBackPress
        disableDrag={false}
        onRequestClose={jest.fn()}
      >
        <div data-testid="dialog-body">Body</div>
      </OverlayDialogPresentation>,
    );
    expect(
      getByTestId('dialog-gesture-root').contains(getByTestId('dialog-body')),
    ).toBe(true);
    expect(mockProps.scope).toBe('global');
  },
);

it('leaves page overlays and non-Android presentations without a gesture root', () => {
  const { queryByTestId, rerender } = render(
    <OverlayDialogPresentation {...dialogProps} page={pageScope} />,
  );
  expect(queryByTestId('dialog-gesture-root')).toBeNull();
  expect(mockProps.scope).toBe('page');

  nativeEnv.isNativeAndroid = false;
  rerender(<OverlayDialogPresentation {...dialogProps} />);
  expect(queryByTestId('dialog-gesture-root')).toBeNull();
});

it('fits an iOS global sheet to the safe-area width of a landscape window', () => {
  nativeEnv.isNativeAndroid = false;
  mockPlatformOS = 'ios';
  mockSafeAreaInsets.left = 62;
  mockSafeAreaInsets.right = 62;
  render(<OverlayDialogPresentation {...dialogProps} isSheet />);
  expect(mockSurfaceProps.width).toBe(876);
});

it('fits an Android global sheet to the app content beside a side navigation bar', () => {
  mockContentFrame.width = 952;
  render(<OverlayDialogPresentation {...dialogProps} isSheet />);
  expect(mockSurfaceProps.width).toBe(952);
});

it('keeps page sheets and web sheets at the window width', () => {
  mockSafeAreaInsets.left = 62;
  mockSafeAreaInsets.right = 62;
  mockContentFrame.width = 952;
  const { rerender } = render(
    <OverlayDialogPresentation {...dialogProps} isSheet page={pageScope} />,
  );
  expect(mockSurfaceProps.width).toBeUndefined();

  nativeEnv.isNativeAndroid = false;
  mockPlatformOS = 'ios';
  rerender(
    <OverlayDialogPresentation {...dialogProps} isSheet page={pageScope} />,
  );
  expect(mockSurfaceProps.width).toBeUndefined();

  nativeEnv.isNative = false;
  mockPlatformOS = 'web';
  rerender(<OverlayDialogPresentation {...dialogProps} isSheet />);
  expect(mockSurfaceProps.width).toBeUndefined();
});
