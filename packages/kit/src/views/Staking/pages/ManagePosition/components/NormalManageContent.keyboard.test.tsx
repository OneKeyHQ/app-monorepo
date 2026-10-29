/** @jest-environment jsdom */

import { useRef } from 'react';
import type { ReactNode } from 'react';

import { act, fireEvent, render, screen } from '@testing-library/react';

import type { IAppNavigation } from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EStakingActionType } from '@onekeyhq/shared/types/staking';
import type { IProtocolInfo } from '@onekeyhq/shared/types/staking';

import { NormalManageContent } from './NormalManageContent';

let mockKeyboardVisible = true;
let mockControllerVisible = true;
let mockFocusedInput: object | null = {};
let mockNavigationFocused = true;
const mockKeyboardListeners = new Set<() => void>();
const mockNavigationBlurListeners = new Set<() => void>();
const mockToastError = jest.fn();
const mockDismiss = jest.fn(() => {
  mockFocusedInput = null;
});

const mockNavigation = {
  isFocused: () => mockNavigationFocused,
  addListener: (_event: string, listener: () => void) => {
    mockNavigationBlurListeners.add(listener);
    return () => mockNavigationBlurListeners.delete(listener);
  },
};

jest.mock('@react-navigation/core', () => ({
  useNavigation: () => mockNavigation,
}));

jest.mock('react-native', () => ({
  Keyboard: {
    isVisible: () => mockKeyboardVisible,
    dismiss: () => {
      mockDismiss();
    },
    addListener: (_event: string, listener: () => void) => {
      mockKeyboardListeners.add(listener);
      return {
        remove: () => {
          mockKeyboardListeners.delete(listener);
        },
      };
    },
  },
  TextInput: { State: { currentlyFocusedInput: () => mockFocusedInput } },
}));

jest.mock('react-native-reanimated', () => ({
  useSharedValue: (value: string) => useRef({ value }).current,
}));

jest.mock('@onekeyhq/components', () => {
  const Container = ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  );
  return {
    Dialog: { show: jest.fn() },
    Toast: {
      error: (props: { title: string }) => {
        mockToastError(props);
      },
    },
    Keyboard: { Controller: { isVisible: () => mockControllerVisible } },
    SizableText: Container,
    XStack: Container,
    Tabs: {
      TabBar: ({
        tabNames,
        onTabPress,
      }: {
        tabNames: string[];
        onTabPress: (name: string) => void;
      }) => (
        <div>
          {tabNames.map((name, index) => (
            <button
              key={name}
              type="button"
              data-testid={`tab-${index}`}
              onClick={() => onTabPress(name)}
            >
              {name}
            </button>
          ))}
        </div>
      ),
    },
  };
});

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isNativeIOSPhone: true },
}));
jest.mock('@onekeyhq/kit/src/components/SlippageSettingDialog', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../../../hooks/useIsPendleProvider', () => ({
  useIsPendleProvider: () => false,
}));
jest.mock('../../../hooks/useQuoteCountdown', () => ({
  useQuoteCountdown: () => ({ isExpired: false, reset: () => {} }),
}));
jest.mock('../hooks/useManagePage', () => ({
  EManagePositionType: {
    Staking: 'staking',
    Supply: 'supply',
    Borrow: 'borrow',
    Withdraw: 'withdraw',
    Repay: 'repay',
  },
}));
jest.mock('./HeaderRight', () => ({ HeaderRight: () => null }));
jest.mock('./StakeSection', () => ({
  StakeSection: () => <div data-testid="stake-section" />,
}));
jest.mock('./WithdrawSection', () => ({
  WithdrawSection: () => <div data-testid="withdraw-section" />,
}));

const navigation = {} as IAppNavigation;
const defaultProps = {
  networkId: 'network',
  symbol: 'USDC',
  provider: 'provider',
  depositDisabled: false,
  withdrawDisabled: false,
  stakeBeforeFooter: null,
  withdrawBeforeFooter: null,
  isInModalContext: true,
  appNavigation: navigation,
};

function emitKeyboardDidHide() {
  mockKeyboardVisible = false;
  mockControllerVisible = false;
  act(() => {
    for (const listener of Array.from(mockKeyboardListeners)) listener();
  });
}

