/**
 * @jest-environment jsdom
 * @jest-environment-options {"customExportConditions": ["node", "node-addons"]}
 */
// oxlint-disable react-perf/jsx-no-new-function-as-prop, react-perf/jsx-no-new-object-as-prop, react-perf/jsx-no-new-array-as-prop -- test props capture each case's lifecycle state
import type { ComponentProps, ReactNode } from 'react';
import { useState } from 'react';

import { act, fireEvent, render, screen } from '@testing-library/react';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { mountImperativeOverlay } from '../../shared/imperativeOverlayMount';
import {
  ActionList,
  ActionListItem,
  runAfterActionListClose,
} from '../ActionList/index.native';

import { Popover, usePopoverContext } from './index.native';

const mockSheetCallbacks: Array<
  ((info: { open: boolean }) => void) | undefined
> = [];
const mockItemPressResults: unknown[] = [];

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
jest.mock('@tamagui/core', () => ({
  useIsomorphicLayoutEffect:
    jest.requireActual<typeof import('react')>('react').useLayoutEffect,
  withStaticProperties: Object.assign,
}));
jest.mock('@onekeyhq/components', () => ({
  withStaticProperties: Object.assign,
  useMedia: () => ({ md: true, gtMd: true }),
  useTheme: () => ({ bgBackdrop: { val: '#00000044' } }),
  Spinner: () => null,
}));
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isNative: true, isNativeIOS: true, isNativeAndroid: false },
}));
jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    ui: {
      actionList: { actionListOpen: jest.fn(), actionListClose: jest.fn() },
      button: { click: jest.fn(), longPress: jest.fn() },
    },
  },
}));
jest.mock('@onekeyhq/shared/src/keyboard', () => ({
  dismissKeyboard: jest.fn(),
}));
jest.mock('../../hooks', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    useSafeAreaInsets: () => ({ bottom: 20 }),
    useModalNavigatorContext: () => ({}),
    ModalNavigatorContext: React.createContext({}),
  };
});
jest.mock('../../hooks/useDeferredGuideBlocker', () => ({
  useDeferredGuideBlocker: jest.fn(),
}));
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
  const Box = ({
    children,
    testID,
  }: {
    children?: ReactNode;
    testID?: string;
  }) => <div data-testid={testID}>{children}</div>;
  const Pressable = ({
    children,
    testID,
    onPress,
  }: {
    children?: ReactNode;
    testID?: string;
    onPress?: (event: { stopPropagation: () => void }) => unknown;
  }) => (
    <button
      type="button"
      data-testid={testID}
      onClick={(event) => {
        mockItemPressResults.push(onPress?.(event));
      }}
    >
      {children}
    </button>
  );
  return {
    Stack: Box,
    XStack: Box,
    YStack: Box,
    SizableText: Box,
    ButtonFrame: Pressable,
    Heading: Box,
    Icon: Box,
    Skeleton: { BodyLg: Box, BodyMd: Box },
  };
});
jest.mock('../../layouts/ScrollView', () => ({
  ScrollView: ({
    children,
    innerViewRef,
  }: {
    children?: ReactNode;
    innerViewRef?: { current: { measure: (callback: () => void) => void } };
  }) => {
    const React = jest.requireActual<typeof import('react')>('react');
    React.useLayoutEffect(() => {
      if (innerViewRef) {
        innerViewRef.current = { measure: () => undefined };
      }
    });
    return <div>{children}</div>;
  },
}));
jest.mock('../../hocs/NativeSheetPresentation', () => ({
  NativeSheetPresentation: ({
    children,
    open,
    onAnimationComplete,
  }: {
    children?: ReactNode;
    open: boolean;
    onAnimationComplete?: (info: { open: boolean }) => void;
  }) => {
    mockSheetCallbacks.push(onAnimationComplete);
    return (
      <div data-testid="native-sheet" data-open={String(open)}>
        {children}
      </div>
    );
  },
}));
jest.mock('../../content/Keyboard', () => ({
  Keyboard: { dismissWithDelay: jest.fn() },
}));
jest.mock('../../content/Divider', () => ({ Divider: () => null }));
jest.mock('../../content/GlassButtonCapsule', () => ({
  GlassButtonCapsule: ({ children }: { children?: ReactNode }) => children,
}));
jest.mock('../IconButton', () => ({ IconButton: () => null }));
jest.mock('../Trigger', () => ({
  Trigger: ({
    children,
    onPress,
  }: {
    children?: ReactNode;
    onPress?: () => void;
  }) => (
    <button type="button" onClick={onPress}>
      {children}
    </button>
  ),
}));
jest.mock('../Shortcut', () => ({ Shortcut: () => null }));
jest.mock('../LazyPopover', () => ({
  LazyPopover: (props: ComponentProps<typeof Popover>) => {
    const React = jest.requireActual<typeof import('react')>('react');
    const NativePopover =
      jest.requireActual<typeof import('./index.native')>(
        './index.native',
      ).Popover;
    return React.createElement(NativePopover, props);
  },
}));
jest.mock('./useNativePortalLifecycle', () =>
  jest.requireActual<typeof import('./useNativePortalLifecycle.native')>(
    './useNativePortalLifecycle.native',
  ),
);
jest.mock('../ActionList/useAsyncItemsLifecycle', () =>
  jest.requireActual<
    typeof import('../ActionList/useAsyncItemsLifecycle.native')
  >('../ActionList/useAsyncItemsLifecycle.native'),
);
jest.mock('../../shared/imperativeOverlayMount', () => ({
  mountImperativeOverlay: jest.fn(),
}));
jest.mock('../../utils/getFontSize', () => ({ NATIVE_HIT_SLOP: {} }));
jest.mock('./popoverSideEffects', () => ({
  runPopoverOpenSideEffects: jest.fn(),
  runPopoverCloseSideEffects: jest.fn(),
}));

