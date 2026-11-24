/** @jest-environment jsdom */

import { act, renderHook, waitFor } from '@testing-library/react';

import { preloadImages } from '@onekeyhq/components/src/primitives/Image/preload';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
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
jest.mock('@onekeyhq/components/src/primitives/Image/preload', () => ({
  s: (size: number) => size,
  preloadImages: jest.fn(async () => true),
}));
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceHyperliquid: {
      getTradingUniverse: async () => ({
        universesByDex: [[{ name: 'ATOM', assetId: 0 }]],
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
    jest.mocked(preloadImages).mockReset().mockResolvedValue(true);
    setCachedPerpsTokenSelectorInitialList([]);
  });

  it('populates the web list on mount and warms its images once on demand', async () => {
    platformEnv.isWeb = true;
    const { result } = renderHook(usePrewarmPerpsTokenSelectorImages);
    await waitFor(() =>
      expect(getCachedPerpsTokenSelectorInitialList()[0]?.tokenName).toBe(
        'ATOM',
      ),
    );
    expect(preloadImages).not.toHaveBeenCalled();

    await Promise.all([result.current(), result.current()]);
    await result.current();
    expect(preloadImages).toHaveBeenCalledTimes(1);
    expect(preloadImages).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ uri: expect.stringContaining('/ATOM.png') }),
      ]),
      expect.objectContaining({ onSourceError: expect.any(Function) }),
    );
  });

  it('retries an unsuccessful critical image batch and reuses the successful retry', async () => {
    platformEnv.isWeb = true;
    jest.mocked(preloadImages).mockResolvedValueOnce(false);
    const { result } = renderHook(usePrewarmPerpsTokenSelectorImages);
    await result.current();
    await Promise.all([result.current(), result.current()]);
    await result.current();
    expect(preloadImages).toHaveBeenCalledTimes(2);
  });

  it('only retries the failed logo size and schedules the remaining logos once', async () => {
    platformEnv.isWeb = true;
    jest
      .spyOn(backgroundApiProxy.serviceHyperliquid, 'getTradingUniverse')
      .mockResolvedValueOnce({
        universesByDex: [
          ['ATOM', 'ADA', 'DOT'].map((name, assetId) => ({
            name,
            assetId,
            maxLeverage: 10,
            szDecimals: 2,
            marginTableId: 0,
          })),
        ],
        marginTablesMapByDex: [],
      });
    const preload = jest.mocked(preloadImages);
    let offline = true;
    preload.mockImplementation(async (sources, options) => {
      const failed = sources.find(
        (source) =>
          source.uri?.endsWith('/ETH.png') && source.resizeWidth === 24,
      );
      if (offline && failed) {
        options?.onSourceError?.(failed);
        return false;
      }
      return true;
    });
    const { result } = renderHook(usePrewarmPerpsTokenSelectorImages);
    await expect(result.current()).resolves.toBe(0);
    expect(preload).toHaveBeenCalledTimes(2);
    expect(
      preload.mock.calls
        .map(([sources]) => sources.length)
        .toSorted((a, b) => a - b),
    ).toEqual([2, 48]);
    const failedSource = {
      uri: expect.stringMatching(/\/ETH\.png$/),
      resizeWidth: 24,
    };
    await Promise.all([result.current(), result.current()]);
    expect(preload.mock.calls.slice(2).map(([sources]) => sources)).toEqual([
      [failedSource],
    ]);

    offline = false;
    await expect(result.current()).resolves.toBeGreaterThan(0);
    await result.current();
    expect(preload.mock.calls.slice(2).map(([sources]) => sources)).toEqual([
      [failedSource],
      [failedSource],
    ]);
  });

  it('handles a failed hover lookup and retries on the next interaction', async () => {
    platformEnv.isWeb = true;
    const getUniverse = jest
      .spyOn(backgroundApiProxy.serviceHyperliquid, 'getTradingUniverse')
      .mockResolvedValueOnce({ universesByDex: [], marginTablesMapByDex: [] });
    const { result } = renderHook(usePrewarmPerpsTokenSelectorImages);
    await act(async () => {});
    getUniverse.mockRejectedValueOnce(
      new Error('Storage temporarily unavailable'),
    );

    await expect(result.current()).resolves.toBe(0);
    expect(preloadImages).not.toHaveBeenCalled();
    await expect(result.current()).resolves.toBeGreaterThan(0);
    expect(getUniverse).toHaveBeenCalledTimes(3);
    expect(preloadImages).toHaveBeenCalledTimes(1);
  });

  it('retries on open after a non-web mount preload rejects', async () => {
    platformEnv.isWeb = false;
    jest
      .mocked(preloadImages)
      .mockRejectedValueOnce(new Error('Image cache unavailable'));
    const { result } = renderHook(usePrewarmPerpsTokenSelectorImages);
    await waitFor(() => expect(preloadImages).toHaveBeenCalledTimes(1));
    await expect(result.current()).resolves.toBeGreaterThan(0);
    await result.current();
    expect(preloadImages).toHaveBeenCalledTimes(2);
  });

  it('still prewarms images on mount outside web', async () => {
    platformEnv.isWeb = false;
    renderHook(usePrewarmPerpsTokenSelectorImages);
    await waitFor(() => expect(preloadImages).toHaveBeenCalledTimes(1));
  });
});
