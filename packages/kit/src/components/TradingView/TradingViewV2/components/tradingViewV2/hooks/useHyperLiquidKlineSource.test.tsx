/**
 * @jest-environment jsdom
 */

import { renderHook } from '@testing-library/react-native';

import type {
  IMarketBasicConfigData,
  IMarketBasicConfigResponse,
} from '@onekeyhq/shared/types/marketV2';

import { useHyperLiquidKlineSource } from './useHyperLiquidKlineSource';

const mockUseMarketBasicConfig = jest.fn(
  (): {
    basicConfig: IMarketBasicConfigData | undefined;
    isLoading: boolean;
  } => ({
    basicConfig: undefined,
    isLoading: false,
  }),
);
const mockGetLastMarketBasicConfigForPlatform = jest.fn(
  (): IMarketBasicConfigResponse | undefined => undefined,
);

jest.mock('@onekeyhq/kit/src/views/Market/hooks', () => ({
  useMarketBasicConfig: () => mockUseMarketBasicConfig(),
}));

jest.mock(
  '@onekeyhq/kit/src/views/Market/hooks/useMarketBasicConfig/fetchMarketBasicConfigForPlatform',
  () => ({
    getLastMarketBasicConfigForPlatform: () =>
      mockGetLastMarketBasicConfigForPlatform(),
  }),
);

describe('useHyperLiquidKlineSource', () => {
  beforeEach(() => {
    mockUseMarketBasicConfig.mockReset();
    mockGetLastMarketBasicConfigForPlatform.mockReset();
    mockGetLastMarketBasicConfigForPlatform.mockReturnValue(undefined);
  });

  it('reclassifies the mounted token after config recovery', () => {
    const networkId = 'evm--42161';
    const tokenAddress = '0x1234';
    let configResult: {
      basicConfig: IMarketBasicConfigData | undefined;
      isLoading: boolean;
    } = {
      basicConfig: undefined,
      isLoading: false,
    };
    mockUseMarketBasicConfig.mockImplementation(() => configResult);

    const { result, rerender } = renderHook(() =>
      useHyperLiquidKlineSource(networkId, tokenAddress),
    );

    expect(result.current).toEqual({
      isHyperLiquidSource: false,
      symbol: undefined,
      isLoading: false,
    });

    configResult = {
      basicConfig: {
        HyperLiquidKlineSourceTokens: [
          {
            networkId,
            tokenAddress,
            symbol: 'PURR',
          },
        ],
      } as IMarketBasicConfigData,
      isLoading: false,
    };
    rerender({});

    expect(result.current).toEqual({
      isHyperLiquidSource: true,
      symbol: 'PURR',
      isLoading: false,
    });
  });
});
