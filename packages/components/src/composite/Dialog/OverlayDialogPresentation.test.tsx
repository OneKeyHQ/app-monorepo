/** @jest-environment jsdom */
import type { ReactNode } from 'react';

import { render } from '@testing-library/react';

import { OverlayDialogPresentation } from './OverlayDialogPresentation';

import type { IOverlayViewProps } from '@onekeyfe/react-native-native-overlay';
let mockProps: IOverlayViewProps;
jest.mock('react-native', () => ({
  useWindowDimensions: () => ({ width: 1000, height: 800 }),
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
  default: { isNative: true },
}));
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