beforeEach(() => {
  jest.useFakeTimers();
  mockSheetCallbacks.length = 0;
  mockItemPressResults.length = 0;
  jest.mocked(mountImperativeOverlay).mockReset();
});
afterEach(() => {
  Object.assign(platformEnv, { isNativeAndroid: false, isNativeIOS: true });
  jest.useRealTimers();
});

it('closes a shown ActionList before its component mounts', () => {
  const destroy = jest.fn();
  jest.mocked(mountImperativeOverlay).mockReturnValue({
    update: jest.fn(),
    destroy,
  });

  const handle = ActionList.show({ title: 'Options', items: [] });
  expect(handle.close()).toBeUndefined();
  expect(destroy).toHaveBeenCalledTimes(1);
});

it('publishes a shown ActionList close before notifying its imperative lifecycle', async () => {
  const host = render(<div />);
  const destroy = jest.fn();
  jest.mocked(mountImperativeOverlay).mockImplementation(({ node }) => {
    host.rerender(<>{node}</>);
    return { update: jest.fn(), destroy };
  });

  let handle: ReturnType<typeof ActionList.show> | undefined;
  let completionInCallback: void | Promise<void> = undefined;
  act(() => {
    handle = ActionList.show({
      title: 'Options',
      items: [],
      sheetProps: { snapPointsMode: 'percent', snapPoints: [70] },
      onOpenChange: (isOpen) => {
        if (!isOpen) completionInCallback = handle?.close();
      },
    });
  });
  act(() => jest.advanceTimersByTime(16));
  expect(screen.getByTestId('native-sheet').dataset.open).toBe('true');

  let completion: void | Promise<void> = undefined;
  act(() => {
    completion = handle?.close();
  });
  expect(completionInCallback).toBe(completion);
  expect(completion).toBeInstanceOf(Promise);
  expect(destroy).not.toHaveBeenCalled();
  act(() => mockSheetCallbacks.at(-1)?.({ open: false }));
  await Promise.resolve(completion);
  expect(destroy).toHaveBeenCalledTimes(1);
});

