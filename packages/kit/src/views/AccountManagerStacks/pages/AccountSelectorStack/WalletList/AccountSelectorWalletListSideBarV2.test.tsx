/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';

import type { IAccountSelectorSelectedAccount } from '@onekeyhq/kit-bg/src/dbs/simple/entity/SimpleDbEntityAccountSelector';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { AccountSelectorWalletListSideBarV2 } from './AccountSelectorWalletListSideBarV2';

import type { IAccountSelectorWalletInfo } from '../../../type';
import type {
  NativeListProps,
  NativeListRef,
} from '@onekeyfe/react-native-native-list';
import type { GestureResponderEvent, LayoutChangeEvent } from 'react-native';

const mockScrollToKey = jest.fn();
const mockReloadWallets = jest.fn();
const mockActions = {
  current: { updateSelectedAccountFocusedWallet: jest.fn() },
};
const mockTheme = { separator: '#cccccc', iconSubdued: '#999999' };
const mockAppTheme = {
  bgApp: { val: '#ffffff' },
  bgSuccessStrong: { val: '#00ff00' },
};
const mockIntl = { formatMessage: ({ id }: { id: string }) => id };
let mockSelectedAccount: IAccountSelectorSelectedAccount;
let mockListProps: NativeListProps;
let mockBlur: (() => void) | undefined;

const mockWallets: IAccountSelectorWalletInfo[] = ['hd-1', 'hd-2'].map(
  (id) => ({
    id,
    name: id,
    type: 'hd',
    backuped: true,
    accounts: [],
    nextIds: {},
    walletNo: 1,
  }),
);
const mockWalletResult = { wallets: mockWallets };

jest.mock('react-intl', () => ({ useIntl: () => mockIntl }));
jest.mock('react-native', () => ({ StyleSheet: { hairlineWidth: 1 } }));

jest.mock('@react-navigation/native', () => {
  const { useEffect } = jest.requireActual<typeof import('react')>('react');
  return {
    useFocusEffect: (effect: () => () => void) =>
      useEffect(() => {
        const onBlur = effect();
        mockBlur = onBlur;
        return onBlur;
      }, [effect]),
  };
});

jest.mock('@onekeyfe/react-native-native-list', () => {
  const { forwardRef, useImperativeHandle } =
    jest.requireActual<typeof import('react')>('react');
  return {
    NativeList: forwardRef<Pick<NativeListRef, 'scrollToKey'>, NativeListProps>(
      function MockNativeList(props, ref) {
        mockListProps = props;
        useImperativeHandle(ref, () => ({ scrollToKey: mockScrollToKey }), []);
        return <div data-testid="wallet-list" />;
      },
    ),
  };
});

jest.mock('@onekeyhq/components', () => {
  const { forwardRef } = jest.requireActual<typeof import('react')>('react');
  const Stack = forwardRef<HTMLDivElement, { children?: ReactNode }>(
    function MockStack({ children }, ref) {
      return <div ref={ref}>{children}</div>;
    },
  );
  return {
    Page: { Close: Stack },
    Stack,
    XStack: Stack,
    Tooltip: () => null,
    HeaderIconButton: () => null,
    useMedia: () => ({ md: false }),
    useSafeAreaInsets: () => ({ top: 0, bottom: 0 }),
    useTheme: () => mockAppTheme,
  };
});

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: { serviceAccount: {} },
}));
jest.mock('@onekeyhq/kit/src/hooks/useHardwareWalletConnectStatus', () => ({
  useHardwareWalletConnectStatus: () => ({ isWalletConnected: () => false }),
}));
jest.mock('@onekeyhq/kit/src/hooks/usePromiseResult', () => ({
  usePromiseResult: () => ({
    result: mockWalletResult,
    run: mockReloadWallets,
    setResult: jest.fn(),
  }),
}));
jest.mock('@onekeyhq/kit/src/states/jotai/contexts/accountSelector', () => ({
  useSelectedAccount: () => ({ selectedAccount: mockSelectedAccount }),
}));
jest.mock(
  '@onekeyhq/kit/src/states/jotai/contexts/accountSelector/actions',
  () => ({ useAccountSelectorActions: () => mockActions }),
);
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  useAccountSelectorStatusAtom: () => [{}],
  useSettingsPersistAtom: () => [
    { showAddHiddenInWalletSidebar: false },
    jest.fn(),
  ],
}));
jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    accountSelector: { perf: { renderWalletListSideBar: jest.fn() } },
  },
}));
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isNative: false },
}));
jest.mock('../../../router/useAccountSelectorRoute', () => ({
  useAccountSelectorRoute: () => ({ params: {} }),
}));
jest.mock('../accountSelectorNativeListV2', () => ({
  useAccountSelectorNativeListThemeV2: () => mockTheme,
  accountSelectorWalletVisualV2: () => ({ kind: 'wallet' }),
}));
jest.mock('../WalletDetails/hooks/useAddHiddenWallet', () => ({
  useAddHiddenWallet: () => ({ isLoading: false }),
}));
jest.mock('./AccountSelectorCreateWalletButton', () => ({
  AccountSelectorCreateWalletButton: () => null,
}));

