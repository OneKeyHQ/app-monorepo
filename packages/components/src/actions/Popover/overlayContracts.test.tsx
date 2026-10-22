/**
 * @jest-environment jsdom
 * @jest-environment-options {"customExportConditions": ["node", "node-addons"]}
 */
/* cspell:ignore hoverable */
// Test fixtures intentionally construct fresh props to exercise updates.
/* oxlint-disable react-perf/jsx-no-new-object-as-prop, react-perf/jsx-no-jsx-as-prop, react-perf/jsx-no-new-function-as-prop */

import type { ReactNode } from 'react';
import { useState } from 'react';

import { Popover } from '.';

import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from '@testing-library/react';

import { useIsDeferredGuideBlocked } from '../../hooks/useDeferredGuideBlocker';
import { ShowCustom } from '../Toast/ShowCustom';

import { Popover as NativePopover } from './index.native';

let mockNarrow = false;
let mockNativeContentHeight = 100;
let mockEmitContentSize = true;
const mockNativeMeasureCallbacks: Array<
  (x: number, y: number, width: number, height: number) => void
> = [];
jest.mock('../../utils/getFontSize', () => ({ NATIVE_HIT_SLOP: {} }));
jest.mock('@onekeyhq/components/src/shared/tamagui', () => ({
  withStaticProperties: Object.assign,
  useMedia: () => ({ md: mockNarrow, gtMd: !mockNarrow }),
  useTheme: () => ({ bgBackdrop: { val: '#00000044' } }),
}));
jest.mock('@tamagui/core', () => ({
  useIsomorphicLayoutEffect:
    jest.requireActual<typeof import('react')>('react').useLayoutEffect,
}));
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isNativeIOS: true, isNative: true },
}));
jest.mock('../../hooks', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    useSafeAreaInsets: () => ({ bottom: 20 }),
    useModalNavigatorContext: () => ({}),
    ModalNavigatorContext: React.createContext({}),
  };
});
jest.mock('../../hooks/useLayout', () => ({
  useSafeAreaInsets: () => ({ top: 20 }),
}));
jest.mock('../../hooks/usePage', () => ({ usePageWidth: () => 400 }));
jest.mock('../../layouts/Page/PageContext', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return { usePageContext: () => ({}), PageContext: React.createContext({}) };
});
jest.mock('react-native', () => ({
  ...jest.requireActual<typeof import('react-native')>('react-native'),
  useWindowDimensions: () => ({ height: 1000, width: 400 }),
}));
jest.mock('../../primitives', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const Box = React.forwardRef<
    HTMLDivElement,
    {
      children?: ReactNode;
      onLayout?: (event: object) => void;
      testID?: string;
      height?: number;
    }
  >(function Box({ children, onLayout, testID, height }, ref) {
    React.useEffect(() => {
      onLayout?.({ nativeEvent: { layout: { height: 40 } } });
    }, [onLayout]);
    return (
      <div ref={ref} data-testid={testID} data-height={height}>
        {children}
      </div>
    );
  });
  return {
    Stack: Box,
    XStack: Box,
    YStack: Box,
    SizableText: Box,
    ThemeableStack: Box,
  };
});
jest.mock('../../layouts/ScrollView', () => ({
  ScrollView: ({
    children,
    onContentSizeChange,
    innerViewRef,
  }: {
    children?: ReactNode;
    onContentSizeChange?: (w: number, h: number) => void;
    innerViewRef?: {
      current: {
        measure: (
          callback: (
            x: number,
            y: number,
            width: number,
            height: number,
          ) => void,
        ) => void;
      } | null;
    };
  }) => {
    const React = jest.requireActual<typeof import('react')>('react');
    const contentHeight = mockNativeContentHeight;
    const contentSizeChangeRef = React.useRef(onContentSizeChange);
    contentSizeChangeRef.current = onContentSizeChange;
    React.useLayoutEffect(() => {
      if (innerViewRef) {
        innerViewRef.current = {
          measure: (callback) => {
            mockNativeMeasureCallbacks.push(callback);
          },
        };
      }
    });
    React.useEffect(() => {
      if (mockEmitContentSize) {
        contentSizeChangeRef.current?.(300, contentHeight);
      }
    }, [contentHeight]);
    return <div>{children}</div>;
  },
}));
jest.mock('../../hocs/NativeSheetPresentation', () => ({
  NativeSheetPresentation: ({
    children,
    open,
    height,
  }: {
    children?: ReactNode;
    open: boolean;
    height?: number;
  }) => (
    <div
      data-testid="native-sheet"
      data-open={String(open)}
      data-height={height}
    >
      {children}
    </div>
  ),
}));
jest.mock('./useNativePortalLifecycle', () => ({
  useNativePortalLifecycle: ({
    isOpen,
    sheetProps,
  }: {
    isOpen: boolean;
    sheetProps?: object;
  }) => ({
    popoverOpen: isOpen,
    isNativePortalMounted: isOpen,
    shouldUseNativePortalLifecycle: true,
    resolvedSheetProps: sheetProps,
  }),
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
    Trigger: React.forwardRef<
      HTMLButtonElement,
      { children?: ReactNode; onPress?: () => void }
    >(function Trigger({ children, onPress }, ref) {
      return (
        <button ref={ref} type="button" onClick={onPress}>
          {children}
        </button>
      );
    }),
  };
});
jest.mock('./popoverSideEffects', () => ({
  runPopoverOpenSideEffects: jest.fn(),
  runPopoverCloseSideEffects: jest.fn(),
}));
jest.mock('./anchoredPopover', () => ({
  ...jest.requireActual<typeof import('./anchoredPopover')>(
    './anchoredPopover',
  ),
  useHoverOpen: jest.fn(),
}));
jest.mock('@floating-ui/dom', () => ({
  ...jest.requireActual<typeof import('@floating-ui/dom')>('@floating-ui/dom'),
  computePosition: jest.fn().mockResolvedValue({ x: 240, y: 132 }),
  autoUpdate: jest.fn(
    (_reference: Element, _floating: HTMLElement, update: () => void) => {
      update();
      return () => {};
    },
  ),
}));
jest.mock('@onekeyfe/react-native-native-overlay', () => ({
  useNestedOverlayLevel: () => 'modal',
  OverlayView: ({
    children,
    visible,
    presentation,
    sheet,
  }: {
    children?: ReactNode;
    visible: boolean;
    presentation: string;
    sheet?: { height?: number };
  }) =>
    visible ? (
      <div
        data-testid="overlay"
        data-presentation={presentation}
        data-height={sheet?.height}
      >
        {children}
      </div>
    ) : null,
}));

