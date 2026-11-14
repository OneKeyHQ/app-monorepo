/** @jest-environment jsdom */

import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';

import { BorrowRepayPosition } from './BorrowRepayPosition';

const mockQuote = jest.fn<Promise<unknown>, [Record<string, unknown>]>();
const mockConfirmation = jest.fn<Promise<unknown>, [Record<string, unknown>]>();
const mockCheckAmount = jest.fn<Promise<unknown>, [Record<string, unknown>]>();

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
jest.mock('use-debounce', () => ({
  useDebouncedCallback: (callback: (...args: unknown[]) => unknown) => {
    const React = jest.requireActual<typeof import('react')>('react');
    const ref = React.useRef(callback);
    ref.current = callback;
    return React.useMemo(() => {
      const fn = (...args: unknown[]) => ref.current(...args);
      fn.cancel = () => undefined;
      return fn;
    }, []);
  },
}));
jest.mock('@onekeyhq/components', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const Box = ({ children }: { children?: import('react').ReactNode }) =>
    React.createElement('div', null, children);
  const Page = Object.assign(Box, {
    Footer: Box,
    FooterActions: () => null,
  });
  return {
    Alert: ({ title }: { title?: string }) =>
      React.createElement('div', null, title),
    Dialog: {},
    Divider: Box,
    Icon: Box,
    IconButton: Box,
    Image: Box,
    NumberSizeableText: Box,
    Page,
    Popover: Box,
    SegmentControl: ({ onChange }: { onChange: (value: string) => void }) =>
      React.createElement(
        'button',
        { onClick: () => onChange('collateral') },
        'collateral',
      ),
    SizableText: Box,
    Skeleton: Box,
    Stack: Box,
    XStack: Box,
    YStack: Box,
  };
});
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceStaking: {
      getBorrowRepayWithCollateralQuote: (args: Record<string, unknown>) =>
        mockQuote(args),
      getBorrowTransactionConfirmation: (args: Record<string, unknown>) =>
        mockConfirmation(args),
      getBorrowCheckAmount: (args: Record<string, unknown>) =>
        mockCheckAmount(args),
    },
  },
}));
jest.mock('@onekeyhq/kit/src/hooks/useAppNavigation', () => ({
  __esModule: true,
  default: () => ({}),
}));
jest.mock('@onekeyhq/kit/src/states/jotai/contexts/discovery', () => ({
  useBrowserAction: () => ({ current: {} }),
}));
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  useSettingsPersistAtom: () => [{ currencyInfo: { symbol: '$' } }],
}));
jest.mock('@onekeyhq/kit/src/components/PercentageStageOnKeyboard', () => ({
  PercentageStageOnKeyboard: () => null,
}));
jest.mock(
  '@onekeyhq/kit/src/components/PercentageStageOnKeyboard/useAmountInputFocus',
  () => ({ useAmountInputFocus: () => ({}) }),
);
jest.mock('@onekeyhq/kit/src/components/SlippageSettingDialog', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock(
  '@onekeyhq/kit/src/views/Staking/components/StakingFormWrapper',
  () => ({
    __esModule: true,
    default: ({ children }: { children?: import('react').ReactNode }) => (
      <div>{children}</div>
    ),
  }),
);
jest.mock(
  '@onekeyhq/kit/src/views/Staking/components/StakingAmountInput',
  () => ({
    StakingAmountInput: ({
      value,
      onChange,
    }: {
      value: string;
      onChange: (value: string) => void;
    }) => (
      <input
        aria-label="amount"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    ),
  }),
);
jest.mock(
  '@onekeyhq/kit/src/views/Staking/components/ProtocolDetails/EarnText',
  () => ({
    EarnText: ({ text }: { text?: { text?: string } }) => (
      <span>{text?.text}</span>
    ),
  }),
);
jest.mock(
  '@onekeyhq/kit/src/views/Staking/components/ProtocolDetails/EarnTooltip',
  () => ({ EarnTooltip: () => null }),
);
jest.mock('@onekeyhq/kit/src/views/Staking/components/StakeProgress', () => ({
  StakeProgress: () => null,
}));
jest.mock('./BorrowInfoItem', () => ({
  BorrowInfoItem: ({
    title,
    children,
  }: {
    title?: import('react').ReactNode;
    children?: import('react').ReactNode;
  }) => (
    <div>
      {title}
      {children}
    </div>
  ),
}));
jest.mock('./ManagePosition', () => ({ ManagePosition: () => null }));
jest.mock('./ManagePosition/hooks/useAmountInput', () => ({
  useAmountInput: ({
    setAmountValue,
  }: {
    setAmountValue: (v: string) => void;
  }) => ({ onChangeAmountValue: setAmountValue }),
}));
jest.mock('./ManagePosition/hooks/useTokenSelector', () => ({
  useTokenSelector: () => ({}),
}));
jest.mock(
  './ManagePosition/modules/InfoDisplaySection/HealthFactorInfo',
  () => ({ HealthFactorInfo: () => null }),
);
jest.mock('./ManagePosition/modules/InfoDisplaySection/PositionInfo', () => ({
  PositionInfo: () => null,
}));

function deferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

const collateral = [
  {
    reserveAddress: 'reserve',
    token: {
      address: 'token',
      name: 'Bitcoin',
      symbol: 'BTC',
      decimals: 8,
      logoURI: '',
    },
    supplied: { title: { text: '10' }, description: { text: '' } },
  },
];

it('keeps the new quote when a same-account A→B→A request finishes late', async () => {
  const oldQuote = deferred<{ swapIn: string; fillPrice: string }>();
  const newQuote = deferred<{ swapIn: string; fillPrice: string }>();
  const oldConfirmation = deferred<{
    fee: { title: { text: string }; description: { text: string } };
  }>();
  const newConfirmation = deferred<{
    fee: { title: { text: string }; description: { text: string } };
  }>();
  const oldCheck = deferred<{ code: number; message: string }>();
  const newCheck = deferred<{ code: number; data: { result: boolean } }>();
  mockQuote
    .mockReset()
    .mockReturnValueOnce(oldQuote.promise)
    .mockResolvedValueOnce({ swapIn: '2', fillPrice: '2' })
    .mockReturnValueOnce(newQuote.promise);
  mockConfirmation
    .mockReset()
    .mockReturnValueOnce(oldConfirmation.promise)
    .mockResolvedValueOnce({})
    .mockReturnValueOnce(newConfirmation.promise);
  mockCheckAmount
    .mockReset()
    .mockReturnValueOnce(oldCheck.promise)
    .mockResolvedValueOnce({ code: 0, data: { result: true } })
    .mockReturnValueOnce(newCheck.promise);
  const props = {
    accountId: 'same-account',
    networkId: 'sol--101',
    providerName: 'kamino',
    accountAddress: 'address-A',
    borrowMarketAddress: 'market',
    borrowReserveAddress: 'debt',
    balance: '10',
    debtBalance: '10',
    decimals: 6,
    price: '1',
    tokenSymbol: 'USDC',
    collateralAssets: collateral,
    onRepayWithCollateralConfirm: jest.fn(),
  };
  const { rerender } = render(<BorrowRepayPosition {...props} />);
  fireEvent.click(screen.getByText('collateral'));
  fireEvent.change(screen.getByLabelText('amount'), { target: { value: '1' } });
  await waitFor(() => expect(mockQuote).toHaveBeenCalledTimes(1));
  rerender(<BorrowRepayPosition {...props} accountAddress="address-B" />);
  await waitFor(() => expect(mockQuote).toHaveBeenCalledTimes(2));
  rerender(<BorrowRepayPosition {...props} />);
  await waitFor(() => expect(mockQuote).toHaveBeenCalledTimes(3));
  for (const request of [mockQuote, mockConfirmation, mockCheckAmount]) {
    expect(
      request.mock.calls.map(([params]) => params.expectedAccountAddress),
    ).toEqual(['address-A', 'address-B', 'address-A']);
  }
  await act(async () => {
    newQuote.resolve({ swapIn: '3', fillPrice: '3' });
    newConfirmation.resolve({
      fee: { title: { text: 'fee' }, description: { text: 'current-fee' } },
    });
    newCheck.resolve({ code: 0, data: { result: true } });
    await Promise.all([
      newQuote.promise,
      newConfirmation.promise,
      newCheck.promise,
    ]);
  });
  expect(screen.getByText('1 BTC = 3 USDC')).toBeTruthy();
  expect(screen.getByText('current-fee')).toBeTruthy();
  await act(async () => {
    oldQuote.resolve({ swapIn: '9', fillPrice: '9' });
    oldConfirmation.resolve({
      fee: { title: { text: 'fee' }, description: { text: 'stale-fee' } },
    });
    oldCheck.resolve({ code: 1, message: 'stale-check' });
    await Promise.all([
      oldQuote.promise,
      oldConfirmation.promise,
      oldCheck.promise,
    ]);
  });
  expect(screen.getByText('1 BTC = 3 USDC')).toBeTruthy();
  expect(screen.getByText('current-fee')).toBeTruthy();
  expect(screen.queryByText('1 BTC = 9 USDC')).toBeNull();
  expect(screen.queryByText('stale-fee')).toBeNull();
  expect(screen.queryByText('stale-check')).toBeNull();
});

it('keeps the new quote when the same account and asset refresh during a request', async () => {
  const oldQuote = deferred<{ swapIn: string; fillPrice: string }>();
  const newQuote = deferred<{ swapIn: string; fillPrice: string }>();
  const oldConfirmation = deferred<{
    fee: { title: { text: string }; description: { text: string } };
  }>();
  const newConfirmation = deferred<{
    fee: { title: { text: string }; description: { text: string } };
  }>();
  const oldCheck = deferred<{ code: number; message: string }>();
  const newCheck = deferred<{ code: number; data: { result: boolean } }>();
  mockQuote
    .mockReset()
    .mockReturnValueOnce(oldQuote.promise)
    .mockReturnValueOnce(newQuote.promise);
  mockConfirmation
    .mockReset()
    .mockReturnValueOnce(oldConfirmation.promise)
    .mockReturnValueOnce(newConfirmation.promise);
  mockCheckAmount
    .mockReset()
    .mockReturnValueOnce(oldCheck.promise)
    .mockReturnValueOnce(newCheck.promise);
  const props = {
    accountId: 'same-account',
    networkId: 'sol--101',
    providerName: 'kamino',
    accountAddress: 'address-A',
    borrowMarketAddress: 'market',
    borrowReserveAddress: 'debt',
    balance: '10',
    debtBalance: '10',
    decimals: 6,
    price: '1',
    tokenSymbol: 'USDC',
    collateralAssets: collateral,
    onRepayWithCollateralConfirm: jest.fn(),
  };
  const { rerender } = render(<BorrowRepayPosition {...props} />);
  fireEvent.click(screen.getByText('collateral'));
  fireEvent.change(screen.getByLabelText('amount'), { target: { value: '1' } });
  await waitFor(() => expect(mockQuote).toHaveBeenCalledTimes(1));
  rerender(
    <BorrowRepayPosition
      {...props}
      collateralAssets={[{ ...collateral[0] }]}
    />,
  );
  await waitFor(() => expect(mockQuote).toHaveBeenCalledTimes(2));
  await act(async () => {
    newQuote.resolve({ swapIn: '3', fillPrice: '3' });
    newConfirmation.resolve({
      fee: { title: { text: 'fee' }, description: { text: 'current-fee' } },
    });
    newCheck.resolve({ code: 0, data: { result: true } });
    await Promise.all([
      newQuote.promise,
      newConfirmation.promise,
      newCheck.promise,
    ]);
  });
  expect(screen.getByText('1 BTC = 3 USDC')).toBeTruthy();
  expect(screen.getByText('current-fee')).toBeTruthy();
  await act(async () => {
    oldQuote.resolve({ swapIn: '9', fillPrice: '9' });
    oldConfirmation.resolve({
      fee: { title: { text: 'fee' }, description: { text: 'stale-fee' } },
    });
    oldCheck.resolve({ code: 1, message: 'stale-check' });
    await Promise.all([
      oldQuote.promise,
      oldConfirmation.promise,
      oldCheck.promise,
    ]);
  });
  expect(screen.getByText('1 BTC = 3 USDC')).toBeTruthy();
  expect(screen.getByText('current-fee')).toBeTruthy();
  expect(screen.queryByText('1 BTC = 9 USDC')).toBeNull();
  expect(screen.queryByText('stale-fee')).toBeNull();
  expect(screen.queryByText('stale-check')).toBeNull();
});
