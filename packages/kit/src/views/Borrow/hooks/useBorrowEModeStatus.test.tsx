import { act, renderHook } from '@testing-library/react-native';

import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';

import { useBorrowEModeStatus } from './useBorrowEModeStatus';

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: { serviceStaking: { getBorrowEModeStatus: jest.fn() } },
}));

jest.mock('@onekeyhq/kit/src/hooks/usePromiseResult', () => ({
  usePromiseResult: jest.fn(),
}));

const mockUsePromiseResult = usePromiseResult as unknown as jest.Mock;

describe('useBorrowEModeStatus', () => {
  it('does not expose a retained status from another account scope', () => {
    const status = { eModeId: 1, originalLtv: '80', categories: [] };
    mockUsePromiseResult.mockReturnValue({
      result: {
        scopeKey: JSON.stringify([
          'evm--1',
          'aave',
          '0xmarket',
          'account-a',
          true,
        ]),
        eModeStatus: status,
      },
      run: jest.fn(),
      isLoading: false,
    });

    const { result, rerender } = renderHook(
      ({ accountId }: { accountId: string }) =>
        useBorrowEModeStatus({
          networkId: 'evm--1',
          provider: 'Aave',
          marketAddress: '0xmarket',
          accountId,
        }),
      { initialProps: { accountId: 'account-a' } },
    );

    expect(result.current.eModeStatus).toBe(status);
    rerender({ accountId: 'account-b' });
    expect(result.current.eModeStatus).toBeNull();
  });

  it('keeps the current scope status visible while a refresh is in flight', async () => {
    const status = { eModeId: 1, originalLtv: '80', categories: [] };
    const scopeKey = JSON.stringify([
      'evm--1',
      'aave',
      '0xmarket',
      'account-a',
      true,
    ]);
    let currentResult:
      | { scopeKey: string; eModeStatus: typeof status }
      | undefined = { scopeKey, eModeStatus: status };
    let clearResultOnRefresh = false;
    const run = jest.fn(async () => {
      if (clearResultOnRefresh) {
        currentResult = undefined;
      }
    });

    mockUsePromiseResult.mockImplementation(
      (_method, _deps, options: { undefinedResultIfReRun?: boolean }) => {
        clearResultOnRefresh = options.undefinedResultIfReRun === true;
        return { result: currentResult, run, isLoading: !currentResult };
      },
    );

    const { result, rerender } = renderHook(() =>
      useBorrowEModeStatus({
        networkId: 'evm--1',
        provider: 'Aave',
        marketAddress: '0xmarket',
        accountId: 'account-a',
      }),
    );

    expect(result.current.eModeStatus).toBe(status);
    await act(async () => {
      await result.current.refresh();
    });
    rerender(undefined);
    expect(result.current.eModeStatus).toBe(status);
  });
});
