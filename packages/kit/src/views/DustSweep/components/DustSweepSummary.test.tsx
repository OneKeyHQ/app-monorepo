/** @jest-environment jsdom */
import type { PropsWithChildren, ReactNode } from 'react';

import { fireEvent, render, screen } from '@testing-library/react';

import SwapCommonInfoItem from '@onekeyhq/kit/src/views/Swap/components/SwapCommonInfoItem';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IDustSweepToken } from '@onekeyhq/shared/types/swap/dustSweep';
import type { ISwapProviderInfo } from '@onekeyhq/shared/types/swap/SwapProvider.constants';
import { EProtocolOfExchange } from '@onekeyhq/shared/types/swap/types';

import { initialDustSweepState } from '../stateMachine';

import { DustSweepResult, DustSweepSummary } from './DustSweepSummary';

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
    accessibilityLabel,
  }: PropsWithChildren<{
    testID?: string;
    disabled?: boolean;
    onPress?: () => void;
    accessibilityLabel?: string;
  }>) {
    return (
      <button
        type="button"
        data-testid={testID}
        disabled={disabled}
        onClick={onPress}
        aria-label={accessibilityLabel}
      >
        {children}
      </button>
    );
  }
  return {
    Badge: MockStack,
    Button: MockButton,
    Dialog: { show: jest.fn() },
    Divider: () => null,
    Icon: ({ name }: { name: string }) => <span data-testid={name} />,
    IconButton: MockButton,
    Image: ({ source }: { source?: { uri?: string } }) => (
      <span data-testid="provider-icon" data-uri={source?.uri} />
    ),
    Popover: ({
      renderTrigger,
      mountNativePortalBeforeOpen,
    }: {
      renderTrigger: ReactNode;
      mountNativePortalBeforeOpen?: boolean;
    }) => (
      <div
        data-testid="help-popover"
        data-mount-before-open={mountNativePortalBeforeOpen}
      >
        {renderTrigger}
      </div>
    ),
    SizableText: MockStack,
    Skeleton: () => <div data-testid="skeleton" />,
    Stack: MockStack,
    Tooltip: () => null,
    XStack: MockStack,
    YStack: MockStack,
  };
});
jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: (
      { id }: { id: string },
      values?: Record<string, string | number>,
    ) => (values ? `${id}:${Object.values(values).join(':')}` : id),
  }),
}));
jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  default: { View: ({ children }: PropsWithChildren) => <div>{children}</div> },
  useReducedMotion: () => true,
  FadeIn: { duration: () => undefined },
}));
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
  '@onekeyhq/kit/src/views/Swap/components/SwapServiceFeeOverview',
  () => ({
    SwapServiceFeeOverview: () => <span data-testid="provider-fee-help" />,
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
  unavailable: { token: { reason: 'noQuote' } },
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
const selectedToken: IDustSweepToken = {
  key: 'token',
  networkId: 'evm--1',
  contractAddress: '0xtoken',
  symbol: 'TOKEN',
  decimals: 18,
  amount: '1',
  valueUsd: '10',
  suspicious: false,
};
const nativeToken = {
  networkId: 'evm--1',
  contractAddress: '',
  symbol: 'ETH',
  decimals: 18,
  price: '1000',
};
const configuredProvider: ISwapProviderInfo = {
  provider: 'SwapOKX',
  protocol: EProtocolOfExchange.SWAP,
  providerName: 'OKX from provider list',
  logo: 'https://example.com/provider-from-list.png',
};
let mockSelected = [selectedToken];
let mockProviderInfo: ISwapProviderInfo | undefined = configuredProvider;
let mockLoadStatus: 'loading' | 'ready' | 'error' = 'ready';
let mockQuotedValueUsd = '10';
const mockRetryPreview = jest.fn();
const mockStart = jest.fn();
jest.mock('../DustSweepProvider', () => ({
  useDustSweep: () => ({
    session: { state: initialDustSweepState, leaving: false },
    selecting: true,
    current: { nativeToken },
    preview: mockPreview,
    selected: mockSelected,
    providerInfo: mockProviderInfo,
    quotedValueUsd: mockQuotedValueUsd,
    canStart: mockPreview.status === 'ready',
    isFocused: true,
    loadStatus: mockLoadStatus,
    start: mockStart,
    retryPreview: mockRetryPreview,
  }),
}));

beforeEach(() => {
  mockPreview = unavailablePreview;
  mockSelected = [selectedToken];
  mockProviderInfo = configuredProvider;
  mockLoadStatus = 'ready';
  mockQuotedValueUsd = '10';
  jest.clearAllMocks();
});

it('keeps slippage help accessible without provider fee help in Dust', () => {
  render(<DustSweepSummary desktop onDone={jest.fn()} onDetails={jest.fn()} />);

  expect(
    screen.getByRole('button', {
      name: ETranslations.slippage_tolerance_title,
    }),
  ).toBeTruthy();
  expect(
    screen.getByTestId('help-popover').getAttribute('data-mount-before-open'),
  ).toBe('true');
  expect(screen.queryByTestId('provider-fee-help')).toBeNull();
});

it('preserves shared help defaults when Dust options are absent or removed', () => {
  const props = { title: 'Slippage', questionMarkContent: 'Help' };
  const { rerender } = render(<SwapCommonInfoItem {...props} />);
  const expectDefaultHelp = () => {
    expect(screen.getByTestId('InfoCircleOutline')).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
    expect(
      screen.getByTestId('help-popover').getAttribute('data-mount-before-open'),
    ).toBeNull();
  };
  expectDefaultHelp();

  rerender(
    <SwapCommonInfoItem
      {...props}
      questionMarkPopoverProps={{
        mountNativePortalBeforeOpen: true,
        renderTrigger: <button type="button">Slippage help</button>,
      }}
    />,
  );
  expect(screen.getByRole('button', { name: 'Slippage help' })).toBeTruthy();
  expect(screen.queryByTestId('InfoCircleOutline')).toBeNull();
  expect(
    screen.getByTestId('help-popover').getAttribute('data-mount-before-open'),
  ).toBe('true');

  rerender(<SwapCommonInfoItem {...props} />);
  expectDefaultHelp();
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
      expect(
        screen.getByText(ETranslations.swap_page_provider_rate_unavailable),
      ).toBeTruthy();
      expect(screen.queryByText(configuredProvider.providerName)).toBeNull();
      expect(screen.queryByTestId('provider-icon')).toBeNull();
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
    expect(screen.getByTestId('dust-sweep-action').textContent).toContain(
      '$10.00',
    );
    for (const status of ['ready', 'refreshing', 'expired'] as const) {
      mockPreview = { ...readyPreview, status };
      rerender(renderSummary());
      expect(screen.getByText('0.01 ETH')).toBeTruthy();
      expect(screen.getByText('$10.00')).toBeTruthy();
      expect(screen.getByText('OKX')).toBeTruthy();
      expect(screen.queryByText(configuredProvider.providerName)).toBeNull();
    }
    fireEvent.click(screen.getByTestId('dust-sweep-action'));
    expect(mockRetryPreview).toHaveBeenCalledTimes(1);
    expect(mockStart).not.toHaveBeenCalled();
  },
);

it.each([true, false])(
  'shows configured provider metadata with no selected token and formats zero fiat (desktop=%s)',
  (desktop) => {
    mockSelected = [];
    mockQuotedValueUsd = '0';
    mockPreview = { ...unavailablePreview, status: 'idle', unavailable: {} };
    render(
      <DustSweepSummary
        desktop={desktop}
        onDone={jest.fn()}
        onDetails={jest.fn()}
      />,
    );

    expect(screen.getByText(configuredProvider.providerName)).toBeTruthy();
    expect(screen.getByTestId('provider-icon').getAttribute('data-uri')).toBe(
      configuredProvider.logo,
    );
    expect(screen.getByText('0 ETH')).toBeTruthy();
    expect(screen.getByText('$0.00')).toBeTruthy();
    expect(screen.getByTestId('dust-sweep-action').textContent).toContain(
      '$0.00',
    );
    expect(
      screen.getByTestId('dust-sweep-action').hasAttribute('disabled'),
    ).toBe(true);
  },
);

it.each(['loading', 'error'] as const)(
  'does not display configured metadata for an empty selection while the load is %s',
  (status) => {
    mockSelected = [];
    mockLoadStatus = status;
    mockPreview = { ...unavailablePreview, status: 'idle', unavailable: {} };
    render(
      <DustSweepSummary desktop onDone={jest.fn()} onDetails={jest.fn()} />,
    );

    expect(screen.queryByText(configuredProvider.providerName)).toBeNull();
    expect(screen.queryByTestId('provider-icon')).toBeNull();
    if (status === 'loading')
      expect(screen.getAllByTestId('skeleton').length).toBeGreaterThan(0);
    else expect(screen.getByText('--')).toBeTruthy();
  },
);

it('keeps the empty provider placeholder when the list does not contain metadata', () => {
  mockSelected = [];
  mockProviderInfo = undefined;
  mockPreview = { ...unavailablePreview, status: 'idle', unavailable: {} };
  render(<DustSweepSummary desktop onDone={jest.fn()} onDetails={jest.fn()} />);

  expect(screen.getByText('--')).toBeTruthy();
  expect(screen.queryByTestId('provider-icon')).toBeNull();
});

it('formats received USD to two decimal places without padding native amounts', () => {
  render(
    <DustSweepResult
      desktop
      state={{
        phase: 'completed',
        snapshot: {
          id: 'completed',
          networkId: 'evm--1',
          accountId: 'account',
          address: '0xuser',
          nativeToken,
          slippage: 5,
          tokens: [selectedToken],
        },
        items: [
          { token: selectedToken, status: 'success', receivedAmount: '0.01' },
        ],
      }}
    />,
  );

  expect(screen.getByTestId('dust-sweep-result-amount').textContent).toBe(
    '+0.01 ETH',
  );
  expect(screen.getByText('$10.00')).toBeTruthy();
});
