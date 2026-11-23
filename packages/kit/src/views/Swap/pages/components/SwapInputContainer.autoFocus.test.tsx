/** @jest-environment jsdom */
// The pay input takes the focus when the page opens with no amount, and must
// not when an amount is on screen, including one that arrives just after
// mount (init params, the approving-success fill).

import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';

import { act, render } from '@testing-library/react';

import { ESwapDirectionType } from '@onekeyhq/shared/types/swap/types';

import SwapInputContainer from './SwapInputContainer';

const mockFocus = jest.fn();
let mockRouteFocused = true;

jest.mock('@onekeyhq/components', () => {
  const { createElement } = jest.requireActual<typeof import('react')>('react');
  const Box = ({ children }: { children?: ReactNode }) =>
    createElement('div', null, children);
  return { XStack: Box, YStack: Box, getFontSize: () => 20 };
});
jest.mock('@onekeyhq/kit/src/components/AmountInput', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    AmountInput: ({
      inputProps,
      value,
    }: {
      inputProps?: { ref?: { current: unknown } };
      value?: string;
    }) => {
      // Stand in for the real <Input ref>: expose focus() on the ref the
      // container passes through inputProps.
      React.useLayoutEffect(() => {
        if (inputProps?.ref) {
          inputProps.ref.current = { focus: mockFocus };
        }
      });
      return React.createElement('div', { 'data-testid': 'amount' }, value);
    },
  };
});
jest.mock('@onekeyhq/kit/src/hooks/useDebounce', () => ({
  useDebounce: (value: unknown) => value,
}));
jest.mock('@onekeyhq/kit/src/hooks/useRouteIsFocused', () => ({
  useRouteIsFocused: () => mockRouteFocused,
}));
jest.mock('@onekeyhq/kit/src/states/jotai/contexts/swap', () => ({
  useRateDifferenceAtom: () => [undefined],
  useSwapActions: () => ({ current: { loadSwapSelectTokenDetail: jest.fn() } }),
  useSwapAlertsAtom: () => [{ states: [] }],
  useSwapBalanceDisplayCacheAtom: () => [{}],
  useSwapFromTokenAmountAtom: () => [{ value: '', isInput: false }],
  useSwapInitialSelectedTokensSyncedAtom: () => [true],
  useSwapNetworksIncludeAllNetworkAtom: () => [[]],
  useSwapQuoteActionLockAtom: () => [{}],
  useSwapSelectFromTokenAtom: () => [undefined],
  useSwapSelectToTokenAtom: () => [undefined],
  useSwapSelectedFromTokenBalanceAtom: () => [''],
  useSwapSelectedTokenBalanceMetaAtom: () => [{}],
  useSwapSelectedTokensColdStartContextAtom: () => [undefined],
  useSwapTypeSwitchAtom: () => ['swap'],
}));
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  useCurrencyPersistAtom: () => [{ currencyMap: {} }],
  useInAppNotificationAtom: () => [{}, jest.fn()],
  useSettingsPersistAtom: () => [{ currencyInfo: { id: 'usd', symbol: '$' } }],
}));
jest.mock('@onekeyhq/shared/src/utils/accountUtils', () => ({
  __esModule: true,
  default: {
    isHdWallet: () => false,
    isHwWallet: () => false,
    isQrWallet: () => false,
  },
}));
jest.mock('@onekeyhq/shared/src/utils/networkUtils', () => ({
  __esModule: true,
  default: { getLocalNetworkInfo: () => undefined },
}));
jest.mock('@onekeyhq/shared/src/utils/swapColdStartCacheSnapshotUtils', () => ({
  buildSwapSelectedTokensColdStartAccountKey: () => 'k',
}));
jest.mock('@onekeyhq/shared/src/utils/tokenUtils', () => ({
  checkWrappedTokenPair: () => false,
}));
jest.mock('../../components/SwapRateDifferenceText', () => ({
  SwapRateDifferenceText: () => null,
}));
jest.mock('../../components/PercentageStageOnKeyboard', () => ({
  PercentageStageOnKeyboard: () => null,
}));
jest.mock('../../hooks/swapStockChannelUtils', () => ({
  getTokenIdentityKey: () => '',
}));
jest.mock('../../hooks/useSwapAccount', () => ({
  useSwapAddressInfo: () => ({
    address: '0xabc',
    accountInfo: undefined,
    activeAccount: undefined,
    isAddressInfoReady: true,
  }),
}));
jest.mock('../../hooks/useSwapColdStartDisplayTokens', () => ({
  getSwapBalanceDisplayEntryFromGlobalSnapshot: () => undefined,
  useSwapColdStartDisplayTokens: () => ({
    fromTokenState: { status: 'empty' },
    toTokenState: { status: 'empty' },
  }),
}));
jest.mock('../../hooks/useSwapTokens', () => ({
  useSwapSelectedTokenInfo: () => undefined,
}));
jest.mock('../../utils/swapBalanceActionUtils', () => ({
  getSwapBalanceActionProps: () => ({}),
}));
jest.mock('../../utils/swapBalanceDisplayCacheUtils', () => ({
  resolveSwapBalanceDisplayAccountKey: () => 'k',
  resolveSwapBalanceDisplayCacheEntry: () => undefined,
  resolveSwapInputDisplayBalance: () => '',
}));
jest.mock('../../utils/swapBalanceOwnerUtils', () => ({
  buildSwapBalanceAccountIdentity: () => undefined,
  resolveVerifiedSwapBalance: () => undefined,
}));
jest.mock('../../utils/swapDepositActionUtils', () => ({
  isSwapBalanceLoadedZero: () => false,
}));
jest.mock('../../utils/swapDisplayFiatValue', () => ({
  getSwapTokenDisplayFiatValue: () => '',
}));
jest.mock('./SwapAccountAddressContainer', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('./SwapInputActions', () => ({
  __esModule: true,
  default: () => null,
  SWAP_PERCENTAGE_STAGE_IN_CARD_ON_NATIVE: false,
}));

// Mirrors the real page: the amount lives above the card and is filled by an
// effect of the parent (useSwapInit applies swapInitParams.fromAmount in a
// useEffect; the approving-success toast emits its fill 200ms after pushing
// the modal). `fillAfterMs === 0` fills it in the parent's mount effect.
function Page({ fillAfterMs }: { fillAfterMs: number | undefined }) {
  const [amount, setAmount] = useState('');
  useEffect(() => {
    if (fillAfterMs === undefined) return;
    if (fillAfterMs === 0) {
      setAmount('1.5');
      return;
    }
    const timer = setTimeout(() => setAmount('1.5'), fillAfterMs);
    return () => clearTimeout(timer);
  }, [fillAfterMs]);
  return (
    <SwapInputContainer
      autoFocusOnPageFocus
      direction={ESwapDirectionType.FROM}
      amountValue={amount}
      balance=""
      onSelectToken={jest.fn()}
    />
  );
}

beforeEach(() => {
  jest.useFakeTimers();
  mockFocus.mockClear();
  mockRouteFocused = true;
});
afterEach(() => {
  jest.useRealTimers();
});

it('control: with no amount the pay input is focused 350ms after the page gains focus', () => {
  render(<Page fillAfterMs={undefined} />);
  act(() => {
    jest.advanceTimersByTime(400);
  });
  expect(mockFocus).toHaveBeenCalledTimes(1);
});

it('control: an amount present at first render suppresses the auto focus', () => {
  render(
    <SwapInputContainer
      autoFocusOnPageFocus
      direction={ESwapDirectionType.FROM}
      amountValue="1.5"
      balance=""
      onSelectToken={jest.fn()}
    />,
  );
  act(() => {
    jest.advanceTimersByTime(400);
  });
  expect(mockFocus).not.toHaveBeenCalled();
});

it('amount applied by the parent mount effect (swapInitParams.fromAmount) must not raise the keyboard', () => {
  const view = render(<Page fillAfterMs={0} />);
  expect(view.getByTestId('amount').textContent).toBe('1.5');
  act(() => {
    jest.advanceTimersByTime(400);
  });
  expect(mockFocus).not.toHaveBeenCalled();
});

it('amount filled 200ms after the modal opens (approving-success flow) must not raise the keyboard', () => {
  const view = render(<Page fillAfterMs={200} />);
  act(() => {
    jest.advanceTimersByTime(250);
  });
  expect(view.getByTestId('amount').textContent).toBe('1.5');
  act(() => {
    jest.advanceTimersByTime(200);
  });
  expect(mockFocus).not.toHaveBeenCalled();
});
