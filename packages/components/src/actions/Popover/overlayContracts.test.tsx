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

import { autoUpdate } from '@floating-ui/dom';
import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from '@testing-library/react';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useIsDeferredGuideBlocked } from '../../hooks/useDeferredGuideBlocker';
import {
  GlassHeaderProvider,
  useInGlassHeader,
} from '../../primitives/Button/GlassHeaderContext';
import { ShowCustom } from '../Toast/ShowCustom';

import { Popover as NativePopover } from './index.native';

let mockNarrow = false;
let mockNativeContentHeight = 100;
let mockEmitContentSize = true;
let mockBottomInset = 20;
const mockNativeMeasureCallbacks: Array<
  (x: number, y: number, width: number, height: number) => void
> = [];
const mockScrollViewMargins: Array<number | string | undefined> = [];
const mockPlatformEnv = platformEnv as unknown as {
  isNativeIOS: boolean;
  isNative: boolean;
};
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
jest.mock('@react-navigation/elements', () => ({
  HeaderHeightContext: jest
    .requireActual<typeof import('react')>('react')
    .createContext(undefined),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0 }),
}));
jest.mock(
  '@onekeyhq/shared/src/modules/DualScreenInfo/isFoldableIPhone',
  () => ({ isFoldableIPhone: () => false }),
);
jest.mock('../../hooks', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    useSafeAreaInsets: () => ({ bottom: mockBottomInset }),
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
    mb,
    onContentSizeChange,
    innerViewRef,
  }: {
    children?: ReactNode;
    mb?: number | string;
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
    mockScrollViewMargins.push(mb);
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
jest.mock('@floating-ui/dom', () => ({
  ...jest.requireActual<typeof import('@floating-ui/dom')>('@floating-ui/dom'),
  computePosition: jest
    .fn()
    .mockResolvedValue({ x: 240, y: 132, placement: 'bottom-end' }),
  autoUpdate: jest.fn(
    (_reference: Element, _floating: HTMLElement, update: () => void) => {
      update();
      return () => {};
    },
  ),
}));
jest.mock('@onekeyfe/react-native-native-overlay', () => ({
  useNestedOverlayLevel: () => 'modal',
  getAnchoredTransformOrigin: (placement: string) =>
    placement === 'bottom-end' ? 'right top' : undefined,
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
  mockBottomInset = 20;
  mockPlatformEnv.isNativeIOS = true;
  mockNativeMeasureCallbacks.length = 0;
  mockScrollViewMargins.length = 0;
});
function resolveNativeMeasure(
  callback: (x: number, y: number, width: number, height: number) => void,
  height: number,
) {
  act(() => callback(0, 0, 300, height));
}

it.each([true, false])(
  'isolates native sheet content from glass header styles (iOS: %s)',
  (isNativeIOS) => {
    mockPlatformEnv.isNativeIOS = isNativeIOS;
    const onPress = jest.fn();
    function TriggerContent() {
      return <span>Glass trigger: {String(useInGlassHeader())}</span>;
    }
    function Content() {
      return (
        <button type="button" onClick={onPress}>
          Glass content: {String(useInGlassHeader())}
        </button>
      );
    }
    render(
      <GlassHeaderProvider>
        <NativePopover
          title="Translate"
          open
          renderTrigger={<TriggerContent />}
          renderContent={<Content />}
        />
      </GlassHeaderProvider>,
    );
    expect(screen.getByText('Glass trigger: true')).toBeTruthy();
    fireEvent.click(
      screen.getByRole('button', { name: 'Glass content: false' }),
    );
    expect(onPress).toHaveBeenCalledTimes(1);
  },
);

it('anchors a triggerless web panel to the supplied live toolbar element', async () => {
  const button = document.createElement('button');
  document.body.appendChild(button);
  const { unmount } = render(
    <Popover
      title="Filter"
      open
      renderTrigger={null}
      webAnchorElement={button}
      nativeAnchorRect={{ x: 240, y: 300, width: 38, height: 38 }}
      renderContent={<button type="button">Item</button>}
    />,
  );
  try {
    await waitFor(() =>
      expect(autoUpdate).toHaveBeenCalledWith(
        button,
        expect.any(HTMLElement),
        expect.any(Function),
        { animationFrame: true },
      ),
    );
  } finally {
    unmount();
    button.remove();
  }
});

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
it('does not reserve the sheet bottom inset inside headerless fitted sheets', async () => {
  // The fitted height already stops above the bottom inset; a second inside
  // margin would be taken out of the headerless content and clip it.
  render(
    <NativePopover
      open
      title=""
      showHeader={false}
      renderTrigger={null}
      renderContent={<input aria-label="Headerless fit content" />}
    />,
  );
  await waitFor(() =>
    expect(screen.getByTestId('native-sheet').dataset.height).toBe('100'),
  );
  expect(mockScrollViewMargins.at(-1)).toBe(0);
});
it('keeps the fallback content margin when the fitted sheet has no inset', async () => {
  mockBottomInset = 0;
  render(
    <NativePopover
      open
      title=""
      showHeader={false}
      renderTrigger={null}
      renderContent={<input aria-label="Headerless fit content" />}
    />,
  );
  await waitFor(() =>
    expect(screen.getByTestId('native-sheet').dataset.height).toBe('120'),
  );
  expect(mockScrollViewMargins.at(-1)).toBe(20);
});
it('keeps the content margin on Android fitted sheets', async () => {
  // Android detents include the bottom inset, so the fitted height and the
  // content margin already match; the fix must not change them.
  mockPlatformEnv.isNativeIOS = false;
  render(
    <NativePopover
      open
      title=""
      showHeader={false}
      renderTrigger={null}
      renderContent={<input aria-label="Headerless fit content" />}
    />,
  );
  await waitFor(() =>
    expect(screen.getByTestId('native-sheet').dataset.height).toBe('120'),
  );
  expect(mockScrollViewMargins.at(-1)).toBe(20);
});
it('keeps the bottom inset margin inside percent sheets', () => {
  render(
    <NativePopover
      open
      title=""
      renderTrigger={null}
      sheetProps={{ snapPointsMode: 'percent', snapPoints: [70] }}
      renderContent={<input aria-label="Percent content" />}
    />,
  );
  expect(screen.getByTestId('native-sheet').dataset.height).toBe('680');
  expect(mockScrollViewMargins.at(-1)).toBe(20);
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
    // The overlay scales the panel from the resolved placement.
    expect(panel?.dataset.placement).toBe('bottom-end');
    expect(panel?.style.transformOrigin).toBe('right top');
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

describe('hover and trigger press interaction', () => {
  const hoverable = { delay: { open: 250 } };

  function renderHoverPopover() {
    render(
      <Popover
        title="Rates"
        hoverable={hoverable}
        renderTrigger="Rate details"
        renderContent={<span>Rate breakdown</span>}
      />,
    );
    return screen.getByRole('button', { name: 'Rate details' });
  }

  function advance(ms: number) {
    act(() => jest.advanceTimersByTime(ms));
  }

  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    cleanup();
    jest.useRealTimers();
  });

  it('stays closed after reentering an open trigger and clicking it', () => {
    const trigger = renderHoverPopover();
    fireEvent.mouseEnter(trigger);
    advance(250);
    expect(screen.queryByTestId('overlay')).not.toBeNull();

    fireEvent.mouseLeave(trigger);
    advance(50);
    fireEvent.mouseEnter(trigger);
    advance(50);
    fireEvent.click(trigger);
    expect(screen.queryByTestId('overlay')).toBeNull();

    advance(250);
    expect(screen.queryByTestId('overlay')).toBeNull();
  });

  it('stays closed after clicking open and closed before hover finishes', () => {
    const trigger = renderHoverPopover();
    fireEvent.mouseEnter(trigger);
    advance(50);
    fireEvent.click(trigger);
    expect(screen.queryByTestId('overlay')).not.toBeNull();

    advance(50);
    fireEvent.click(trigger);
    advance(250);
    expect(screen.queryByTestId('overlay')).toBeNull();
  });

  it('does not request reopening after the controlled owner closes', () => {
    const onOpenChange = jest.fn();
    const props = {
      title: 'Rates',
      hoverable,
      onOpenChange,
      renderTrigger: 'Rate details',
      renderContent: <span>Rate breakdown</span>,
    };
    const view = render(<Popover {...props} open />);
    fireEvent.mouseEnter(screen.getByRole('button', { name: 'Rate details' }));
    advance(50);
    view.rerender(<Popover {...props} open={false} />);

    advance(250);
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(screen.queryByTestId('overlay')).toBeNull();
  });

  it('accepts a new hover after a controlled close', () => {
    const onOpenChange = jest.fn();
    const props = {
      title: 'Rates',
      hoverable,
      onOpenChange,
      renderTrigger: 'Rate details',
      renderContent: <span>Rate breakdown</span>,
    };
    const view = render(<Popover {...props} open />);
    const trigger = screen.getByRole('button', { name: 'Rate details' });
    fireEvent.mouseLeave(trigger);
    advance(100);
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
    view.rerender(<Popover {...props} open={false} />);

    fireEvent.mouseEnter(trigger);
    advance(249);
    expect(onOpenChange).toHaveBeenCalledTimes(1);
    advance(1);
    expect(onOpenChange).toHaveBeenLastCalledWith(true);
    view.rerender(<Popover {...props} open />);
    expect(screen.queryByTestId('overlay')).not.toBeNull();
  });
});