beforeEach(() => {
  mockNarrow = false;
  mockNativeContentHeight = 100;
  mockEmitContentSize = true;
  mockNativeMeasureCallbacks.length = 0;
});
function resolveNativeMeasure(
  callback: (x: number, y: number, width: number, height: number) => void,
  height: number,
) {
  act(() => callback(0, 0, 300, height));
}
it('uses the requested percentage for a narrow web sheet', () => {
  mockNarrow = true;
  render(
    <Popover
      title="List"
      open
      renderTrigger={null}
      sheetProps={{ snapPointsMode: 'percent', snapPoints: [70] }}
      renderContent={<button type="button">Item</button>}
    />,
  );
  expect(screen.getByTestId('overlay').dataset.height).toBe('700');
});
it('keeps native controls and a sheet when usingSheet is false', async () => {
  function Example() {
    const [open, setOpen] = useState(false);
    return (
      <NativePopover
        title="Indicators"
        usingSheet={false}
        open={open}
        onOpenChange={setOpen}
        renderTrigger="Indicators"
        renderContent={<input aria-label="Search indicator" />}
      />
    );
  }
  render(<Example />);
  fireEvent.click(screen.getByRole('button', { name: 'Indicators' }));
  await waitFor(() =>
    expect(screen.getByTestId('native-sheet').dataset.open).toBe('true'),
  );
  expect(screen.getByLabelText('Search indicator')).toBeTruthy();
});
it('keeps percentage height and guide blocking for native sheets', () => {
  const blocked = renderHook(() => useIsDeferredGuideBlocked());
  const view = render(
    <NativePopover
      title="Accounts"
      open
      renderTrigger={null}
      sheetProps={{ snapPointsMode: 'percent', snapPoints: [70] }}
      renderContent={<input aria-label="Search account" />}
    />,
  );
  expect(screen.getByTestId('native-sheet').dataset.height).toBe('680');
  expect(blocked.result.current).toBe(true);
  view.unmount();
  expect(blocked.result.current).toBe(false);
});
it('measures the new fit content when its renderer changes before the first size event settles', async () => {
  const FirstContent = () => <div>First</div>;
  const NextContent = () => <div>Next</div>;
  const view = render(
    <NativePopover
      title="Fit"
      open
      renderTrigger={null}
      renderContent={FirstContent}
    />,
  );
  expect(mockNativeMeasureCallbacks.shift()).toBeDefined();
  expect(screen.getByTestId('native-sheet').dataset.open).toBe('false');

  view.rerender(
    <NativePopover
      title="Fit"
      open
      renderTrigger={null}
      renderContent={NextContent}
    />,
  );
  expect(mockNativeMeasureCallbacks).toHaveLength(1);
  expect(screen.getByTestId('native-sheet').dataset.height).toBeUndefined();
  resolveNativeMeasure(mockNativeMeasureCallbacks.shift()!, 100);
  await waitFor(() => {
    expect(screen.getByTestId('native-sheet').dataset.open).toBe('true');
    expect(screen.getByTestId('native-sheet').dataset.height).toBe('138');
  });
  view.rerender(
    <NativePopover
      open
      title="Unrelated title"
      renderTrigger={null}
      renderContent={NextContent}
    />,
  );
  expect(mockNativeMeasureCallbacks).toHaveLength(0);
});
it('uses real content-size changes and ignores older measurements in the same generation', async () => {
  mockEmitContentSize = false;
  const StableContent = () => <div>Current</div>;
  const view = render(
    <NativePopover
      title="Fit"
      open
      renderTrigger={null}
      renderContent={StableContent}
    />,
  );
  const oldMeasure = mockNativeMeasureCallbacks.shift();
  expect(oldMeasure).toBeDefined();
  mockEmitContentSize = true;
  mockNativeContentHeight = 240;
  view.rerender(
    <NativePopover
      title="Fit"
      open
      renderTrigger={null}
      renderContent={StableContent}
    />,
  );
  resolveNativeMeasure(oldMeasure!, 100);
  await waitFor(() =>
    expect(screen.getByTestId('native-sheet').dataset.height).toBe('278'),
  );
  mockNativeContentHeight = 280;
  view.rerender(
    <NativePopover
      title="Fit"
      open
      renderTrigger={null}
      renderContent={StableContent}
    />,
  );
  await waitFor(() =>
    expect(screen.getByTestId('native-sheet').dataset.height).toBe('318'),
  );
});
it('ignores stale generation and closed measurements before a fit sheet reopens', async () => {
  mockEmitContentSize = false;
  const FirstContent = () => <div>First</div>;
  const NextContent = () => <div>Next</div>;
  const view = render(
    <NativePopover
      title="Fit"
      open
      keepChildrenMounted
      renderTrigger={null}
      renderContent={FirstContent}
    />,
  );
  const firstMeasure = mockNativeMeasureCallbacks.shift();
  view.rerender(
    <NativePopover
      title="Fit"
      open
      keepChildrenMounted
      renderTrigger={null}
      renderContent={NextContent}
    />,
  );
  const nextMeasure = mockNativeMeasureCallbacks.shift();
  resolveNativeMeasure(firstMeasure!, 100);
  expect(screen.getByTestId('native-sheet').dataset.open).toBe('false');
  view.rerender(
    <NativePopover
      title="Fit"
      open={false}
      keepChildrenMounted
      renderTrigger={null}
      renderContent={NextContent}
    />,
  );
  resolveNativeMeasure(nextMeasure!, 200);
  view.rerender(
    <NativePopover
      title="Fit"
      open
      keepChildrenMounted
      renderTrigger={null}
      renderContent={NextContent}
    />,
  );
  expect(screen.getByTestId('native-sheet').dataset.open).toBe('false');
  resolveNativeMeasure(mockNativeMeasureCallbacks.shift()!, 240);
  await waitFor(() =>
    expect(screen.getByTestId('native-sheet').dataset.height).toBe('278'),
  );
});
it('blocks deferred guides only while the custom toast is open', () => {
  const blocked = renderHook(() => useIsDeferredGuideBlocked());
  const view = render(<ShowCustom open>Custom toast</ShowCustom>);
  expect(blocked.result.current).toBe(true);
  view.rerender(<ShowCustom open={false}>Custom toast</ShowCustom>);
  expect(blocked.result.current).toBe(false);
});
it.each([false, true])(
  'positions the mounted panel with a focus scope (hoverable=%s)',
  async (hoverable) => {
    render(
      <Popover
        title="Assets"
        open
        hoverable={hoverable}
        renderTrigger="Choose asset"
        renderContent={<button type="button">Asset</button>}
      />,
    );
    const panel = screen.getByTestId('popover-panel').parentElement;
    await waitFor(() => {
      expect(panel?.style.left).toBe('240px');
      expect(panel?.style.top).toBe('132px');
    });
  },
);
it('focuses actions and forwards both autofocus callbacks', async () => {
  const onOpenAutoFocus = jest.fn();
  const onCloseAutoFocus = jest.fn();
  const props = {
    title: 'Actions',
    renderTrigger: null,
    renderContent: <button type="button">First action</button>,
    floatingPanelProps: { onOpenAutoFocus, onCloseAutoFocus },
  };
  const view = render(<Popover {...props} open={false} />);
  view.rerender(<Popover {...props} open />);
  await waitFor(() =>
    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: 'First action' }),
    ),
  );
  expect(onOpenAutoFocus).toHaveBeenCalledTimes(1);
  view.rerender(<Popover {...props} open={false} />);
  await waitFor(() => expect(onCloseAutoFocus).toHaveBeenCalledTimes(1));
});
it('leaves focus alone for hover panels', async () => {
  const outside = document.createElement('button');
  document.body.appendChild(outside);
  outside.focus();
  const onOpenAutoFocus = jest.fn();
  const view = render(
    <Popover
      title="Hover"
      open
      hoverable
      renderTrigger={null}
      floatingPanelProps={{ onOpenAutoFocus }}
      renderContent={<button type="button">Hover action</button>}
    />,
  );
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 30));
  });
  expect(document.activeElement).toBe(outside);
  expect(onOpenAutoFocus).not.toHaveBeenCalled();
  view.unmount();
  outside.remove();
});
