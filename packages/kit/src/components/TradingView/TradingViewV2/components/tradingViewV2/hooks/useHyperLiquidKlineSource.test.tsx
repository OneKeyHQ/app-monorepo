/**
 * @jest-environment jsdom
 */

import { act, renderHook } from '@testing-library/react-native';

import type {
  IMarketBasicConfigData,
  IMarketBasicConfigResponse,
} from '@onekeyhq/shared/types/marketV2';

import { useHyperLiquidKlineSource } from './useHyperLiquidKlineSource';

const mockUseNetInfo = jest.fn((_enabled: boolean) => ({
  isRawInternetReachable: true as boolean | null,
}));
const mockFetchMarketBasicConfigForPlatform: jest.MockedFunction<
  () => Promise<IMarketBasicConfigResponse>
> = jest.fn();
const mockGetLastMarketBasicConfigForPlatform = jest.fn(
  (): IMarketBasicConfigResponse | undefined => undefined,
);
let mockConfigListener:
  | ((response: IMarketBasicConfigResponse) => void)
  | undefined;
const mockSubscribeMarketBasicConfigForPlatform = jest.fn(
  (listener: (response: IMarketBasicConfigResponse) => void) => {
    mockConfigListener = listener;
    return jest.fn();
  },
);

jest.mock('@onekeyhq/components', () => ({
  useNetInfo: (enabled: boolean) => mockUseNetInfo(enabled),
}));

jest.mock(
  '@onekeyhq/kit/src/views/Market/hooks/useMarketBasicConfig/fetchMarketBasicConfigForPlatform',
  () => ({
    fetchMarketBasicConfigForPlatform: () =>
      mockFetchMarketBasicConfigForPlatform(),
    getLastMarketBasicConfigForPlatform: () =>
      mockGetLastMarketBasicConfigForPlatform(),
    subscribeMarketBasicConfigForPlatform: (
      listener: (response: IMarketBasicConfigResponse) => void,
    ) => mockSubscribeMarketBasicConfigForPlatform(listener),
  }),
);

function buildConfigResponse(
  data: IMarketBasicConfigData,
): IMarketBasicConfigResponse {
  return {
    code: 0,
    message: '',
    data,
  };
}

describe('useHyperLiquidKlineSource', () => {
  beforeEach(() => {
    mockUseNetInfo.mockClear();
    mockFetchMarketBasicConfigForPlatform.mockReset();
    mockGetLastMarketBasicConfigForPlatform.mockReset();
    mockGetLastMarketBasicConfigForPlatform.mockReturnValue(undefined);
    mockSubscribeMarketBasicConfigForPlatform.mockClear();
    mockConfigListener = undefined;
  });

  it('reclassifies the mounted token after config recovery', async () => {
    const networkId = 'evm--42161';
    const tokenAddress = '0x1234';
    mockFetchMarketBasicConfigForPlatform.mockRejectedValueOnce(
      new Error('config unavailable'),
    );

    const { result } = renderHook(() =>
      useHyperLiquidKlineSource(networkId, tokenAddress),
    );

    expect(result.current.isLoading).toBe(true);
    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current).toEqual({
      isHyperLiquidSource: false,
      symbol: undefined,
      isLoading: false,
    });

    act(() => {
      mockConfigListener?.(
        buildConfigResponse({
          HyperLiquidKlineSourceTokens: [
            {
              networkId,
              tokenAddress,
              symbol: 'PURR',
            },
          ],
        } as IMarketBasicConfigData),
      );
    });

    expect(result.current).toEqual({
      isHyperLiquidSource: true,
      symbol: 'PURR',
      isLoading: false,
    });
  });

  it('does not subscribe or fetch when an immediate result is available', () => {
    const networkId = 'evm--42161';
    const tokenAddress = '0x1234';
    mockGetLastMarketBasicConfigForPlatform.mockReturnValue(
      buildConfigResponse({
        HyperLiquidKlineSourceTokens: [
          {
            networkId,
            tokenAddress,
            symbol: 'PURR',
          },
        ],
      } as IMarketBasicConfigData),
    );

    const { result } = renderHook(() =>
      useHyperLiquidKlineSource(networkId, tokenAddress),
    );

    expect(result.current).toEqual({
      isHyperLiquidSource: true,
      symbol: 'PURR',
      isLoading: false,
    });
    expect(mockUseNetInfo).toHaveBeenCalledWith(false);
    expect(mockFetchMarketBasicConfigForPlatform).not.toHaveBeenCalled();
    expect(mockSubscribeMarketBasicConfigForPlatform).not.toHaveBeenCalled();
  });
});
