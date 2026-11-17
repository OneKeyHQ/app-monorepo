/** @jest-environment jsdom */

import { render } from '@testing-library/react';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import {
  HardwareStageOverlayContainer,
  registerHardwareStageBackHandler,
} from './HardwareStageOverlayContainer';

import type { IOverlayViewProps } from '@onekeyfe/react-native-native-overlay';

let mockStage: { step: string } | undefined;
let mockOverlayProps: IOverlayViewProps;
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  useDeviceStageAtom: () => [mockStage],
}));
jest.mock('@onekeyfe/react-native-native-overlay', () => ({
  OverlayView: (props: IOverlayViewProps) => {
    mockOverlayProps = props;
    return props.children;
  },
}));
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isNativeAndroid: true },
}));

const nativeEnv = platformEnv as { isNativeAndroid: boolean };

afterEach(() => {
  mockStage = undefined;
  nativeEnv.isNativeAndroid = true;
});

it('intercepts Android Back above dialogs even before the stage driver registers', () => {
  mockStage = { step: 'loading' };
  const { getByTestId } = render(
    <HardwareStageOverlayContainer>
      <div data-testid="stage-body">Stage</div>
    </HardwareStageOverlayContainer>,
  );
  expect(mockOverlayProps.dismissOnBackPress).toBe(true);
  expect(mockOverlayProps.blocking).toBe(false);
  expect(mockOverlayProps.backdrop).toBe(false);
  expect(mockOverlayProps.animation).toEqual({ enter: { type: 'none' } });
  expect(getByTestId('stage-body')).not.toBeNull();
  expect(() => mockOverlayProps.onRequestDismiss?.('back')).not.toThrow();
});

it('routes Back to the current driver and ignores stale registration cleanup', () => {
  mockStage = { step: 'loading' };
  render(<HardwareStageOverlayContainer />);
  const first = jest.fn(() => true);
  const second = jest.fn(() => true);
  const unregisterFirst = registerHardwareStageBackHandler(first);
  const unregisterSecond = registerHardwareStageBackHandler(second);
  unregisterFirst();
  mockOverlayProps.onRequestDismiss?.('back');
  expect(first).not.toHaveBeenCalled();
  expect(second).toHaveBeenCalledTimes(1);
  unregisterSecond();
  expect(() => mockOverlayProps.onRequestDismiss?.('back')).not.toThrow();
});

it('does not intercept Back when the stage is off or platform is not Android', () => {
  mockStage = { step: 'off' };
  const { rerender } = render(<HardwareStageOverlayContainer />);
  expect(mockOverlayProps.dismissOnBackPress).toBe(false);

  mockStage = { step: 'loading' };
  nativeEnv.isNativeAndroid = false;
  rerender(<HardwareStageOverlayContainer />);
  expect(mockOverlayProps.dismissOnBackPress).toBe(false);
});
