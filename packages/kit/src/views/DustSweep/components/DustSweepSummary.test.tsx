/** @jest-environment jsdom */
import type { PropsWithChildren } from 'react';

import { fireEvent, render, screen } from '@testing-library/react';

import { ETranslations } from '@onekeyhq/shared/src/locale';

import { initialDustSweepState } from '../stateMachine';

import { DustSweepSummary } from './DustSweepSummary';

import type { useDustSweepPreview } from '../hooks/useDustSweepPreview';

jest.mock('@onekeyhq/components', () => {
  function MockStack({
    children,
    testID,
  }: PropsWithChildren<{ testID?: string }>) {
    return <div data-testid={testID}>{children}</div>;
  }
  function MockButton({
    children,
    testID,
    disabled,
    onPress,
  }: PropsWithChildren<{
    testID?: string;
    disabled?: boolean;
    onPress?: () => void;
  }>) {
    return (
      <button
        type="button"
        data-testid={testID}
        disabled={disabled}
        onClick={onPress}
      >
        {children}
      </button>
    );
  }
  return {
    Button: MockButton,
    Dialog: { show: jest.fn() },
    Divider: () => null,
    Icon: () => null,
    IconButton: MockButton,
    SizableText: MockStack,
    Skeleton: () => <div data-testid="skeleton" />,
    Stack: MockStack,
    Tooltip: () => null,
    XStack: MockStack,
    YStack: MockStack,
  };
});
jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
jest.mock('react-native-reanimated', () => ({}));
jest.mock('@onekeyhq/kit/src/components/Token', () => ({
  Token: () => null,
}));
jest.mock(
  '@onekeyhq/kit/src/views/Swap/components/PreSwapConfirmResult',
  () => ({
    SwapTransactionResultStatus: () => null,
  }),
);
jest.mock(
  '@onekeyhq/kit/src/views/Swap/components/SwapProviderInfoItem',
  () => ({
    __esModule: true,
    default: ({ providerName }: { providerName: string }) => (
      <span data-testid="provider-name">{providerName}</span>
    ),
  }),
);
jest.mock('@onekeyhq/kit/src/views/Swap/components/SwapRefreshButton', () => ({
  SwapRefreshButtonBase: () => null,
}));
jest.mock('./DustSweepSlippage', () => ({ DustSweepSlippage: () => null }));

type IPreview = ReturnType<typeof useDustSweepPreview>;
const unavailablePreview: IPreview = {
  status: 'error',
  amount: '0',
  quotedCount: 0,
  availableKeys: [],
  unavailable: { token: 'noQuote' },
  providers: [],
  autoRefreshTimerActive: false,
};
const readyPreview: IPreview = {
  status: 'ready',
  amount: '0.01',
  quotedCount: 1,
  availableKeys: ['token'],
  unavailable: {},
  providers: [{ provider: 'SwapOKX', providerName: 'OKX' }],
  autoRefreshTimerActive: true,
};
let mockPreview = unavailablePreview;
const mockRetryPreview = jest.fn();
const mockStart = jest.fn();
jest.mock('../DustSweepProvider', () => ({
  useDustSweep: () => ({
    session: { state: initialDustSweepState, leaving: false },
    selecting: true,
    current: { nativeToken: { symbol: 'ETH', price: '1000' } },
    preview: mockPreview,
    selected: [{ key: 'token' }],
    quotedValueUsd: '10',
    canStart: mockPreview.status === 'ready',
    isFocused: true,
    loadStatus: 'ready',
    start: mockStart,
    retryPreview: mockRetryPreview,
  }),
}));

beforeEach(() => {
  mockPreview = unavailablePreview;
  jest.clearAllMocks();
});

it.each([true, false])(
  'keeps unavailable amounts and provider text through refresh and expiry (desktop=%s)',
  (desktop) => {
    const renderSummary = () => (
      <DustSweepSummary
        desktop={desktop}
        onDone={jest.fn()}
        onDetails={jest.fn()}
      />
    );
    const { rerender } = render(renderSummary());
    for (const status of ['error', 'refreshing', 'expired'] as const) {
      mockPreview = { ...unavailablePreview, status };
      rerender(renderSummary());
      expect(screen.getByText('— ETH')).toBeTruthy();
      expect(screen.getByText('—')).toBeTruthy();
      expect(screen.queryByText('0 ETH')).toBeNull();
      expect(screen.queryByText('$0')).toBeNull();
      expect(screen.getByTestId('provider-name').textContent).toBe(
        ETranslations.swap_page_provider_rate_unavailable,
      );
      expect(
        screen.getByTestId('dust-sweep-action').hasAttribute('disabled'),
      ).toBe(status !== 'expired');
    }
    expect(screen.getByTestId('dust-sweep-action').textContent).toBe(
      ETranslations.swap_page_button_refresh_quotes,
    );
    fireEvent.click(screen.getByTestId('dust-sweep-action'));
    expect(mockRetryPreview).toHaveBeenCalledTimes(1);
    expect(mockStart).not.toHaveBeenCalled();
  },
);

it.each([true, false])(
  'retains a previous quote for display while refreshing or expired (desktop=%s)',
  (desktop) => {
    mockPreview = readyPreview;
    const renderSummary = () => (
      <DustSweepSummary
        desktop={desktop}
        onDone={jest.fn()}
        onDetails={jest.fn()}
      />
    );
    const { rerender } = render(renderSummary());
    for (const status of ['ready', 'refreshing', 'expired'] as const) {
      mockPreview = { ...readyPreview, status };
      rerender(renderSummary());
      expect(screen.getByText('0.01 ETH')).toBeTruthy();
      expect(screen.getByText('$10')).toBeTruthy();
      expect(screen.getByTestId('provider-name').textContent).toBe('OKX');
    }
    fireEvent.click(screen.getByTestId('dust-sweep-action'));
    expect(mockRetryPreview).toHaveBeenCalledTimes(1);
    expect(mockStart).not.toHaveBeenCalled();
  },
);