it('does not reopen a shown Android ActionList after immediate close', async () => {
  Object.assign(platformEnv, { isNativeAndroid: true, isNativeIOS: false });
  const host = render(<div />);
  const destroy = jest.fn();
  jest.mocked(mountImperativeOverlay).mockImplementation(({ node }) => {
    host.rerender(<>{node}</>);
    return { update: jest.fn(), destroy };
  });

  let handle: ReturnType<typeof ActionList.show> | undefined;
  act(() => {
    handle = ActionList.show({ title: 'Options', items: [] });
  });
  let completion: void | Promise<void> = undefined;
  act(() => {
    completion = handle?.close();
  });
  expect(completion).toBeInstanceOf(Promise);
  await Promise.resolve(completion);
  act(() => jest.advanceTimersByTime(16));
  expect(screen.queryByTestId('native-sheet')).toBeNull();
  expect(destroy).toHaveBeenCalledTimes(1);
});

it('settles ActionList close before the deferred native sheet is presented', async () => {
  let close: (() => void | Promise<void>) | undefined;
  render(
    <ActionList
      title="Options"
      defaultOpen
      renderTrigger={null}
      renderItems={({ handleActionListClose }) => {
        close = handleActionListClose;
        return <div>Item</div>;
      }}
    />,
  );

  let completion: void | Promise<void> = undefined;
  act(() => {
    completion = close?.();
  });
  expect(completion).toBeInstanceOf(Promise);
  let settled = false;
  void Promise.resolve(completion).then(() => {
    settled = true;
  });
  await Promise.resolve();
  expect(settled).toBe(true);
});

it('keeps the second ActionList close pending after a rapid reopen', async () => {
  let close: (() => void | Promise<void>) | undefined;
  let open: (() => void) | undefined;
  render(
    <ActionList
      title="Options"
      defaultOpen
      renderTrigger={null}
      sheetProps={{ snapPointsMode: 'percent', snapPoints: [70] }}
      renderItems={({ handleActionListClose, handleActionListOpen }) => {
        close = handleActionListClose;
        open = handleActionListOpen;
        return <div>Item</div>;
      }}
    />,
  );
  act(() => jest.advanceTimersByTime(16));
  const oldCallback = mockSheetCallbacks.at(-1);
  let firstClose: void | Promise<void> = undefined;
  act(() => {
    firstClose = close?.();
  });
  const afterFirstClose = jest.fn();
  const firstAction = (async () => {
    await Promise.resolve(firstClose);
    afterFirstClose();
  })();
  act(() => open?.());
  await expect(firstAction).rejects.toThrow('canceled');
  expect(afterFirstClose).not.toHaveBeenCalled();
  let secondClose: void | Promise<void> = undefined;
  act(() => {
    secondClose = close?.();
  });
  let settled = false;
  void Promise.resolve(secondClose).then(() => {
    settled = true;
  });
  act(() => oldCallback?.({ open: false }));
  await Promise.resolve();
  expect(settled).toBe(false);
  act(() => mockSheetCallbacks.at(-1)?.({ open: false }));
  await Promise.resolve(secondClose);
  expect(settled).toBe(true);
});

it.each([0, 100])(
  'stops an ActionList item action after cancellation (debounce: %s ms)',
  async (onPressDebounce) => {
    const businessAction = jest.fn();
    let reopen: (() => void) | undefined;
    const pressProps = onPressDebounce ? { onPressDebounce } : {};
    render(
      <ActionList
        title="Options"
        defaultOpen
        renderTrigger={null}
        sheetProps={{ snapPointsMode: 'percent', snapPoints: [70] }}
        items={[
          {
            ...pressProps,
            label: 'Item',
            testID: 'item',
            onPress: (close) => runAfterActionListClose(close, businessAction),
          },
        ]}
        renderItems={({ handleActionListOpen }) => {
          reopen = handleActionListOpen;
          return null;
        }}
      />,
    );
    act(() => jest.advanceTimersByTime(16));
    expect(screen.getByTestId('native-sheet').dataset.open).toBe('true');
    fireEvent.click(screen.getByTestId('item'));
    const press = mockItemPressResults.at(-1);
    if (onPressDebounce === 0) {
      expect(press).toBeUndefined();
      act(() => jest.advanceTimersByTime(0));
    } else {
      expect(press).toBeInstanceOf(Promise);
    }
    expect(screen.getByTestId('native-sheet').dataset.open).toBe('false');
    act(() => reopen?.());

    if (onPressDebounce > 0) {
      await expect(press).resolves.toBeUndefined();
    }
    await Promise.resolve();
    expect(businessAction).not.toHaveBeenCalled();
  },
);

