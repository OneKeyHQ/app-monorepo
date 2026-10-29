/**
 * @jest-environment jsdom
 * @jest-environment-options {"customExportConditions": ["node", "node-addons"]}
 */
// oxlint-disable react-perf/jsx-no-new-function-as-prop, react-perf/jsx-no-new-object-as-prop -- test props capture each case's state
import type { ReactNode } from 'react';

import { act, fireEvent, render, screen } from '@testing-library/react';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { Popover } from './index.native';

type IMockOverlayProps = {
  visible: boolean;
  children?: ReactNode;
  windowOffsetRequest?: number;
  onWindowOffset?: (offset: { x: number; y: number }) => void;
};

const mockOverlayRenders: IMockOverlayProps[] = [];
const mockTriggerRect = { x: 100, y: 200, width: 40, height: 40 };
const mockWindow = { current: { width: 1024, height: 768 } };
const triggerContent = <span>Open</span>;
const menuContent = <span>Item</span>;

jest.mock('@onekeyfe/react-native-native-overlay', () => ({
  useNestedOverlayLevel: () => 'popover',
  OverlayView: (props: IMockOverlayProps) => {
    mockOverlayRenders.push(props);
    return (
      <div data-testid="anchored-overlay" data-visible={String(props.visible)}>
        {props.children}
      </div>
    );
  },
}));
jest.mock('@tamagui/core', () => ({
  useIsomorphicLayoutEffect:
    jest.requireActual<typeof import('react')>('react').useLayoutEffect,
}));
jest.mock('@onekeyhq/components/src/shared/tamagui', () => ({
  getTokenValue: () => 240,
  withStaticProperties: Object.assign,
}));
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isNative: true, isNativeIOS: true, isNativeAndroid: false },
}));
jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: { ui: {} },
}));
jest.mock('../../hooks', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
    useModalNavigatorContext: () => ({}),
    ModalNavigatorContext: React.createContext({}),
  };
});
jest.mock('../../hooks/useDeferredGuideBlocker', () => ({
  useDeferredGuideBlocker: jest.fn(),
}));
jest.mock('../../hooks/useOverlayWidthClass', () => ({
  OVERLAY_SHEET_MAX_WIDTH: 540,
  useOverlayWidthClass: () => 'expanded',
}));
jest.mock('../../layouts/Page/PageContext', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return { usePageContext: () => ({}), PageContext: React.createContext({}) };
});
jest.mock('react-native', () => ({
  ...jest.requireActual<typeof import('react-native')>('react-native'),
  useWindowDimensions: () => mockWindow.current,
}));
jest.mock('../../primitives', () => {
  const Box = ({
    children,
    width,
    maxWidth,
  }: {
    children?: ReactNode;
    width?: number;
    maxWidth?: number;
  }) => (
    <div data-panel-width={width} data-panel-max-width={maxWidth}>
      {children}
    </div>
  );
  return { Stack: Box, XStack: Box, YStack: Box, SizableText: Box };
});
jest.mock('../../layouts/ScrollView', () => ({
  ScrollView: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));
jest.mock('../../hocs/NativeSheetPresentation', () => ({
  NativeSheetPresentation: () => null,
}));
jest.mock('../../content/Keyboard', () => ({
  Keyboard: { dismissWithDelay: jest.fn() },
}));
jest.mock('../../content/GlassButtonCapsule', () => ({
  GlassButtonCapsule: ({ children }: { children?: ReactNode }) => children,
}));
jest.mock('../IconButton', () => ({ IconButton: () => null }));
jest.mock('../Trigger', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    // Measures like `measureInWindow`: the rect within the window (or, on
    // iOS inside a native modal, within that modal).
    Trigger: React.forwardRef(
      (
        { children, onPress }: { children?: ReactNode; onPress?: () => void },
        ref: React.Ref<unknown>,
      ) => {
        React.useImperativeHandle(ref, () => ({
          measureInWindow: (
            callback: (x: number, y: number, w: number, h: number) => void,
          ) =>
            callback(
              mockTriggerRect.x,
              mockTriggerRect.y,
              mockTriggerRect.width,
              mockTriggerRect.height,
            ),
        }));
        return (
          <button type="button" data-testid="trigger" onClick={onPress}>
            {children}
          </button>
        );
      },
    ),
  };
});
jest.mock('../../utils/getFontSize', () => ({ NATIVE_HIT_SLOP: {} }));
jest.mock('./useNativePortalLifecycle', () =>
  jest.requireActual<typeof import('./useNativePortalLifecycle.native')>(
    './useNativePortalLifecycle.native',
  ),
);
jest.mock('./popoverSideEffects', () => ({
  runPopoverOpenSideEffects: jest.fn(),
  runPopoverCloseSideEffects: jest.fn(),
}));

