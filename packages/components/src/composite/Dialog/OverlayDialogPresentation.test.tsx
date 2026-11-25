/** @jest-environment jsdom */
import type { ReactNode } from 'react';

import { act, render } from '@testing-library/react';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { OverlayDialogPresentation } from './OverlayDialogPresentation';

import type {
  IOverlaySnapshot,
  IOverlayViewProps,
} from '@onekeyfe/react-native-native-overlay';
const mockOverlayListeners = new Set<() => void>();
let mockOverlaySnapshot: IOverlaySnapshot = { entries: [], queued: [] };
let mockPageHostFocused = true;
let mockProps: IOverlayViewProps;
let mockSurfaceProps: { width?: unknown; pb?: unknown };
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
  overlayStore: {
    getSnapshot: () => mockOverlaySnapshot,
    isPageHostFocused: () => mockPageHostFocused,
    subscribe: (listener: () => void) => {
      mockOverlayListeners.add(listener);
      return () => mockOverlayListeners.delete(listener);
    },
  },
  OverlayView: (props: IOverlayViewProps) => {
    mockProps = props;
    return props.children;
  },
}));
jest.mock('../../hooks/useStyle', () => ({
  useTheme: () => ({
    bg: { val: '#fff' },
    bgApp: { val: '#123456' },
    bgBackdrop: { val: '#0004' },
  }),
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

beforeEach(() => {
  mockOverlaySnapshot = { entries: [], queued: [] };
  mockPageHostFocused = true;
});

function setPageSuspended(suspended: boolean) {
  mockOverlaySnapshot = {
    entries: [
      {
        id: 'dialog',
        scope: 'page',
        ...pageScope,
        level: 'modal',
        strategy: 'stack',
        priority: 0,
        replaceKey: undefined,
        dismissible: true,
        blocking: true,
        statusBarStyle: undefined,
        phase: 'active',
        suspended,
        dismissReason: undefined,
        seq: 1,
      },
    ],
    queued: [],
  };
  act(() => mockOverlayListeners.forEach((listener) => listener()));
}

it.each([true, false])(
  'waits for page visibility after presentation (native=%s)',
  (native) => {
    nativeEnv.isNative = native;
    nativeEnv.isNativeAndroid = native;
    setPageSuspended(true);
    const onVisible = jest.fn();
    render(
      <OverlayDialogPresentation
        {...dialogProps}
        page={pageScope}
        onVisible={onVisible}
      />,
    );
    expect(onVisible).not.toHaveBeenCalled();
    mockProps.onPresented?.();
    expect(onVisible).not.toHaveBeenCalled();
    setPageSuspended(false);
    expect(onVisible).toHaveBeenCalledTimes(1);
    setPageSuspended(true);
    setPageSuspended(false);
    mockProps.onPresented?.();
    expect(onVisible).toHaveBeenCalledTimes(1);
  },
);

it('waits for the web root host to be focused and ignores unrelated store changes', () => {
  nativeEnv.isNative = false;
  mockPageHostFocused = false;
  setPageSuspended(false);
  const onVisible = jest.fn();
  render(
    <OverlayDialogPresentation
      {...dialogProps}
      page={pageScope}
      onVisible={onVisible}
    />,
  );
  mockProps.onPresented?.();
  setPageSuspended(false);
  expect(onVisible).not.toHaveBeenCalled();
  mockPageHostFocused = true;
  setPageSuspended(false);
  expect(onVisible).toHaveBeenCalledTimes(1);
});

it('does not count a suspended dialog that closes before becoming visible', () => {
  setPageSuspended(true);
  const onVisible = jest.fn();
  const view = render(
    <OverlayDialogPresentation
      {...dialogProps}
      page={pageScope}
      onVisible={onVisible}
    />,
  );
  mockProps.onPresented?.();
  view.rerender(
    <OverlayDialogPresentation
      {...dialogProps}
      open={false}
      page={pageScope}
      onVisible={onVisible}
    />,
  );
  setPageSuspended(false);
  expect(onVisible).not.toHaveBeenCalled();
  expect(mockOverlayListeners.size).toBe(0);
});

it('counts global dialogs after presentation and resets for a new opening', () => {
  const onVisible = jest.fn();
  const view = render(
    <OverlayDialogPresentation {...dialogProps} onVisible={onVisible} />,
  );
  expect(onVisible).not.toHaveBeenCalled();
  mockProps.onPresented?.();
  mockProps.onPresented?.();
  expect(onVisible).toHaveBeenCalledTimes(1);
  view.rerender(
    <OverlayDialogPresentation
      {...dialogProps}
      open={false}
      onVisible={onVisible}
    />,
  );
  view.rerender(
    <OverlayDialogPresentation {...dialogProps} onVisible={onVisible} />,
  );
  expect(onVisible).toHaveBeenCalledTimes(1);
  mockProps.onPresented?.();
  expect(onVisible).toHaveBeenCalledTimes(2);
});

it.each([true, false])(
  'excludes closing during entrance and waits for the next presentation (native=%s)',
  (native) => {
    nativeEnv.isNative = native;
    nativeEnv.isNativeAndroid = native;
    const onVisible = jest.fn();
    const props = { ...dialogProps, isSheet: true, onVisible };
    const view = render(<OverlayDialogPresentation {...props} />);
    view.rerender(<OverlayDialogPresentation {...props} open={false} />);
    mockProps.onPresented?.();
    expect(onVisible).not.toHaveBeenCalled();
    view.rerender(<OverlayDialogPresentation {...props} />);
    expect(onVisible).not.toHaveBeenCalled();
    mockProps.onPresented?.();
    expect(onVisible).toHaveBeenCalledTimes(1);
  },
);

afterEach(() => {
  nativeEnv.isNative = true;
  nativeEnv.isNativeAndroid = true;
  mockPlatformOS = 'android';
  mockSafeAreaInsets.left = 0;
  mockSafeAreaInsets.right = 0;
  mockSafeAreaInsets.bottom = 0;
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

it('leaves an iOS global sheet to the width the overlay reports', () => {
  nativeEnv.isNativeAndroid = false;
  mockPlatformOS = 'ios';
  mockSafeAreaInsets.left = 62;
  mockSafeAreaInsets.right = 62;
  render(<OverlayDialogPresentation {...dialogProps} isSheet />);
  // The overlay lays the content out at the platform's sheet width.
  expect(mockSurfaceProps.width).toBeUndefined();
});

it('fits an Android global sheet to the app content beside a side navigation bar', () => {
  mockContentFrame.width = 952;
  render(<OverlayDialogPresentation {...dialogProps} isSheet />);
  // Capped at the overlay's max-width surface.
  expect(mockSurfaceProps.width).toBe(540);

  mockContentFrame.width = 360;
  render(<OverlayDialogPresentation {...dialogProps} isSheet />);
  expect(mockSurfaceProps.width).toBe(360);
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

it('paints the sheet safe-area tail with a literal dialog background', () => {
  render(<OverlayDialogPresentation {...dialogProps} isSheet bg="#0f0f0f" />);
  // A raw color must reach the sheet as-is; resolving it as a theme token used
  // to fall back to the ambient bg and leave a white strip below dark content
  // (OK-67133).
  expect(mockProps.sheet?.backgroundColor).toBe('#0f0f0f');
});

it('resolves a theme token for the sheet surface', () => {
  render(<OverlayDialogPresentation {...dialogProps} isSheet bg="$bgApp" />);
  expect(mockProps.sheet?.backgroundColor).toBe('#123456');
});

it('pads iOS page-scoped sheets by the bottom safe-area inset', () => {
  nativeEnv.isNativeAndroid = false;
  mockPlatformOS = 'ios';
  mockSafeAreaInsets.bottom = 34;

  const { rerender } = render(
    <OverlayDialogPresentation {...dialogProps} isSheet page={pageScope} />,
  );
  expect(mockSurfaceProps.pb).toBe(34);

  // Global iOS sheets rely on UISheetPresentationController for safe area.
  rerender(<OverlayDialogPresentation {...dialogProps} isSheet />);
  expect(mockSurfaceProps.pb).toBeUndefined();

  // Centered cards do not add sheet bottom padding.
  rerender(<OverlayDialogPresentation {...dialogProps} page={pageScope} />);
  expect(mockSurfaceProps.pb).toBeUndefined();

  // Android and web overlays handle bottom insets elsewhere.
  nativeEnv.isNativeAndroid = true;
  mockPlatformOS = 'android';
  rerender(
    <OverlayDialogPresentation {...dialogProps} isSheet page={pageScope} />,
  );
  expect(mockSurfaceProps.pb).toBeUndefined();

  nativeEnv.isNative = false;
  nativeEnv.isNativeAndroid = false;
  mockPlatformOS = 'web';
  rerender(
    <OverlayDialogPresentation {...dialogProps} isSheet page={pageScope} />,
  );
  expect(mockSurfaceProps.pb).toBeUndefined();
});