it('preserves an ordinary ActionList item rejection', async () => {
  const businessError = new Error('business failed');
  const pressProps = { onPressDebounce: 100 };
  render(
    <ActionList
      title="Options"
      defaultOpen
      renderTrigger={null}
      items={[
        {
          ...pressProps,
          label: 'Item',
          testID: 'item',
          onPress: async () => {
            throw businessError;
          },
        },
      ]}
    />,
  );
  act(() => jest.advanceTimersByTime(16));
  fireEvent.click(screen.getByTestId('item'));

  await expect(mockItemPressResults.at(-1)).rejects.toBe(businessError);
});

it('stops a Popover item action after a programmatic reopen', async () => {
  const businessAction = jest.fn();
  let setOpen: ((value: boolean) => void) | undefined;
  function Content() {
    const { closePopover } = usePopoverContext();
    return (
      <ActionListItem
        label="Item"
        testID="popover-item"
        onClose={() => closePopover?.()}
        onPress={(close) => runAfterActionListClose(close, businessAction)}
      />
    );
  }
  function Example() {
    const [open, updateOpen] = useState(true);
    setOpen = updateOpen;
    return (
      <Popover
        title="Options"
        open={open}
        onOpenChange={updateOpen}
        renderTrigger={null}
        renderContent={Content}
        sheetProps={{ snapPointsMode: 'percent', snapPoints: [70] }}
      />
    );
  }
  render(<Example />);
  act(() => jest.advanceTimersByTime(16));
  expect(screen.getByTestId('native-sheet').dataset.open).toBe('true');
  fireEvent.click(screen.getByTestId('popover-item'));
  const press = mockItemPressResults.at(-1);
  expect(press).toBeUndefined();
  act(() => jest.advanceTimersByTime(0));
  expect(screen.getByTestId('native-sheet').dataset.open).toBe('false');
  act(() => setOpen?.(true));

  await Promise.resolve();
  expect(businessAction).not.toHaveBeenCalled();
});

it('does not resolve a reopened Popover close from the previous exit', async () => {
  let setOpen: ((value: boolean) => void) | undefined;
  let closePopover: (() => Promise<void>) | undefined;
  function Content() {
    closePopover = usePopoverContext().closePopover;
    return <div>Content</div>;
  }
  function Example() {
    const [open, updateOpen] = useState(true);
    setOpen = updateOpen;
    return (
      <Popover
        title="Options"
        open={open}
        onOpenChange={updateOpen}
        renderTrigger={null}
        renderContent={Content}
        sheetProps={{ snapPointsMode: 'percent', snapPoints: [70] }}
      />
    );
  }
  render(<Example />);
  act(() => jest.advanceTimersByTime(16));
  expect(screen.getByTestId('native-sheet').dataset.open).toBe('true');
  const oldCallback = mockSheetCallbacks.at(-1);
  let firstClose: Promise<void> | undefined;
  act(() => {
    firstClose = closePopover?.();
  });
  const afterFirstClose = jest.fn();
  const firstAction = (async () => {
    await firstClose;
    afterFirstClose();
  })();
  act(() => setOpen?.(true));
  await expect(firstAction).rejects.toThrow('canceled');
  expect(afterFirstClose).not.toHaveBeenCalled();
  let secondClose: Promise<void> | undefined;
  act(() => {
    secondClose = closePopover?.();
  });
  let settled = false;
  void secondClose?.then(() => {
    settled = true;
  });
  act(() => oldCallback?.({ open: false }));
  await Promise.resolve();
  expect(settled).toBe(false);
  act(() => mockSheetCallbacks.at(-1)?.({ open: false }));
  await Promise.resolve();
  expect(settled).toBe(true);
});
