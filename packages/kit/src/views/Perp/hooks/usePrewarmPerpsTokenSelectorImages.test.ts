/** @jest-environment jsdom */

import { renderHook, waitFor } from '@testing-library/react';

import { prewarmPerpsTokenSelectorImages } from '@onekeyhq/kit/src/utils/coldStartImagePreload';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import {
  getCachedPerpsTokenSelectorInitialList,
  setCachedPerpsTokenSelectorInitialList,
} from '../utils/tokenSelectorInitialListCache';

import { usePrewarmPerpsTokenSelectorImages } from './usePrewarmPerpsTokenSelectorImages';

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isWeb: true },
}));
jest.mock('@onekeyhq/kit/src/utils/coldStartImagePreload', () => ({
  prewarmPerpsTokenSelectorImages: jest.fn(async () => 1),
}));
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceHyperliquid: {
      getTradingUniverse: async () => ({
        universesByDex: [[{ name: 'BTC', assetId: 0 }]],
      }),
      getTokenSearchAliases: async () => ({}),
    },
    simpleDb: {
      perp: {
        getAllDexsAssetCtxsSnapshotCache: async () => ({
          data: { ctxs: [['', [{ dayNtlVlm: '100' }]]] },
        }),
      },
    },
  },
}));

describe('token selector image prewarm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setCachedPerpsTokenSelectorInitialList([]);
  });

  it('populates the web list on mount and warms its images once on demand', async () => {
    platformEnv.isWeb = true;
    const { result } = renderHook(usePrewarmPerpsTokenSelectorImages);
    await waitFor(() =>
      expect(getCachedPerpsTokenSelectorInitialList()[0]?.tokenName).toBe(
        'BTC',
      ),
    );
    expect(prewarmPerpsTokenSelectorImages).not.toHaveBeenCalled();

    await Promise.all([result.current(), result.current()]);
    await result.current();
    expect(prewarmPerpsTokenSelectorImages).toHaveBeenCalledTimes(1);
    expect(prewarmPerpsTokenSelectorImages).toHaveBeenCalledWith(
      getCachedPerpsTokenSelectorInitialList(),
    );
  });

  it('still prewarms images on mount outside web', async () => {
    platformEnv.isWeb = false;
    renderHook(usePrewarmPerpsTokenSelectorImages);
    await waitFor(() =>
      expect(prewarmPerpsTokenSelectorImages).toHaveBeenCalledTimes(1),
    );
  });
});
