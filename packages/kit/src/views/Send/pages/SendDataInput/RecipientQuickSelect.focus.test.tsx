/** @jest-environment jsdom */

import { act, fireEvent, render, screen } from '@testing-library/react';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import RecipientQuickSelect from './RecipientQuickSelect';

const mockScrollHeaderToOffset = jest.fn();
const mockScrollHeaderBy = jest.fn();
let mockPageSelected:
  | ((event: { nativeEvent: { position: number } }) => void)
  | undefined;
let mockPageScrollStateChanged:
  | ((event: { nativeEvent: { pageScrollState: string } }) => void)
  | undefined;
const mockKeyboardListeners = new Map<
  string,
  (event: { endCoordinates: { screenY: number; height: number } }) => void
>();
let mockRequestFocus:
  | ((field: {
      measureInWindow: (callback: (...bounds: number[]) => void) => void;
    }) => void)
  | undefined;

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isNative: true, isNativeIOS: true, isNativeAndroid: false },
}));

jest.mock('react-native', () => ({
  Dimensions: { get: () => ({ height: 900 }) },
  Keyboard: {
    addListener: (
      name: string,
      callback: (event: {
        endCoordinates: { screenY: number; height: number };
      }) => void,
    ) => {
      mockKeyboardListeners.set(name, callback);
      return { remove: () => mockKeyboardListeners.delete(name) };
    },
  },
}));

jest.mock('react-native-pager-view', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const CollapsiblePagerView = React.forwardRef(
    (
      {
        children,
        header,
        stickyHeader,
        onPageSelected,
        onPageScrollStateChanged,
      }: {
        children?: React.ReactNode;
        header?: React.ReactNode;
        stickyHeader?: React.ReactNode;
        onPageSelected?: typeof mockPageSelected;
        onPageScrollStateChanged?: typeof mockPageScrollStateChanged;
      },
      ref,
    ) => {
      mockPageSelected = onPageSelected;
      mockPageScrollStateChanged = onPageScrollStateChanged;
      React.useImperativeHandle(ref, () => ({
        scrollHeaderToOffset: mockScrollHeaderToOffset,
        scrollHeaderBy: mockScrollHeaderBy,
        setPageWithoutAnimation: jest.fn(),
      }));
      return React.createElement('div', null, header, stickyHeader, children);
    },
  );
  CollapsiblePagerView.displayName = 'MockCollapsiblePagerView';
  return {
    __esModule: true,
    CollapsiblePagerView,
  };
});

jest.mock('@onekeyhq/components', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const Container = ({ children }: { children?: React.ReactNode }) =>
    React.createElement('div', null, children);
  const Stack = React.forwardRef(
    (
      {
        children,
        onTouchStart,
        onWheel,
      }: {
        children?: React.ReactNode;
        onTouchStart?: React.TouchEventHandler;
        onWheel?: React.WheelEventHandler;
      },
      ref,
    ) => {
      React.useImperativeHandle(ref, () => ({
        measureInWindow: (callback: (...bounds: number[]) => void) =>
          callback(0, 100, 320, 600),
      }));
      return React.createElement(
        'div',
        {
          'data-testid': ref ? 'pager-viewport' : undefined,
          onTouchStart,
          onWheel,
        },
        children,
      );
    },
  );
  Stack.displayName = 'MockStack';
  return {
    ActionList: Container,
    Badge: Container,
    Button: Container,
    DashText: Container,
    Empty: Container,
    Icon: Container,
    Keyboard: { AwareScrollView: Container },
    MatchSizeableText: Container,
    KEYBOARD_AWARE_SCROLL_BOTTOM_OFFSET: 0,
    Popover: Container,
    SegmentControl: Container,
    SizableText: Container,
    Stack,
    Tooltip: Container,
    XStack: Container,
    YStack: Container,
  };
});

