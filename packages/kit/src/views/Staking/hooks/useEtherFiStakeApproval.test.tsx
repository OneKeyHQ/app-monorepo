/** @jest-environment jsdom */
import { renderHook } from '@testing-library/react';

import { EtherFiLiquidReferContract } from '@onekeyhq/shared/src/consts/addresses';
import { EApproveType } from '@onekeyhq/shared/types/staking';

import { useEtherFiStakeApproval } from './useEtherFiStakeApproval';

const mockDetails = jest.fn<Promise<unknown>, [unknown]>();
let mockLoad: () => Promise<unknown>;
let mockResult: unknown;
const mockRetry = jest.fn();

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceStaking: {
      getProtocolDetailsV2: (params: unknown) => mockDetails(params),
    },
  },
}));

jest.mock('@onekeyhq/kit/src/hooks/usePromiseResult', () => ({
  usePromiseResult: (load: () => Promise<unknown>) => {
    mockLoad = load;
    return { result: mockResult, run: mockRetry };
  },
}));

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

describe('EtherFi stake approval from existing protocol details', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockResult = undefined;
    mockDetails.mockResolvedValue({ protocol: { ...params, approve } });
  });

  it('loads the selected asset approval using the existing protocol details API', async () => {
    const { result, rerender } = renderHook(() =>
      useEtherFiStakeApproval(params),
    );
    mockResult = await mockLoad();
    rerender();
    expect(result.current.approve).toEqual(approve);
    expect(result.current.error).toBe(false);
    expect(mockDetails).toHaveBeenCalledWith({
      networkId: params.networkId,
      provider: params.provider,
      symbol: params.symbol,
      vault: params.vault,
    });
  });

  it('uses the ETH entry support check and the WETH legacy approval for native EtherFi deposits', async () => {
    const ethParams = { ...params, symbol: 'ETH', wrappedNative: true };
    mockDetails.mockResolvedValue({
      protocol: { ...params, symbol: 'ETH', approve: {} },
    });
    const { result, rerender } = renderHook(() =>
      useEtherFiStakeApproval(ethParams),
    );
    mockResult = await mockLoad();
    rerender();
    expect(result.current.approve).toEqual({
      approveType: EApproveType.Legacy,
      approveTarget: EtherFiLiquidReferContract,
    });
    expect(mockDetails).toHaveBeenCalledWith(
      expect.objectContaining({ symbol: 'ETH' }),
    );
  });

  it('does not infer wrapped approval for an unsupported ETH entry', async () => {
    mockDetails.mockResolvedValue({ statement: 'unsupported' });
    renderHook(() =>
      useEtherFiStakeApproval({
        ...params,
        symbol: 'ETH',
        wrappedNative: true,
      }),
    );
    expect(await mockLoad()).toEqual(expect.objectContaining({ error: true }));
  });

  it('does not reuse another asset or vault approval after switching', async () => {
    const { result, rerender } = renderHook(
      (value: typeof params) => useEtherFiStakeApproval(value),
      { initialProps: params },
    );
    mockResult = await mockLoad();
    rerender({ ...params, symbol: 'USDT' });
    expect(result.current.approve).toBeUndefined();
    rerender({ ...params, vault: '0xother' });
    expect(result.current.approve).toBeUndefined();
  });

  it('rejects details for a different asset or vault', async () => {
    mockDetails.mockResolvedValue({
      protocol: { ...params, symbol: 'USDT', approve },
    });
    renderHook(() => useEtherFiStakeApproval(params));
    expect(await mockLoad()).toEqual(expect.objectContaining({ error: true }));
    mockDetails.mockResolvedValue({
      protocol: { ...params, vault: '0xother', approve },
    });
    expect(await mockLoad()).toEqual(expect.objectContaining({ error: true }));
  });

  it('rejects a configured spender different from the EtherFi deposit contract', async () => {
    mockDetails.mockResolvedValue({
      protocol: {
        ...params,
        approve: {
          approveType: EApproveType.Legacy,
          approveTarget: '0x3333333333333333333333333333333333333333',
        },
      },
    });
    const { result, rerender } = renderHook(() =>
      useEtherFiStakeApproval(params),
    );
    mockResult = await mockLoad();
    rerender();
    expect(result.current.approve).toBeUndefined();
    expect(result.current.error).toBe(true);
  });

  it.each([
    ['an unknown approval type', { ...approve, approveType: 'unknown' }],
    ['an empty approval configuration', {}],
  ])('rejects %s', async (_description, configuredApprove) => {
    mockDetails.mockResolvedValue({
      protocol: { ...params, approve: configuredApprove },
    });
    renderHook(() => useEtherFiStakeApproval(params));
    expect(await mockLoad()).toEqual(expect.objectContaining({ error: true }));
  });

  it('rejects the expected spender on an unsupported network', async () => {
    const otherNetwork = { ...params, networkId: 'evm--137' };
    mockDetails.mockResolvedValue({ protocol: { ...otherNetwork, approve } });
    renderHook(() => useEtherFiStakeApproval(otherNetwork));
    expect(await mockLoad()).toEqual(expect.objectContaining({ error: true }));
  });

  it('blocks a statement-only response for an unsupported protocol entry', async () => {
    mockDetails.mockResolvedValue({ statement: { title: 'Unavailable' } });
    const { result, rerender } = renderHook(() =>
      useEtherFiStakeApproval(params),
    );
    mockResult = await mockLoad();
    rerender();
    expect(result.current.approve).toBeUndefined();
    expect(result.current.error).toBe(true);
  });

  it('exposes a retry when the existing details request fails', async () => {
    mockDetails.mockRejectedValue(new Error('network error'));
    const { result, rerender } = renderHook(() =>
      useEtherFiStakeApproval(params),
    );
    mockResult = await mockLoad();
    rerender();
    expect(result.current.error).toBe(true);
    await result.current.retry();
    expect(mockRetry).toHaveBeenCalledTimes(1);
  });
});
