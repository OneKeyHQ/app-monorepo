/** @jest-environment jsdom */

import type { ComponentProps, ReactNode } from 'react';

import { fireEvent, render, screen } from '@testing-library/react';

import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';

import LegacyMarketDetailRoute from './LegacyMarketDetailRoute';

const mockRetry = jest.fn();
const mockUsePromiseResult = jest.mocked(usePromiseResult);

jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }) => id,
  }),
}));

jest.mock('@onekeyhq/components', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const Page = ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  );
  Page.Header = () => <div />;
  Page.Body = ({ children }: { children?: ReactNode }) => <div>{children}</div>;

  return {
    Button: ({
      children,
      onPress,
      testID,
    }: {
      children?: ReactNode;
      onPress?: () => void;
      testID?: string;
    }) => (
      <button type="button" data-testid={testID} onClick={onPress}>
        {children}
      </button>
    ),
    Page,
    SizableText: ({ children }: { children?: ReactNode }) => (
      <span>{children}</span>
    ),
    Spinner: () => <div data-testid="spinner" />,
    Stack: React.forwardRef<HTMLDivElement, { children?: ReactNode }>(
      ({ children }, ref) => <div ref={ref}>{children}</div>,
    ),
  };
});

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceMarket: {
      fetchMarketTokenDetail: jest.fn(),
    },
  },
}));

jest.mock('@onekeyhq/kit/src/hooks/usePromiseResult', () => ({
  usePromiseResult: jest.fn(),
}));

jest.mock('./MarketDetailV2', () => ({
  MarketDetailV2: () => <div data-testid="market-detail-v2" />,
}));

jest.mock('./utils/legacyMarketNetwork', () => ({
  getLegacyMarketDetailV2RouteParams: jest.fn(),
}));

describe('LegacyMarketDetailRoute', () => {
  beforeEach(() => {
    mockRetry.mockReset();
    mockUsePromiseResult.mockReturnValue({
      result: { status: 'error' },
      isLoading: false,
      run: mockRetry,
    } as never);
  });

  it('shows a retry action when the legacy detail request fails', () => {
    const props = {
      route: {
        key: 'legacy-market-detail',
        name: 'MarketDetail',
        params: { token: 'bitcoin' },
      },
      navigation: {},
    } as unknown as ComponentProps<typeof LegacyMarketDetailRoute>;

    render(<LegacyMarketDetailRoute {...props} />);

    fireEvent.click(screen.getByTestId('legacy-market-detail-retry'));

    expect(mockRetry).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('spinner')).toBeNull();
  });
});