jest.mock('@onekeyfe/react-native-native-list', () => ({
  NativeList: () => null,
}));
jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {},
}));
jest.mock('@onekeyhq/kit/src/components/AccountAvatar', () => ({
  AccountAvatar: () => null,
}));
jest.mock('@onekeyhq/kit/src/components/WalletAvatar', () => ({
  WalletAvatar: () => null,
}));
jest.mock(
  '@onekeyhq/kit/src/components/AddressTypeSelector/AddressTypeSelectorItem',
  () => ({
    addressTypeTooltipMap: {},
  }),
);
jest.mock('@onekeyhq/kit/src/hooks/useAppNavigation', () => ({
  __esModule: true,
  default: () => ({}),
}));
jest.mock('@onekeyhq/kit/src/hooks/useDebounce', () => ({
  useDebounce: (value: unknown) => value,
}));
jest.mock('@onekeyhq/kit/src/hooks/usePromiseResult', () => ({
  usePromiseResult: () => ({ result: [], isLoading: false, run: jest.fn() }),
}));
jest.mock(
  '@onekeyhq/kit/src/views/AccountManagerStacks/pages/AccountSelectorStack/accountSelectorNativeListV2',
  () => ({
    accountSelectorAccountVisualV2: jest.fn(),
    accountSelectorWalletVisualV2: jest.fn(),
    useAccountSelectorNativeListThemeV2: () => ({}),
  }),
);
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms/addressBooks', () => ({
  useAddressBookPersistAtom: () => [{ updateTimestamp: 0 }],
}));
jest.mock('@onekeyhq/shared/src/eventBus/appEventBus', () => ({
  EAppEventBusNames: {},
  appEventBus: { on: jest.fn(), off: jest.fn() },
}));
jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  __esModule: true,
  defaultLogger: {
    transaction: {
      send: {
        quickSelectTabSwitch: jest.fn(),
        quickSelectSearchNoResult: jest.fn(),
      },
    },
  },
}));
jest.mock('@onekeyhq/shared/src/utils/accountUtils', () => ({
  __esModule: true,
  default: { shortenAddress: () => '' },
}));
jest.mock('@onekeyhq/shared/src/utils/networkUtils', () => ({
  __esModule: true,
  default: { isLightningNetworkByNetworkId: () => false },
}));
jest.mock('./RecentRecipients', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('./QuickSelectListShared', () => ({
  QuickSelectListItemFrame: () => null,
  QuickSelectListSkeleton: () => null,
}));
jest.mock('./recipientNativeList', () => ({
  recipientIdentityRow: jest.fn(),
  recipientSnapshot: jest.fn(),
}));

const keyboardFrame = {
  endCoordinates: { screenY: 500, height: 400 },
};

function showKeyboard() {
  act(() => {
    mockKeyboardListeners.get('keyboardDidShow')?.(keyboardFrame);
  });
}

function renderPager(
  hideTabs: Array<'account' | 'addressBook'> = ['account', 'addressBook'],
) {
  const rendered = render(
    <RecipientQuickSelect
      networkId="xrp--0"
      hideTabs={hideTabs}
      pagerHeader={(requestFocus) => {
        mockRequestFocus = requestFocus;
        return null;
      }}
    />,
  );
  const field = {
    measureInWindow: jest.fn((callback: (...bounds: number[]) => void) =>
      callback(0, 650, 320, 60),
    ),
  };
  act(() => {
    mockRequestFocus?.(field);
  });
  return { field, ...rendered };
}

describe('RecipientQuickSelect keyboard focus visibility', () => {
  const originalRequestAnimationFrame = globalThis.requestAnimationFrame;
  const originalVisualViewport = Object.getOwnPropertyDescriptor(
    globalThis,
    'visualViewport',
  );
  const originalInnerHeight = Object.getOwnPropertyDescriptor(
    globalThis,
    'innerHeight',
  );
  beforeEach(() => {
    platformEnv.isNative = true;
    platformEnv.isNativeIOS = true;
    platformEnv.isNativeAndroid = false;
    mockScrollHeaderToOffset.mockClear();
    mockScrollHeaderBy.mockClear();
    mockKeyboardListeners.clear();
    mockRequestFocus = undefined;
    mockPageSelected = undefined;
    mockPageScrollStateChanged = undefined;
    globalThis.requestAnimationFrame = jest.fn(
      (callback: FrameRequestCallback) => {
        callback(0);
        return 1;
      },
    );
  });

  afterEach(() => {
    globalThis.requestAnimationFrame = originalRequestAnimationFrame;
    if (originalVisualViewport) {
      Object.defineProperty(
        globalThis,
        'visualViewport',
        originalVisualViewport,
      );
    } else {
      Reflect.deleteProperty(globalThis, 'visualViewport');
    }
    if (originalInnerHeight) {
      Object.defineProperty(globalThis, 'innerHeight', originalInnerHeight);
    }
  });

  it.each([
    ['iOS', true],
    ['Android', false],
  ])('uses absolute native header target on %s', (_name, isIOS) => {
    platformEnv.isNativeIOS = isIOS;
    platformEnv.isNativeAndroid = !isIOS;
    renderPager();
    for (let index = 0; index < 3; index += 1) showKeyboard();
    expect(mockScrollHeaderToOffset).toHaveBeenCalledTimes(3);
    expect(mockScrollHeaderToOffset).toHaveBeenLastCalledWith(222);
    expect(mockScrollHeaderBy).not.toHaveBeenCalled();
  });

  it('retains the focused field across touch and wheel invalidation', () => {
    platformEnv.isNativeIOS = true;
    platformEnv.isNativeAndroid = false;
    const { field } = renderPager();
    showKeyboard();
    const firstMeasureCount = field.measureInWindow.mock.calls.length;
    fireEvent.touchStart(screen.getByTestId('pager-viewport'));
    showKeyboard();
    expect(field.measureInWindow.mock.calls.length).toBeGreaterThan(
      firstMeasureCount,
    );
    const secondMeasureCount = field.measureInWindow.mock.calls.length;
    fireEvent.wheel(screen.getByTestId('pager-viewport'));
    showKeyboard();
    expect(field.measureInWindow.mock.calls.length).toBeGreaterThan(
      secondMeasureCount,
    );
  });

  it('keeps Web scrolling incremental and stops after the field fits', () => {
    platformEnv.isNative = false;
    platformEnv.isNativeIOS = false;
    platformEnv.isNativeAndroid = false;
    const viewportHandlers = new Map<string, () => void>();
    const visualViewport = {
      offsetTop: 0,
      height: 900,
      addEventListener: (name: string, callback: () => void) =>
        viewportHandlers.set(name, callback),
      removeEventListener: (name: string) => viewportHandlers.delete(name),
    };
    Object.defineProperty(globalThis, 'visualViewport', {
      configurable: true,
      value: visualViewport,
    });
    Object.defineProperty(globalThis, 'innerHeight', {
      configurable: true,
      value: 900,
    });
    const { field } = renderPager();
    visualViewport.height = 500;
    act(() => viewportHandlers.get('resize')?.());
    expect(mockScrollHeaderBy).toHaveBeenLastCalledWith(222);
    expect(mockScrollHeaderToOffset).not.toHaveBeenCalled();
    field.measureInWindow.mockImplementation(
      (callback: (...bounds: number[]) => void) => callback(0, 428, 320, 60),
    );
    act(() => viewportHandlers.get('resize')?.());
    expect(mockScrollHeaderBy).toHaveBeenCalledTimes(1);
  });

  it.each(['touch', 'wheel', 'page', 'drag', 'unmount'])(
    'cancels queued focus work after %s',
    (interruption) => {
      const frames: FrameRequestCallback[] = [];
      globalThis.requestAnimationFrame = jest.fn(
        (callback: FrameRequestCallback) => {
          frames.push(callback);
          return frames.length;
        },
      );
      const { field, unmount } = renderPager(
        interruption === 'page' ? ['addressBook'] : undefined,
      );
      showKeyboard();
      expect(frames).toHaveLength(1);
      switch (interruption) {
        case 'touch':
          fireEvent.touchStart(screen.getByTestId('pager-viewport'));
          break;
        case 'wheel':
          fireEvent.wheel(screen.getByTestId('pager-viewport'));
          break;
        case 'page':
          act(() => mockPageSelected?.({ nativeEvent: { position: 1 } }));
          break;
        case 'drag':
          act(() =>
            mockPageScrollStateChanged?.({
              nativeEvent: { pageScrollState: 'dragging' },
            }),
          );
          break;
        default:
          unmount();
      }
      act(() => frames.shift()?.(0));
      expect(field.measureInWindow).not.toHaveBeenCalled();
      expect(mockScrollHeaderToOffset).not.toHaveBeenCalled();
      if (interruption === 'unmount') {
        expect(mockKeyboardListeners.size).toBe(0);
      }
      if (interruption !== 'unmount') {
        showKeyboard();
        if (interruption === 'touch' || interruption === 'wheel') {
          expect(frames).toHaveLength(1);
          act(() => frames.shift()?.(0));
          expect(field.measureInWindow).toHaveBeenCalledTimes(1);
          expect(mockScrollHeaderToOffset).toHaveBeenLastCalledWith(222);
        } else {
          expect(frames).toHaveLength(0);
          expect(field.measureInWindow).not.toHaveBeenCalled();
        }
      }
    },
  );
});
