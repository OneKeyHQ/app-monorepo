/** @jest-environment jsdom */
import type { ReactNode } from 'react';

import { render } from '@testing-library/react';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { OverlayDialogPresentation } from './OverlayDialogPresentation';

import type { IOverlayViewProps } from '@onekeyfe/react-native-native-overlay';
let mockProps: IOverlayViewProps;
jest.mock('react-native', () => ({
  useWindowDimensions: () => ({ width: 1000, height: 800 }),
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
  ThemeableStack: ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  ),
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