describe('AccountSelectorWalletListSideBarV2 positioning', () => {
  const animationFrames: Pick<
    Window,
    'requestAnimationFrame' | 'cancelAnimationFrame'
  > = globalThis;
  let frames: Map<number, FrameRequestCallback>;
  let frameId: number;

  const layout = (height: number, width = 128) => {
    act(() => {
      mockListProps.onLayout?.({
        nativeEvent: { layout: { x: 0, y: 0, width, height } },
      } as LayoutChangeEvent);
    });
  };
  const flushFrames = () => {
    const pending = [...frames.values()];
    frames.clear();
    act(() => pending.forEach((callback) => callback(0)));
  };

  beforeEach(() => {
    jest.clearAllMocks();
    Object.assign(platformEnv, { isNative: false });
    mockBlur = undefined;
    mockSelectedAccount = {
      focusedWallet: 'hd-2',
      walletId: 'hd-2',
      indexedAccountId: undefined,
      othersWalletAccountId: undefined,
      networkId: 'evm--1',
      deriveType: 'default',
    };
    frames = new Map();
    frameId = 0;
    jest
      .spyOn(animationFrames, 'requestAnimationFrame')
      .mockImplementation((fn: FrameRequestCallback) => {
        frameId += 1;
        frames.set(frameId, fn);
        return frameId;
      });
    jest
      .spyOn(animationFrames, 'cancelAnimationFrame')
      .mockImplementation((id: number) => {
        frames.delete(id);
      });
  });

  afterEach(() => {
    cleanup();
    jest.restoreAllMocks();
  });

  it('replays positioning after the measured viewport shrinks and deduplicates unchanged layouts', () => {
    render(<AccountSelectorWalletListSideBarV2 num={0} />);
    layout(753);
    flushFrames();
    expect(mockScrollToKey).toHaveBeenCalledTimes(1);

    layout(545);
    flushFrames();
    expect(mockScrollToKey).toHaveBeenCalledTimes(2);
    expect(mockScrollToKey).toHaveBeenLastCalledWith({
      key: 'hd-2',
      animated: false,
      viewPosition: 0.5,
      viewOffset: 0,
    });

    layout(545);
    flushFrames();
    expect(mockScrollToKey).toHaveBeenCalledTimes(2);
  });

  it('waits for a nonzero layout and replaces a queued request when layout changes again', () => {
    render(<AccountSelectorWalletListSideBarV2 num={0} />);
    flushFrames();
    layout(0);
    flushFrames();
    expect(mockScrollToKey).not.toHaveBeenCalled();

    layout(753);
    layout(545);
    expect(frames.size).toBe(1);
    flushFrames();
    expect(mockScrollToKey).toHaveBeenCalledTimes(1);
  });

  it.each(['wheel', 'pointerdown', 'mousedown', 'touchstart', 'keydown'])(
    'cancels queued and subsequent positioning after Web %s input',
    (type) => {
      render(<AccountSelectorWalletListSideBarV2 num={0} />);
      layout(753);
      fireEvent(screen.getByTestId('wallet-list'), new Event(type));
      flushFrames();
      layout(545);
      flushFrames();
      expect(mockScrollToKey).not.toHaveBeenCalled();
    },
  );

  it('cancels a queued request on native touch', () => {
    Object.assign(platformEnv, { isNative: true });
    render(<AccountSelectorWalletListSideBarV2 num={0} />);
    layout(753);
    act(() => mockListProps.onTouchStart?.({} as GestureResponderEvent));
    flushFrames();
    expect(mockScrollToKey).not.toHaveBeenCalled();
  });

  it('respects user scrolling after the initial positioning succeeds', () => {
    render(<AccountSelectorWalletListSideBarV2 num={0} />);
    layout(753);
    flushFrames();
    expect(mockScrollToKey).toHaveBeenCalledTimes(1);

    fireEvent.wheel(screen.getByTestId('wallet-list'));
    layout(545);
    flushFrames();
    expect(mockScrollToKey).toHaveBeenCalledTimes(1);
  });

  it('cancels queued and subsequent positioning after blur', () => {
    render(<AccountSelectorWalletListSideBarV2 num={0} />);
    layout(753);
    act(() => mockBlur?.());
    flushFrames();
    layout(545);
    flushFrames();
    expect(mockScrollToKey).not.toHaveBeenCalled();
  });

  it('cancels a queued request on unmount and starts positioning on a new mount', () => {
    const { unmount } = render(<AccountSelectorWalletListSideBarV2 num={0} />);
    layout(753);
    unmount();
    flushFrames();
    expect(mockScrollToKey).not.toHaveBeenCalled();

    render(<AccountSelectorWalletListSideBarV2 num={0} />);
    layout(545);
    flushFrames();
    expect(mockScrollToKey).toHaveBeenCalledTimes(1);
  });

  it('cancels a stale queued request when the selected account changes', () => {
    const { rerender } = render(<AccountSelectorWalletListSideBarV2 num={0} />);
    layout(753);
    mockSelectedAccount = { ...mockSelectedAccount, networkId: 'evm--10' };
    rerender(<AccountSelectorWalletListSideBarV2 num={0} />);
    flushFrames();
    expect(mockScrollToKey).not.toHaveBeenCalled();
  });
});
