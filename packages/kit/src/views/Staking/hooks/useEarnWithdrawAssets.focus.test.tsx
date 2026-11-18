/** @jest-environment jsdom */

import { StrictMode, Suspense, startTransition, useState } from 'react';

import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';

import type {
  IEarnAssetsList,
  IEarnTokenItem,
} from '@onekeyhq/shared/types/staking';

import { useEarnWithdrawAssets } from './useEarnWithdrawAssets';

const mockGetAssets = jest.fn<Promise<IEarnAssetsList>, [unknown]>();
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceStaking: {
      getEarnAssetsList: (request: unknown) => mockGetAssets(request),
    },
  },
}));
jest.mock('@onekeyhq/kit/src/hooks/useRouteIsFocused', () => ({
  useRouteIsFocusedWhenEnabled: () => true,
}));
jest.mock('@onekeyhq/components', () => {
  const deferred = jest.requireActual<
    typeof import('@onekeyhq/components/src/hooks/useDeferredPromise')
  >('../../../../../components/src/hooks/useDeferredPromise');
  return {
    getCurrentVisibilityState: () => true,
    onVisibilityStateChange: () => () => undefined,
    useDeferredPromise: deferred.useDeferredPromise,
    useNetInfo: () => ({ isRawInternetReachable: true }),
  };
});

const asset: IEarnTokenItem = {
  info: {
    symbol: 'USDC',
    name: 'USDC',
    address: '0xtoken',
    decimals: 6,
    isNative: false,
  },
  balance: '0',
  balanceParsed: '0',
  fiatValue: '0',
  price: '1',
  price24h: '0',
};
const params = {
  enabled: true,
  networkId: 'evm--1',
  provider: 'etherfi',
  symbol: 'USDC',
  vault: '0xvault',
};

describe('withdraw output asset committed scope', () => {
  beforeEach(() => {
    mockGetAssets.mockReset().mockResolvedValue({ assets: [asset] });
  });

  it.each(['ready', 'error'] as const)(
    'keeps or retries account A when account B render is abandoned: %s',
    async (initialStatus) => {
      if (initialStatus === 'error') {
        mockGetAssets
          .mockRejectedValueOnce(new Error('offline'))
          .mockResolvedValueOnce({ assets: [asset] });
      }
      const suspended = new Promise<never>(() => undefined);
      let setAccount: (accountId: string) => void = () => undefined;
      let forceRender: () => void = () => undefined;
      let suspendedRenders = 0;

      const Assets = ({ accountId }: { accountId: string }) => {
        const result = useEarnWithdrawAssets({ ...params, accountId });
        if (accountId === 'account-b') {
          suspendedRenders += 1;
          throw suspended;
        }
        return (
          <div>
            <span data-testid="status">{result.status ?? 'loading'}</span>
            <span data-testid="asset">{result.selectedAsset?.info.symbol}</span>
            <button type="button" onClick={() => void result.retry()}>
              Retry
            </button>
          </div>
        );
      };
      const App = () => {
        const [accountId, updateAccount] = useState('account-a');
        const [, updateTick] = useState(0);
        setAccount = updateAccount;
        forceRender = () => updateTick((tick) => tick + 1);
        return (
          <Suspense fallback={<span>Loading</span>}>
            <Assets accountId={accountId} />
          </Suspense>
        );
      };

      render(<App />);
      await waitFor(() =>
        expect(screen.getByTestId('status').textContent).toBe(initialStatus),
      );
      act(() => startTransition(() => setAccount('account-b')));
      expect(suspendedRenders).toBeGreaterThan(0);
      if (initialStatus === 'error') {
        fireEvent.click(screen.getByText('Retry'));
        await waitFor(() => expect(mockGetAssets).toHaveBeenCalledTimes(2));
        expect(mockGetAssets.mock.calls[1][0]).toEqual(
          expect.objectContaining({ accountId: 'account-a' }),
        );
        await waitFor(() =>
          expect(screen.getByTestId('status').textContent).toBe('ready'),
        );
      }
      act(() => setAccount('account-a'));
      act(() => forceRender());
      expect(screen.getByTestId('status').textContent).toBe('ready');
      expect(screen.getByTestId('asset').textContent).toBe('USDC');
    },
  );

  it('loads the current output assets after StrictMode reconnects effects', async () => {
    function Assets() {
      const result = useEarnWithdrawAssets({
        ...params,
        accountId: 'account-a',
      });
      return <span>{result.selectedAsset?.info.symbol}</span>;
    }
    render(
      <StrictMode>
        <Assets />
      </StrictMode>,
    );
    await waitFor(() => expect(screen.getByText('USDC')).toBeTruthy());
  });
});
