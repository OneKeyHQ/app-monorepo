/** @jest-environment jsdom */
import type { PropsWithChildren, ReactNode } from 'react';

import { fireEvent, render, screen } from '@testing-library/react';

import SwapCommonInfoItem from '@onekeyhq/kit/src/views/Swap/components/SwapCommonInfoItem';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
import type { INumberFormatProps } from '@onekeyhq/shared/src/utils/numberUtils';
import type {
  IDustSweepReason,
  IDustSweepToken,
} from '@onekeyhq/shared/types/swap/dustSweep';
import type { ISwapProviderInfo } from '@onekeyhq/shared/types/swap/SwapProvider.constants';
import { EProtocolOfExchange } from '@onekeyhq/shared/types/swap/types';

import { initialDustSweepState } from '../stateMachine';

import { DustSweepResult, DustSweepSummary } from './DustSweepSummary';

import type { IDustSweepState } from '../stateMachine';

let mockLocale = 'en-US';

jest.mock('@onekeyhq/components', () => {
  function MockStack({
    children,
    testID,
    onPress,
  }: PropsWithChildren<{ testID?: string; onPress?: () => void }>) {
    return onPress ? (
      <button type="button" data-testid={testID} onClick={onPress}>
        {children}
      </button>
    ) : (
      <div data-testid={testID}>{children}</div>
    );
  }
  function MockButton({
    children,
    testID,
    disabled,
    loading,
    onPress,
    accessibilityLabel,
  }: PropsWithChildren<{
    testID?: string;
    disabled?: boolean;
    loading?: boolean;
    onPress?: () => void;
    accessibilityLabel?: string;
  }>) {
    return (
      <button
        type="button"
        data-testid={testID}
        disabled={disabled}
        data-loading={loading ? 'true' : 'false'}
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
    ScrollView: MockStack,
    SizableText: MockStack,
    NumberSizeableText: ({
      children,
      formatter,
      formatterOptions,
    }: INumberFormatProps & { children: string }) => {
      const { numberFormatAsRenderText } = jest.requireActual<
        typeof import('@onekeyhq/shared/src/utils/numberUtils')
      >('@onekeyhq/shared/src/utils/numberUtils');
      const { useMemo } = jest.requireActual<typeof import('react')>('react');
      const parts = useMemo(
        () =>
          numberFormatAsRenderText(children, { formatter, formatterOptions }),
        [children, formatter, formatterOptions, numberFormatAsRenderText],
      );
      return (
        <span>
          {typeof parts === 'string'
            ? parts
            : parts.map((part, index) =>
                typeof part === 'string' ? (
                  part
                ) : (
                  <sub key={index}>{part.value}</sub>
                ),
              )}
        </span>
      );
    },
    Skeleton: ({ testID }: { testID?: string }) => (
      <div data-testid={testID ?? 'skeleton'} />
    ),
    Stack: MockStack,
    Tooltip: () => null,
    XStack: MockStack,
    YStack: MockStack,
  };
});
jest.mock('react-native', () => ({
  useWindowDimensions: () => ({ width: 390, height: 844 }),
}));
jest.mock('react-intl', () => ({
  ...jest.requireActual<typeof import('react-intl')>('react-intl'),
  useIntl: () => ({
    locale: mockLocale,
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
  useSharedValue: (value: number) => ({ value }),
  useAnimatedStyle: () => ({}),
  withTiming: (value: number) => value,
  withSequence: (...values: number[]) => values[values.length - 1],
  FadeIn: { duration: () => undefined },
}));
jest.mock('@onekeyhq/kit/src/components/Token', () => ({
  Token: () => <span data-testid="receive-token" />,
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
jest.mock('./DustSweepSlippage', () => ({ DustSweepSlippage: () => null }));
jest.mock('@onekeyhq/kit/src/components/Token/TokenGroup', () => ({
  TokenGroup: ({ tokens }: { tokens: unknown[] }) => (
    <span data-testid="token-group">{tokens.length}</span>
  ),
}));

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
let mockCurrent: { nativeToken: typeof nativeToken } | undefined = {
  nativeToken,
};
let mockSelected = [selectedToken];
let mockProviderInfo: ISwapProviderInfo | undefined = configuredProvider;
let mockLoadStatus: 'loading' | 'ready' | 'error' = 'ready';
let mockAssetStatus: 'refreshing' | 'ready' | 'error' = 'ready';
let mockSelecting = true;
let mockSessionState = initialDustSweepState;
let mockSelectedValueUsd = '10';
const mockStart = jest.fn();
const mockRetryAssets = jest.fn();
jest.mock('../DustSweepProvider', () => ({
  useDustSweep: () => ({
    session: { state: mockSessionState, leaving: false },
    selecting: mockSelecting,
    current: mockCurrent,
    selected: mockSelected,
    providerInfo: mockProviderInfo,
    selectedValueUsd: mockSelectedValueUsd,
    canStart:
      mockSelected.length > 0 &&
      mockAssetStatus === 'ready' &&
      mockLoadStatus === 'ready',
    isFocused: true,
    loadStatus: mockLoadStatus,
    assetStatus: mockAssetStatus,
    start: mockStart,
    retryAssets: mockRetryAssets,
  }),
}));

beforeEach(() => {
  mockLocale = 'en-US';
  appLocale.setLocale(mockLocale, appLocale.intl.messages);
  mockCurrent = { nativeToken };
  mockSelected = [selectedToken];
  mockProviderInfo = configuredProvider;
  mockLoadStatus = 'ready';
  mockAssetStatus = 'ready';
  mockSelecting = true;
  mockSessionState = initialDustSweepState;
  mockSelectedValueUsd = '10';
  jest.clearAllMocks();
});

afterEach(() => appLocale.setLocale('en-US', appLocale.intl.messages));

it.each([true, false])(
  'shows a loading button and token skeleton until initial assets arrive (desktop=%s)',
  (desktop) => {
    mockCurrent = undefined;
    mockSelected = [];
    mockLoadStatus = 'loading';
    mockAssetStatus = 'refreshing';
    const { rerender } = render(
      <DustSweepSummary desktop={desktop} onDetails={jest.fn()} />,
    );
    const action = screen.getByTestId('dust-sweep-action');
    expect(action.getAttribute('data-loading')).toBe('true');
    expect(action.textContent).toBe('');
    expect(action.hasAttribute('disabled')).toBe(true);
    expect(action.getAttribute('aria-label')).toBe(
      ETranslations.global_syncing,
    );
    expect(screen.getByTestId('dust-sweep-receive-token-loading')).toBeTruthy();
    expect(screen.queryByTestId('receive-token')).toBeNull();
    fireEvent.click(action);
    expect(mockStart).not.toHaveBeenCalled();

    mockCurrent = { nativeToken };
    mockSelected = [selectedToken];
    mockLoadStatus = 'ready';
    mockAssetStatus = 'ready';
    rerender(<DustSweepSummary desktop={desktop} onDetails={jest.fn()} />);
    expect(
      screen.getByTestId('dust-sweep-action').getAttribute('data-loading'),
    ).toBe('false');
    expect(screen.getByTestId('dust-sweep-action').textContent).toContain(
      ETranslations.button_convert_tokens_estimated_amount,
    );
    expect(screen.queryByTestId('dust-sweep-receive-token-loading')).toBeNull();
    expect(screen.getByTestId('receive-token')).toBeTruthy();
  },
);

it.each([true, false])(
  'keeps the known token while refreshing cached assets with a loading-only button (desktop=%s)',
  (desktop) => {
    mockAssetStatus = 'refreshing';
    render(<DustSweepSummary desktop={desktop} onDetails={jest.fn()} />);
    expect(
      screen.getByTestId('dust-sweep-action').getAttribute('data-loading'),
    ).toBe('true');
    expect(screen.getByTestId('dust-sweep-action').textContent).toBe('');
    expect(screen.queryByTestId('dust-sweep-receive-token-loading')).toBeNull();
    expect(screen.getByTestId('receive-token')).toBeTruthy();
  },
);

it.each([true, false])(
  'retains error retry without a loading button or token skeleton (desktop=%s)',
  (desktop) => {
    mockAssetStatus = 'error';
    render(<DustSweepSummary desktop={desktop} onDetails={jest.fn()} />);
    const action = screen.getByTestId('dust-sweep-action');
    expect(action.getAttribute('data-loading')).toBe('false');
    expect(action.hasAttribute('disabled')).toBe(false);
    expect(action.textContent).toContain(ETranslations.global_retry);
    expect(screen.queryByTestId('dust-sweep-receive-token-loading')).toBeNull();
    fireEvent.click(action);
    expect(mockRetryAssets).toHaveBeenCalledTimes(1);
    expect(mockStart).not.toHaveBeenCalled();
  },
);

it('keeps the completed action out of loading during a background refresh', () => {
  mockSelecting = false;
  mockSessionState = completedState([{ key: 'done', status: 'success' }]);
  mockAssetStatus = 'refreshing';
  mockLoadStatus = 'loading';
  render(<DustSweepSummary desktop onDetails={jest.fn()} />);
  const action = screen.getByTestId('dust-sweep-action');
  expect(action.getAttribute('data-loading')).toBe('false');
  expect(action.textContent).toBe(ETranslations.global_done);
  expect(screen.queryByTestId('dust-sweep-receive-token-loading')).toBeNull();
});

it.each([true, false])(
  'shows zero receive amounts instead of placeholders without a network (desktop=%s)',
  (desktop) => {
    mockCurrent = undefined;
    mockSelected = [];
    render(<DustSweepSummary desktop={desktop} onDetails={jest.fn()} />);

    expect(screen.getByText('0.00')).toBeTruthy();
    expect(screen.getByText('$0.00')).toBeTruthy();
    expect(screen.queryByText('—')).toBeNull();
  },
);

it('keeps slippage help accessible without provider fee help in Dust', () => {
  render(<DustSweepSummary desktop onDetails={jest.fn()} />);

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
  'estimates the receive amount from the selection and shows the configured provider (desktop=%s)',
  (desktop) => {
    render(<DustSweepSummary desktop={desktop} onDetails={jest.fn()} />);

    // $10 of selected tokens at a $1000 native price; nothing is quoted yet.
    expect(screen.getByText('0.01 ETH')).toBeTruthy();
    expect(screen.getByText('$10.00')).toBeTruthy();
    expect(screen.getByText(configuredProvider.providerName)).toBeTruthy();
    expect(screen.getByTestId('provider-icon').getAttribute('data-uri')).toBe(
      configuredProvider.logo,
    );
    expect(screen.getByTestId('dust-sweep-action').textContent).toBe(
      'button_convert_tokens_estimated_amount:1:$10.00',
    );
    fireEvent.click(screen.getByTestId('dust-sweep-action'));
    expect(mockStart).toHaveBeenCalledTimes(1);
  },
);

it('shows the receive estimate as unavailable when the native price is zero', () => {
  mockCurrent = { nativeToken: { ...nativeToken, price: '0' } };
  render(<DustSweepSummary desktop onDetails={jest.fn()} />);

  expect(screen.getByText('— ETH')).toBeTruthy();
  expect(screen.queryByText(/Infinity/)).toBeNull();
});

it.each([true, false])(
  'shows configured provider metadata with no selected token and formats zero fiat (desktop=%s)',
  (desktop) => {
    mockSelected = [];
    mockSelectedValueUsd = '0';
    render(<DustSweepSummary desktop={desktop} onDetails={jest.fn()} />);

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
    render(<DustSweepSummary desktop onDetails={jest.fn()} />);

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
  render(<DustSweepSummary desktop onDetails={jest.fn()} />);

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

it.each([true, false])(
  'preserves a tiny received amount using the shared balance subscript (desktop=%s)',
  (desktop) => {
    render(
      <DustSweepResult
        desktop={desktop}
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
            {
              token: selectedToken,
              status: 'success',
              receivedAmount: '0.0000001234',
            },
          ],
        }}
      />,
    );
    const amount = screen.getByTestId('dust-sweep-result-amount');
    expect(amount.textContent).toBe('+0.061234 ETH');
    expect(amount.querySelector('sub')?.textContent).toBe('6');
  },
);

it('uses the same subscript formatter for a tiny receive estimate', () => {
  mockSelectedValueUsd = '0.0001234';
  render(<DustSweepSummary desktop onDetails={jest.fn()} />);
  const amount = screen.getByTestId('dust-sweep-receive-amount');
  expect(amount.textContent).toBe('0.061234 ETH');
  expect(amount.querySelector('sub')?.textContent).toBe('6');
});

it.each(['result', 'estimate'] as const)(
  'updates the cached %s formatter when the token symbol or locale changes',
  (mode) => {
    const state = completedState([{ key: 'done', status: 'success' }]);
    state.items[0].receivedAmount = '1234.5';
    mockSelectedValueUsd = '1234500';
    const view = (symbol: string) => {
      const token = { ...nativeToken, symbol };
      if (mode === 'result') {
        return (
          <DustSweepResult
            desktop
            state={{
              ...state,
              snapshot: state.snapshot && {
                ...state.snapshot,
                nativeToken: token,
              },
            }}
          />
        );
      }
      mockCurrent = { nativeToken: token };
      return <DustSweepSummary desktop onDetails={jest.fn()} />;
    };
    const { rerender } = render(view('ETH'));
    const testId =
      mode === 'result'
        ? 'dust-sweep-result-amount'
        : 'dust-sweep-receive-amount';
    const prefix = mode === 'result' ? '+' : '';
    expect(screen.getByTestId(testId).textContent).toBe(`${prefix}1,234.5 ETH`);

    rerender(view('BNB'));
    expect(screen.getByTestId(testId).textContent).toBe(`${prefix}1,234.5 BNB`);

    mockLocale = 'de-DE';
    appLocale.setLocale(mockLocale, appLocale.intl.messages);
    rerender(view('BNB'));
    expect(screen.getByTestId(testId).textContent).toBe(`${prefix}1.234,5 BNB`);
  },
);

function completedState(
  items: {
    key: string;
    status: 'success' | 'skipped' | 'failed';
    reason?: IDustSweepReason;
  }[],
): IDustSweepState {
  const tokens = items.map(({ key }) => ({ ...selectedToken, key }));
  return {
    phase: 'completed',
    snapshot: {
      id: 'completed',
      networkId: 'evm--1',
      accountId: 'account',
      address: '0xuser',
      nativeToken,
      slippage: 5,
      tokens,
    },
    items: items.map(({ status, reason }, index) => ({
      token: tokens[index],
      status,
      reason,
      receivedAmount: status === 'success' ? '0.01' : undefined,
    })),
  };
}

it('shows an all-failed desktop result with expanded reasons and no amount', () => {
  render(
    <DustSweepResult
      desktop
      state={completedState([
        { key: 'a', status: 'skipped', reason: 'noQuote' },
        { key: 'b', status: 'skipped', reason: 'noQuote' },
        { key: 'c', status: 'failed', reason: 'txFailed' },
      ])}
    />,
  );

  expect(screen.queryByTestId('dust-sweep-result-amount')).toBeNull();
  expect(screen.getByText(ETranslations.dust_sweep_failed)).toBeTruthy();
  expect(screen.getByTestId('dust-sweep-result-subtitle').textContent).toBe(
    `${ETranslations.dust_no_tokens_converted}:3`,
  );
  expect(screen.queryByTestId('dust-sweep-skip-footnote')).toBeNull();
  expect(screen.getByText('dust_sweep_token_count__desc:0')).toBeTruthy();
  expect(screen.getByText('dust_sweep_token_count__desc:3')).toBeTruthy();
  expect(screen.getByTestId('dust-sweep-skip-reasons')).toBeTruthy();
  // Each row reads like its token rows, followed by the token preview count.
  expect(
    screen
      .getAllByTestId('dust-sweep-skip-reason')
      .map((row) => row.textContent),
  ).toEqual([
    `${ETranslations.swap_page_provider_rate_unavailable}2`,
    `${ETranslations.swap_review_transaction_failed}1`,
  ]);
  // Desktop owns its action button in the summary card.
  expect(screen.queryByTestId('dust-sweep-result-again')).toBeNull();
});

it('collapses mobile skip reasons behind Skipped and leaves the actions to the summary', () => {
  render(
    <DustSweepResult
      state={completedState([
        { key: 'a', status: 'skipped', reason: 'noQuote' },
      ])}
    />,
  );

  expect(screen.queryByTestId('dust-sweep-skip-reasons')).toBeNull();
  fireEvent.click(screen.getByTestId('dust-sweep-result-skipped'));
  expect(screen.getByTestId('dust-sweep-skip-reasons')).toBeTruthy();
  fireEvent.click(screen.getByTestId('dust-sweep-result-skipped'));
  expect(screen.queryByTestId('dust-sweep-skip-reasons')).toBeNull();
  expect(screen.queryByTestId('dust-sweep-view-details')).toBeNull();
  expect(screen.queryByTestId('dust-sweep-result-again')).toBeNull();
});

it('shows the received amount for a partial mobile result', () => {
  render(
    <DustSweepResult
      state={completedState([
        { key: 'a', status: 'success' },
        { key: 'b', status: 'skipped', reason: 'insufficientGas' },
      ])}
    />,
  );

  expect(screen.getByTestId('dust-sweep-result-amount').textContent).toBe(
    '+0.01 ETH',
  );
  // One converted and one skipped.
  expect(screen.getAllByText('dust_sweep_token_count__desc:1')).toHaveLength(2);
});

it('shows live progress and the running total while converting', () => {
  const state = completedState([
    { key: 'a', status: 'success' },
    { key: 'b', status: 'skipped', reason: 'noQuote' },
    { key: 'c', status: 'success' },
  ]);
  render(
    <DustSweepResult
      state={{
        ...state,
        phase: 'running',
        items: state.items.map((item, index) =>
          index === 2
            ? { ...item, status: 'preparing', receivedAmount: undefined }
            : item,
        ),
      }}
    />,
  );

  // "Converting" with its dots; no running count in the title.
  expect(screen.getByTestId('dust-sweep-result-title').textContent).toBe(
    `${ETranslations.dust_sweep_converting__title}...`,
  );
  expect(screen.getByTestId('dust-sweep-result-amount').textContent).toBe(
    '+0.01 ETH',
  );
  // On mobile the skip reason stays folded until Skipped is opened.
  expect(screen.queryByTestId('dust-sweep-skip-reasons')).toBeNull();
  fireEvent.click(screen.getByTestId('dust-sweep-result-skipped'));
  expect(screen.getByTestId('dust-sweep-skip-reasons')).toBeTruthy();
});
