/** @jest-environment jsdom */

import { StrictMode, Suspense, startTransition, useState } from 'react';
import type { PropsWithChildren } from 'react';

import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from '@testing-library/react';

import { EtherFiLiquidReferContract } from '@onekeyhq/shared/src/consts/addresses';
import { EApproveType } from '@onekeyhq/shared/types/staking';

import { useEtherFiStakeApproval } from './useEtherFiStakeApproval';

const mockDetails = jest.fn<Promise<unknown>, [unknown]>();
let mockFocused = true;

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceStaking: {
      getProtocolDetailsV2: (params: unknown) => mockDetails(params),
    },
  },
}));
jest.mock('@onekeyhq/kit/src/hooks/useRouteIsFocused', () => ({
  useRouteIsFocusedWhenEnabled: () => mockFocused,
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

const params = {
  enabled: true,
  networkId: 'evm--1',
  provider: 'etherfi',
  symbol: 'USDC',
  vault: '0xvault',
};
const approve = {
  approveType: EApproveType.Permit,
  approveTarget: EtherFiLiquidReferContract,
};

describe('EtherFi stake approval focus lifecycle', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFocused = true;
    mockDetails.mockResolvedValue({ protocol: { ...params, approve } });
  });

  it('does not reuse an old approval after switching away and back while unfocused', async () => {
    const { result, rerender } = renderHook(
      (value: typeof params) => useEtherFiStakeApproval(value),
      { initialProps: params },
    );
    await waitFor(() => expect(result.current.approve).toEqual(approve));
    mockFocused = false;
    rerender({ ...params, symbol: 'USDT' });
    expect(result.current.approve).toBeUndefined();
    rerender(params);
    expect(result.current.approve).toBeUndefined();
    expect(mockDetails).toHaveBeenCalledTimes(1);

    let finish: (value: unknown) => void = () => undefined;
    mockDetails.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    mockFocused = true;
    rerender(params);
    await waitFor(() => expect(mockDetails).toHaveBeenCalledTimes(2));
    expect(result.current.approve).toBeUndefined();
    const current = {
      ...approve,
      approveTarget: `0x${EtherFiLiquidReferContract.slice(2).toUpperCase()}`,
    };
    await act(async () => {
      finish({ protocol: { ...params, approve: current } });
    });
    await waitFor(() => expect(result.current.approve).toEqual(current));
  });

  it('does not reuse an approval after disabling and re-enabling the same scope', async () => {
    const { result, rerender } = renderHook(
      (value: typeof params) => useEtherFiStakeApproval(value),
      { initialProps: params },
    );
    await waitFor(() => expect(result.current.approve).toEqual(approve));
    mockFocused = false;
    rerender({ ...params, enabled: false });
    expect(result.current.approve).toBeUndefined();
    rerender(params);
    expect(result.current.approve).toBeUndefined();
  });

  it('ignores an old in-flight approval after switching away and back', async () => {
    let finish: (value: unknown) => void = () => undefined;
    mockDetails.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const { result, rerender } = renderHook(
      (value: typeof params) => useEtherFiStakeApproval(value),
      { initialProps: params },
    );
    await waitFor(() => expect(mockDetails).toHaveBeenCalledTimes(1));
    mockFocused = false;
    rerender({ ...params, symbol: 'USDT' });
    rerender(params);
    await act(async () => {
      finish({ protocol: { ...params, approve } });
    });
    expect(result.current.approve).toBeUndefined();
    mockFocused = true;
    rerender(params);
    await waitFor(() => expect(result.current.approve).toEqual(approve));
  });

  it('loads the current approval after StrictMode reconnects effects', async () => {
    const wrapper = ({ children }: PropsWithChildren) => (
      <StrictMode>{children}</StrictMode>
    );
    const { result } = renderHook(() => useEtherFiStakeApproval(params), {
      wrapper,
    });
    await waitFor(() => expect(result.current.approve).toEqual(approve));
  });

  it('keeps the committed approval when a different scope render is abandoned', async () => {
    const suspended = new Promise<never>(() => undefined);
    let setSymbol: (symbol: string) => void = () => undefined;
    let forceRender: () => void = () => undefined;
    let suspendedRenders = 0;

    function Approval({ symbol }: { symbol: string }) {
      const result = useEtherFiStakeApproval({ ...params, symbol });
      if (symbol === 'USDT') {
        suspendedRenders += 1;
        throw suspended;
      }
      return (
        <span data-testid="approval">{result.approve?.approveTarget}</span>
      );
    }

    function App() {
      const [symbol, updateSymbol] = useState(params.symbol);
      const [, updateTick] = useState(0);
      setSymbol = updateSymbol;
      forceRender = () => updateTick((tick) => tick + 1);
      return (
        <Suspense fallback={<span>Loading</span>}>
          <Approval symbol={symbol} />
        </Suspense>
      );
    }

    render(<App />);
    await waitFor(() =>
      expect(screen.getByTestId('approval').textContent).toBe(
        approve.approveTarget,
      ),
    );

    act(() => {
      startTransition(() => setSymbol('USDT'));
    });
    expect(suspendedRenders).toBeGreaterThan(0);
    expect(screen.getByTestId('approval').textContent).toBe(
      approve.approveTarget,
    );
    expect(mockDetails).toHaveBeenCalledTimes(1);

    act(() => setSymbol(params.symbol));
    act(() => forceRender());
    expect(screen.getByTestId('approval').textContent).toBe(
      approve.approveTarget,
    );
    expect(mockDetails).toHaveBeenCalledTimes(1);
  });

  it('retries the committed scope while a different scope render is suspended', async () => {
    mockDetails.mockRejectedValueOnce(new Error('network error'));
    const suspended = new Promise<never>(() => undefined);
    let setSymbol: (symbol: string) => void = () => undefined;
    let suspendedRenders = 0;

    function Approval({ symbol }: { symbol: string }) {
      const result = useEtherFiStakeApproval({ ...params, symbol });
      if (symbol === 'USDT') {
        suspendedRenders += 1;
        throw suspended;
      }
      return (
        <>
          <span data-testid="approval">{result.approve?.approveTarget}</span>
          {result.error ? (
            <button type="button" onClick={() => void result.retry()}>
              Retry
            </button>
          ) : null}
        </>
      );
    }

    function App() {
      const [symbol, updateSymbol] = useState(params.symbol);
      setSymbol = updateSymbol;
      return (
        <Suspense fallback={<span>Loading</span>}>
          <Approval symbol={symbol} />
        </Suspense>
      );
    }

    render(<App />);
    await screen.findByRole('button', { name: 'Retry' });
    act(() => {
      startTransition(() => setSymbol('USDT'));
    });
    expect(suspendedRenders).toBeGreaterThan(0);
    expect(mockDetails).toHaveBeenCalledTimes(1);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    });
    expect(mockDetails).toHaveBeenCalledTimes(2);
    expect(mockDetails).toHaveBeenLastCalledWith({
      networkId: params.networkId,
      provider: params.provider,
      symbol: params.symbol,
      vault: params.vault,
    });
    await waitFor(() =>
      expect(screen.getByTestId('approval').textContent).toBe(
        approve.approveTarget,
      ),
    );
  });
});