describe('NormalManageContent keyboard handoff', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockKeyboardVisible = true;
    mockControllerVisible = true;
    mockFocusedInput = {};
    mockNavigationFocused = true;
    mockKeyboardListeners.clear();
    mockNavigationBlurListeners.clear();
    mockDismiss.mockClear();
    mockToastError.mockClear();
  });
  afterEach(() => jest.useRealTimers());

  it('waits for the keyboard to hide before switching tabs', () => {
    const onTabChange = jest.fn();
    render(<NormalManageContent {...defaultProps} onTabChange={onTabChange} />);
    fireEvent.click(screen.getByTestId('tab-1'));
    expect(mockDismiss).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('stake-section')).toBeTruthy();
    expect(screen.queryByTestId('withdraw-section')).toBeNull();
    expect(onTabChange).not.toHaveBeenCalled();
    emitKeyboardDidHide();
    expect(screen.getByTestId('withdraw-section')).toBeTruthy();
    expect(onTabChange).toHaveBeenCalledTimes(1);
    expect(onTabChange).toHaveBeenCalledWith('withdraw');
    expect(mockToastError).not.toHaveBeenCalled();
  });

  it('keeps the latest choice pending when the user cancels and reselects during hide', () => {
    render(<NormalManageContent {...defaultProps} />);
    fireEvent.click(screen.getByTestId('tab-1'));
    fireEvent.click(screen.getByTestId('tab-0'));
    fireEvent.click(screen.getByTestId('tab-1'));
    expect(screen.getByTestId('stake-section')).toBeTruthy();
    expect(screen.queryByTestId('withdraw-section')).toBeNull();
    emitKeyboardDidHide();
    expect(screen.getByTestId('withdraw-section')).toBeTruthy();
  });

  it('removes pending handoffs on unmount', () => {
    const onTabChange = jest.fn();
    const view = render(
      <NormalManageContent {...defaultProps} onTabChange={onTabChange} />,
    );
    fireEvent.click(screen.getByTestId('tab-1'));
    view.unmount();
    expect(mockKeyboardListeners.size).toBe(0);
    emitKeyboardDidHide();
    act(() => {
      jest.advanceTimersByTime(1500);
    });
    expect(onTabChange).not.toHaveBeenCalled();
  });

  it('cancels a pending handoff when navigation blurs the retained page', () => {
    const onTabChange = jest.fn();
    render(<NormalManageContent {...defaultProps} onTabChange={onTabChange} />);
    fireEvent.click(screen.getByTestId('tab-1'));
    mockNavigationFocused = false;
    act(() => {
      for (const listener of Array.from(mockNavigationBlurListeners))
        listener();
    });
    expect(mockKeyboardListeners.size).toBe(0);
    emitKeyboardDidHide();
    act(() => jest.advanceTimersByTime(1500));
    expect(screen.getByTestId('stake-section')).toBeTruthy();
    expect(onTabChange).not.toHaveBeenCalled();
    expect(mockToastError).not.toHaveBeenCalled();
  });

  it('does not switch if the route lost focus before the hide callback', () => {
    const onTabChange = jest.fn();
    render(<NormalManageContent {...defaultProps} onTabChange={onTabChange} />);
    fireEvent.click(screen.getByTestId('tab-1'));
    mockNavigationFocused = false;
    emitKeyboardDidHide();
    expect(screen.getByTestId('stake-section')).toBeTruthy();
    expect(onTabChange).not.toHaveBeenCalled();
  });

  it('does not switch to a target that became disabled while the keyboard was hiding', () => {
    const onTabChange = jest.fn();
    const view = render(
      <NormalManageContent
        {...defaultProps}
        defaultTab="withdraw"
        onTabChange={onTabChange}
      />,
    );
    fireEvent.click(screen.getByTestId('tab-0'));
    view.rerender(
      <NormalManageContent
        {...defaultProps}
        defaultTab="withdraw"
        depositDisabled
        onTabChange={onTabChange}
      />,
    );
    emitKeyboardDidHide();
    expect(screen.getByTestId('withdraw-section')).toBeTruthy();
    expect(screen.queryByTestId('stake-section')).toBeNull();
    expect(onTabChange).not.toHaveBeenCalled();
  });

  it('does not take focus from a user who focused another input during the handoff', () => {
    const onTabChange = jest.fn();
    render(<NormalManageContent {...defaultProps} onTabChange={onTabChange} />);
    fireEvent.click(screen.getByTestId('tab-1'));
    mockFocusedInput = {};
    emitKeyboardDidHide();
    expect(screen.getByTestId('stake-section')).toBeTruthy();
    expect(onTabChange).not.toHaveBeenCalled();
  });

  it('falls back after a missing hide event only when the keyboard is no longer visible', () => {
    const onTabChange = jest.fn();
    render(<NormalManageContent {...defaultProps} onTabChange={onTabChange} />);
    fireEvent.click(screen.getByTestId('tab-1'));
    mockKeyboardVisible = false;
    mockControllerVisible = false;
    act(() => {
      jest.advanceTimersByTime(1500);
    });
    expect(screen.getByTestId('withdraw-section')).toBeTruthy();
    expect(onTabChange).toHaveBeenCalledTimes(1);
    expect(mockToastError).not.toHaveBeenCalled();
  });

  it('does not apply a timed-out handoff while the keyboard remains visible', () => {
    const onTabChange = jest.fn();
    render(<NormalManageContent {...defaultProps} onTabChange={onTabChange} />);
    fireEvent.click(screen.getByTestId('tab-1'));
    act(() => {
      jest.advanceTimersByTime(1500);
    });
    expect(screen.getByTestId('stake-section')).toBeTruthy();
    expect(onTabChange).not.toHaveBeenCalled();
    expect(mockKeyboardListeners.size).toBe(0);
    expect(mockToastError).toHaveBeenCalledWith({
      title: ETranslations.global_try_again,
    });
  });

  it('does not switch on timeout while the controller still reports a visible keyboard', () => {
    const onTabChange = jest.fn();
    render(<NormalManageContent {...defaultProps} onTabChange={onTabChange} />);
    mockKeyboardVisible = false;
    mockControllerVisible = true;
    fireEvent.click(screen.getByTestId('tab-1'));
    act(() => {
      jest.advanceTimersByTime(1500);
    });
    expect(screen.getByTestId('stake-section')).toBeTruthy();
    expect(onTabChange).not.toHaveBeenCalled();
    expect(mockToastError).toHaveBeenCalledWith({
      title: ETranslations.global_try_again,
    });
  });

  it('does not report an error for a tab change the user has cancelled', () => {
    render(<NormalManageContent {...defaultProps} />);
    fireEvent.click(screen.getByTestId('tab-1'));
    fireEvent.click(screen.getByTestId('tab-0'));
    act(() => {
      jest.advanceTimersByTime(1500);
    });
    expect(screen.getByTestId('stake-section')).toBeTruthy();
    expect(mockToastError).not.toHaveBeenCalled();
  });

  it('does not report a timeout after the protocol context changes', () => {
    const view = render(<NormalManageContent {...defaultProps} />);
    fireEvent.click(screen.getByTestId('tab-1'));
    view.rerender(
      <NormalManageContent {...defaultProps} provider="other-provider" />,
    );
    act(() => {
      jest.advanceTimersByTime(1500);
    });
    expect(mockToastError).not.toHaveBeenCalled();
  });

  it('does not report a timeout when the target becomes disabled', () => {
    const view = render(
      <NormalManageContent {...defaultProps} defaultTab="withdraw" />,
    );
    fireEvent.click(screen.getByTestId('tab-0'));
    view.rerender(
      <NormalManageContent
        {...defaultProps}
        defaultTab="withdraw"
        depositDisabled
      />,
    );
    act(() => {
      jest.advanceTimersByTime(1500);
    });
    expect(mockToastError).not.toHaveBeenCalled();
  });

  it('does not report a timeout when the target changes to an order flow', () => {
    const view = render(<NormalManageContent {...defaultProps} />);
    fireEvent.click(screen.getByTestId('tab-1'));
    const protocolInfo = {
      withdrawAction: { type: EStakingActionType.WithdrawOrder },
    } as unknown as IProtocolInfo;
    view.rerender(
      <NormalManageContent {...defaultProps} protocolInfo={protocolInfo} />,
    );
    act(() => {
      jest.advanceTimersByTime(1500);
    });
    expect(mockToastError).not.toHaveBeenCalled();
  });

  it('does not report a timeout after the user focuses another input', () => {
    render(<NormalManageContent {...defaultProps} />);
    fireEvent.click(screen.getByTestId('tab-1'));
    mockFocusedInput = {};
    act(() => {
      jest.advanceTimersByTime(1500);
    });
    expect(mockToastError).not.toHaveBeenCalled();
  });

  it('switches immediately without dismissing when both keyboard sources are hidden', () => {
    const onTabChange = jest.fn();
    mockKeyboardVisible = false;
    mockControllerVisible = false;
    mockFocusedInput = null;
    render(<NormalManageContent {...defaultProps} onTabChange={onTabChange} />);
    fireEvent.click(screen.getByTestId('tab-1'));
    expect(screen.getByTestId('withdraw-section')).toBeTruthy();
    expect(mockDismiss).not.toHaveBeenCalled();
    expect(onTabChange).toHaveBeenCalledWith('withdraw');
  });

  it('discards a pending handoff after the protocol context changes', () => {
    const onTabChange = jest.fn();
    const view = render(
      <NormalManageContent {...defaultProps} onTabChange={onTabChange} />,
    );
    fireEvent.click(screen.getByTestId('tab-1'));
    view.rerender(
      <NormalManageContent
        {...defaultProps}
        provider="other-provider"
        onTabChange={onTabChange}
      />,
    );
    emitKeyboardDidHide();
    expect(screen.getByTestId('stake-section')).toBeTruthy();
    expect(onTabChange).not.toHaveBeenCalled();
  });
});
