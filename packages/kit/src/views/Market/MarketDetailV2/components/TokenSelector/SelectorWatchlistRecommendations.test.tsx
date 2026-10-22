/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import type { IMarketBasicConfigToken } from '@onekeyhq/shared/types/marketV2';

import { SelectorWatchlistRecommendations } from './SelectorWatchlistRecommendations';

const mockTokens: IMarketBasicConfigToken[] = Array.from(
  { length: 8 },
  (_, i) => ({
    chainId: 'evm--1',
    contractAddress: `0x${i}`,
    isNative: false,
    name: `Token ${i}`,
    symbol: `T${i}`,
    ...(i === 0 ? { assetId: 'bitcoin' } : {}),
  }),
);
let mockRecommendedTokens = mockTokens;
let mockConfigLoading = false;
let mockIsExtensionPopup = false;
let mockIsNative = true;
const mockAddTokens = jest.fn(async () => true);

jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }, values?: { number: number }) =>
      values ? `${id}:${values.number}` : id,
  }),
}));
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    get isNative() {
      return mockIsNative;
    },
    get isExtensionUiPopup() {
      return mockIsExtensionPopup;
    },
  },
}));
jest.mock('@onekeyhq/kit/src/views/Market/hooks/useMarketBasicConfig', () => ({
  useMarketBasicConfig: () => ({
    recommendedTokens: mockRecommendedTokens,
    isLoading: mockConfigLoading,
  }),
}));
jest.mock('../../../components/watchListHooksV2', () => ({
  useWatchListV2Action: () => ({ addIntoWatchListV2: mockAddTokens }),
}));
jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: { dex: { watchlist: { dexAddToWatchlist: jest.fn() } } },
}));
jest.mock('../../../MarketHomeV2/layouts/mobileLayoutUtils', () => ({
  getMarketRecommendContainerPaddingTop: () => 0,
}));
jest.mock(
  '../../../MarketHomeV2/components/MarketRecommendList/RecommendItem',
  () => ({
    RecommendItem: ({
      symbol,
      checked,
      disabled,
      address,
      onChange,
    }: {
      symbol: string;
      checked: boolean;
      disabled: boolean;
      address: string;
      onChange: (checked: boolean, address: string) => void;
    }) => (
      <button
        type="button"
        aria-pressed={checked}
        disabled={disabled}
        onClick={() => onChange(!checked, address)}
      >
        {symbol}
      </button>
    ),
  }),
);
jest.mock('@onekeyhq/components', () => {
  const Container = ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  );
  return {
    YStack: Container,
    XStack: Container,
    ScrollView: ({
      children,
      keyboardShouldPersistTaps,
      keyboardDismissMode,
    }: {
      children: ReactNode;
      keyboardShouldPersistTaps: string;
      keyboardDismissMode: string;
    }) => (
      <div
        data-testid="scroll"
        data-keyboard-taps={keyboardShouldPersistTaps}
        data-keyboard-mode={keyboardDismissMode}
      >
        {children}
      </div>
    ),
    Spinner: () => <div data-testid="spinner" />,
    Empty: ({ title }: { title: string }) => <div>{title}</div>,
    Button: ({
      children,
      onPress,
      disabled,
    }: {
      children: ReactNode;
      onPress: () => void;
      disabled: boolean;
    }) => (
      <button type="button" onClick={onPress} disabled={disabled}>
        {children}
      </button>
    ),
  };
});

beforeEach(() => {
  mockRecommendedTokens = mockTokens;
  mockConfigLoading = false;
  mockIsExtensionPopup = false;
  mockIsNative = true;
  mockAddTokens.mockClear();
});

it('defaults to eight selected tokens and adds the chosen tokens in display order', async () => {
  render(<SelectorWatchlistRecommendations />);
  expect(screen.getByTestId('scroll').getAttribute('data-keyboard-taps')).toBe(
    'handled',
  );
  expect(screen.getAllByRole('button', { pressed: true })).toHaveLength(8);
  fireEvent.click(screen.getByRole('button', { name: 'T1' }));
  fireEvent.click(
    screen.getByRole('button', { name: 'market.add_number_tokens:7' }),
  );
  await waitFor(() =>
    expect(mockAddTokens).toHaveBeenCalledWith(
      [
        { assetId: 'bitcoin', chainId: '', contractAddress: '' },
        ...mockTokens
          .slice(2)
          .map(({ chainId, contractAddress, isNative }) => ({
            chainId,
            contractAddress,
            isNative,
          })),
      ],
      { preserveOrder: true },
    ),
  );
});

it('prevents adding an empty selection', () => {
  render(<SelectorWatchlistRecommendations />);
  for (const token of mockTokens)
    fireEvent.click(screen.getByRole('button', { name: token.symbol }));
  const add = screen.getByRole('button', {
    name: 'market.add_number_tokens:0',
  });
  expect(add.hasAttribute('disabled')).toBe(true);
  fireEvent.click(add);
  expect(mockAddTokens).not.toHaveBeenCalled();
});

it('keeps the extension popup recommendation limit', () => {
  mockIsExtensionPopup = true;
  render(<SelectorWatchlistRecommendations />);
  expect(screen.getAllByRole('button', { pressed: true })).toHaveLength(6);
});

it('shows loading while the recommendation config is pending and a fallback if it is empty', () => {
  mockRecommendedTokens = [];
  mockConfigLoading = true;
  const { rerender } = render(<SelectorWatchlistRecommendations />);
  expect(screen.getByTestId('spinner')).toBeTruthy();
  mockConfigLoading = false;
  rerender(<SelectorWatchlistRecommendations />);
  expect(screen.getByText('market.favorites_empty')).toBeTruthy();
});

it.each([false, true])(
  'limits recommendation scroll dismissal to native=%s',
  (isNative) => {
    mockIsNative = isNative;
    render(<SelectorWatchlistRecommendations />);
    expect(
      screen.getByTestId('scroll').getAttribute('data-keyboard-mode'),
    ).toBe(isNative ? 'on-drag' : 'none');
  },
);
