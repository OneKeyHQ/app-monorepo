/** @jest-environment jsdom */
import type { PropsWithChildren } from 'react';

import { fireEvent, render, screen } from '@testing-library/react';

import { EWatchlistFrom } from '@onekeyhq/shared/src/logger/scopes/dex';

import { MarketListingStar } from './MarketListingStar';

import type { IMarketListingWatchlistIdentity } from '../utils/marketListingWatchlistIdentity';

const identity: IMarketListingWatchlistIdentity = {
  chainId: 'btc--0',
  contractAddress: '',
  isNative: true,
  tokenSymbol: 'BTC',
};
let mockResult:
  | {
      kind: 'asset' | 'stock';
      listingId: string;
      identity?: IMarketListingWatchlistIdentity;
      failed: boolean;
    }
  | undefined;
const mockRun = jest.fn();
const mockAcquire = jest.fn<
  {
    promise: Promise<IMarketListingWatchlistIdentity | undefined>;
    release: () => void;
  },
  unknown[]
>();
let mockFocused = true;
let mockExecuteRequests = false;

jest.mock('../utils/marketListingWatchlistIdentity', () => ({
  acquireMarketListingWatchlistIdentity: (...args: unknown[]) =>
    mockAcquire(...args),
}));
jest.mock('@onekeyhq/kit/src/hooks/useRouteIsFocused', () => ({
  useRouteIsFocused: () => mockFocused,
}));
jest.mock('@onekeyhq/kit/src/hooks/usePromiseResult', () => {
  const ReactModule = jest.requireActual<typeof import('react')>('react');
  return {
    usePromiseResult: (callback: () => Promise<unknown>) => {
      ReactModule.useEffect(() => {
        if (mockExecuteRequests && mockFocused) {
          void callback();
        }
      }, [callback]);
      return { result: mockResult, isLoading: false, run: mockRun };
    },
  };
});
jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
jest.mock('@onekeyhq/components', () => ({
  Stack: ({
    children,
    onPress,
  }: PropsWithChildren<{
    onPress: React.MouseEventHandler<HTMLDivElement>;
  }>) => (
    <div role="presentation" onClick={onPress}>
      {children}
    </div>
  ),
  IconButton: ({
    disabled,
    title,
    onPress,
  }: {
    disabled: boolean;
    title: string;
    onPress: () => void;
  }) => (
    <button type="button" disabled={disabled} onClick={onPress}>
      {title}
    </button>
  ),
}));
jest.mock('./MarketStarV2', () => ({
  MarketStarV2: ({
    chainId,
    contractAddress,
  }: {
    chainId: string;
    contractAddress: string;
  }) => <button type="button">{`${chainId}:${contractAddress}`}</button>,
}));

beforeEach(() => {
  mockResult = undefined;
  mockRun.mockReset();
  mockAcquire.mockReset();
  mockFocused = true;
  mockExecuteRequests = false;
});

it('does not expose a previous row identity while resolving the new listing', () => {
  mockResult = { kind: 'asset', listingId: 'bitcoin', identity, failed: false };
  const { rerender } = render(
    <MarketListingStar
      kind="asset"
      listingId="bitcoin"
      from={EWatchlistFrom.Homepage}
    />,
  );
  expect(screen.getByRole('button').textContent).toBe('btc--0:');
  rerender(
    <MarketListingStar
      kind="asset"
      listingId="ethereum"
      from={EWatchlistFrom.Homepage}
    />,
  );
  expect(screen.queryByText('btc--0:')).toBeNull();
  expect(screen.getByRole('button').hasAttribute('disabled')).toBe(true);
});

it('blocks row navigation for a favorite click', () => {
  mockResult = { kind: 'asset', listingId: 'bitcoin', identity, failed: false };
  const navigate = jest.fn();
  render(
    <div role="presentation" onClick={navigate}>
      <MarketListingStar
        kind="asset"
        listingId="bitcoin"
        from={EWatchlistFrom.Homepage}
      />
    </div>,
  );
  fireEvent.click(screen.getByRole('button'));
  expect(navigate).not.toHaveBeenCalled();
});

it('allows retry on failure without enabling an invalid favorite', () => {
  mockResult = { kind: 'stock', listingId: 'AAPL', failed: true };
  render(
    <MarketListingStar
      kind="stock"
      listingId="AAPL"
      from={EWatchlistFrom.Homepage}
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: 'global.retry' }));
  expect(mockRun).toHaveBeenCalledTimes(1);
});

it('disables the action when no token identity is available', () => {
  mockResult = { kind: 'stock', listingId: 'EMPTY', failed: false };
  render(
    <MarketListingStar
      kind="stock"
      listingId="EMPTY"
      from={EWatchlistFrom.Homepage}
    />,
  );
  expect(screen.getByRole('button').hasAttribute('disabled')).toBe(true);
});

it('passes the resolved identity to the Home renderer', () => {
  mockResult = { kind: 'asset', listingId: 'bitcoin', identity, failed: false };
  const renderButton = jest.fn(() => (
    <button type="button">Home favorite</button>
  ));
  render(
    <MarketListingStar
      kind="asset"
      listingId="bitcoin"
      from={EWatchlistFrom.Homepage}
      renderButton={renderButton}
    />,
  );
  expect(renderButton).toHaveBeenCalledWith(identity);
  expect(screen.getByText('Home favorite')).toBeDefined();
});

it('releases queued identity work on row reuse, blur, and unmount', () => {
  mockExecuteRequests = true;
  const firstRelease = jest.fn();
  const secondRelease = jest.fn();
  const thirdRelease = jest.fn();
  const pending = new Promise<undefined>(jest.fn());
  mockAcquire
    .mockReturnValueOnce({ promise: pending, release: firstRelease })
    .mockReturnValueOnce({ promise: pending, release: secondRelease })
    .mockReturnValueOnce({ promise: pending, release: thirdRelease });
  const row = (listingId: string) => (
    <MarketListingStar
      kind="asset"
      listingId={listingId}
      from={EWatchlistFrom.Homepage}
    />
  );
  const { rerender, unmount } = render(row('bitcoin'));
  rerender(row('ethereum'));
  expect(firstRelease).toHaveBeenCalledTimes(1);
  expect(secondRelease).not.toHaveBeenCalled();
  mockFocused = false;
  rerender(row('ethereum'));
  expect(secondRelease).toHaveBeenCalledTimes(1);
  mockFocused = true;
  rerender(row('solana'));
  unmount();
  expect(thirdRelease).toHaveBeenCalledTimes(1);
});