const lastOverlay = () => mockOverlayRenders[mockOverlayRenders.length - 1];

function renderPopover() {
  return render(
    <Popover
      title="Menu"
      renderTrigger={triggerContent}
      renderContent={menuContent}
    />,
  );
}

beforeEach(() => {
  jest.useFakeTimers();
  mockOverlayRenders.length = 0;
  mockWindow.current = { width: 1024, height: 768 };
});
afterEach(() => {
  Object.assign(platformEnv, { isNativeAndroid: false, isNativeIOS: true });
  jest.useRealTimers();
});

it('presents an Android anchored panel without waiting for a modal offset', () => {
  Object.assign(platformEnv, { isNativeAndroid: true, isNativeIOS: false });
  renderPopover();
  fireEvent.click(screen.getByTestId('trigger'));

  expect(lastOverlay().visible).toBe(true);
  expect(lastOverlay().onWindowOffset).toBeUndefined();
});

it('waits for the modal offset on iOS before presenting', () => {
  renderPopover();
  fireEvent.click(screen.getByTestId('trigger'));
  expect(lastOverlay().visible).toBe(false);

  act(() => lastOverlay().onWindowOffset?.({ x: 0, y: 0 }));
  expect(lastOverlay().visible).toBe(true);
});

it('asks for the modal offset again when the window resizes', () => {
  const view = renderPopover();
  fireEvent.click(screen.getByTestId('trigger'));
  act(() => lastOverlay().onWindowOffset?.({ x: 0, y: 0 }));
  const request = lastOverlay().windowOffsetRequest ?? 0;

  // The trigger keeps its modal-relative rect while the modal moves.
  mockWindow.current = { width: 1180, height: 820 };
  view.rerender(
    <Popover
      title="Menu"
      renderTrigger={triggerContent}
      renderContent={menuContent}
    />,
  );
  act(() => {
    jest.runOnlyPendingTimers();
  });

  expect(lastOverlay().windowOffsetRequest ?? 0).toBeGreaterThan(request);
});

it.each([
  [{ maxWidth: 240 }, 240],
  [{ width: 320, maxWidth: 240 }, 240],
  [{ maxWidth: '$60' }, 240],
])('respects anchored panel sizing %j', (floatingPanelProps, expectedWidth) => {
  Object.assign(platformEnv, { isNativeAndroid: true, isNativeIOS: false });
  render(
    <Popover
      title="Menu"
      renderTrigger={triggerContent}
      renderContent={menuContent}
      floatingPanelProps={floatingPanelProps}
    />,
  );
  fireEvent.click(screen.getByTestId('trigger'));
  const panel = screen.getByText('Item').closest('[data-panel-max-width]');
  expect(panel?.getAttribute('data-panel-width')).toBe(String(expectedWidth));
  expect(panel?.getAttribute('data-panel-max-width')).toBe(
    String(expectedWidth),
  );
});

it('caps content-sized panels without forcing a fixed width', () => {
  Object.assign(platformEnv, { isNativeAndroid: true, isNativeIOS: false });
  render(
    <Popover
      title="Menu"
      renderTrigger={triggerContent}
      renderContent={menuContent}
      placement="bottom-start"
      floatingPanelProps={{ width: 'auto', maxWidth: 240 }}
    />,
  );
  fireEvent.click(screen.getByTestId('trigger'));
  const panel = screen.getByText('Item').closest('[data-panel-max-width]');
  expect(panel?.getAttribute('data-panel-width')).toBeNull();
  expect(panel?.getAttribute('data-panel-max-width')).toBe('240');
});
