import { act, renderHook } from '@testing-library/react-native';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type { IEarnTokenItem } from '@onekeyhq/shared/types/staking';

import { useEarnWithdrawAssets } from './useEarnWithdrawAssets';

type IAssetsResult = { scopeKey: string; assets: IEarnTokenItem[] };
const mockPromiseState: {
  result?: IAssetsResult;
  method?: () => Promise<IAssetsResult | undefined>;
} = {};

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: { serviceStaking: { getEarnAssetsList: jest.fn() } },
}));

jest.mock('@onekeyhq/kit/src/hooks/usePromiseResult', () => ({
  usePromiseResult: (method: () => Promise<IAssetsResult | undefined>) => {
    mockPromiseState.method = method;
    return { result: mockPromiseState.result };
  },
}));

const serviceStaking = jest.mocked(backgroundApiProxy.serviceStaking);

const params = {
  enabled: true,
  accountId: 'account-1',
  networkId: 'evm--1',
  provider: 'VaultProvider',
  symbol: 'eETH',
  vault: '0xvault-1',
};
const assets: IEarnTokenItem[] = ['weETH', 'USDC'].map((symbol, index) => ({
  info: {
    symbol,
    name: symbol,
    address: `0x000000000000000000000000000000000000000${index}`,
    decimals: 18,
    isNative: false,
  },
  balance: '0',
  balanceParsed: '0',
  fiatValue: '0',
  price: '1',
  price24h: '0',
}));

describe('withdraw output asset selection', () => {
  beforeEach(() => {
    mockPromiseState.result = undefined;
    mockPromiseState.method = undefined;
    serviceStaking.getEarnAssetsList.mockReset().mockResolvedValue({ assets });
  });

  it('requests unstake assets using the entry symbol and selects the first available output', async () => {
    const { result, rerender } = renderHook(() =>
      useEarnWithdrawAssets(params),
    );
    expect(result.current.selectedAsset).toBeUndefined();
    mockPromiseState.result = await mockPromiseState.method?.();
    rerender({});
    expect(serviceStaking.getEarnAssetsList.mock.calls[0][0]).toEqual({
      accountId: params.accountId,
      networkId: params.networkId,
      provider: params.provider,
      symbol: 'eETH',
      vault: params.vault,
      action: 'unstake',
    });
    expect(result.current.selectedAsset?.info.symbol).toBe('weETH');
    act(() => result.current.selectAsset(assets[1]));
    expect(result.current.selectedAsset?.info.symbol).toBe('USDC');
  });

  it('hides stale output assets immediately when the account or vault changes', async () => {
    const { result, rerender } = renderHook(
      (props: typeof params) => useEarnWithdrawAssets(props),
      { initialProps: params },
    );
    mockPromiseState.result = await mockPromiseState.method?.();
    rerender(params);
    expect(result.current.selectedAsset).toBeDefined();
    rerender({ ...params, vault: '0xvault-2' });
    expect(result.current.assets).toEqual([]);
    expect(result.current.selectedAsset).toBeUndefined();
    rerender({ ...params, accountId: 'account-2' });
    expect(result.current.selectedAsset).toBeUndefined();
  });

  it('does not retain an output removed from the current allowed asset list', async () => {
    const { result, rerender } = renderHook(() =>
      useEarnWithdrawAssets(params),
    );
    mockPromiseState.result = await mockPromiseState.method?.();
    rerender({});
    act(() => result.current.selectAsset(assets[1]));
    mockPromiseState.result = {
      scopeKey: mockPromiseState.result?.scopeKey ?? '',
      assets: [assets[0]],
    };
    rerender({});
    expect(result.current.selectedAsset?.info.symbol).toBe('weETH');
  });

  it('does not query or expose cached assets when the feature is disabled', async () => {
    const { result } = renderHook(() =>
      useEarnWithdrawAssets({ ...params, enabled: false }),
    );
    expect(await mockPromiseState.method?.()).toBeUndefined();
    expect(serviceStaking.getEarnAssetsList.mock.calls).toHaveLength(0);
    expect(result.current.selectedAsset).toBeUndefined();
  });
});
