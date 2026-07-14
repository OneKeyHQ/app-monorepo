import { renderHook } from '@testing-library/react-native';

import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';

import { useStakingPendingTxsByInfo } from './useStakingPendingTxs';

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {},
}));

jest.mock('@onekeyhq/kit/src/hooks/usePromiseResult', () => ({
  usePromiseResult: jest.fn(),
}));

jest.mock('../../../states/jotai/contexts/accountSelector', () => ({
  useActiveAccount: () => ({ activeAccount: {} }),
}));

jest.mock('../../../states/jotai/contexts/earn', () => {
  const state = {};
  return { useEarnAtom: () => [state] };
});

const mockUsePromiseResult = usePromiseResult as unknown as jest.Mock;

describe('useStakingPendingTxsByInfo', () => {
  it('keeps equal explicit network ids stable across renders', () => {
    const run = jest.fn(async () => undefined);
    mockUsePromiseResult.mockImplementation(
      (_method, _deps, options: { initResult?: unknown } = {}) => ({
        result: options.initResult,
        run,
        isLoading: false,
      }),
    );

    const tagMatcher = () => true;
    const { rerender } = renderHook(
      ({ renderId }: { renderId: number }) => {
        void renderId;
        return useStakingPendingTxsByInfo({
          networkIds: ['evm--1'],
          tagMatcher,
        });
      },
      { initialProps: { renderId: 0 } },
    );

    const firstNetworkIds = mockUsePromiseResult.mock.calls[0][1][0];
    mockUsePromiseResult.mockClear();
    rerender({ renderId: 1 });
    const secondNetworkIds = mockUsePromiseResult.mock.calls[0][1][0];

    expect(secondNetworkIds).toBe(firstNetworkIds);
  });
});
