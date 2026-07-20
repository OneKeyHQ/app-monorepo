import type { IMarketTokenKLineResponse } from '@onekeyhq/shared/types/marketV2';

import {
  VOLUME_VISIBILITY_UPDATE,
  getVolumeHiddenState,
  sendVolumeVisibilityUpdate,
} from './volumeVisibilityHandler';

import type { IMessageHandlerContext } from './types';

function buildKLineData(volumes: number[]): IMarketTokenKLineResponse {
  return {
    points: volumes.map((volume, index) => ({
      o: index,
      h: index,
      l: index,
      c: index,
      v: volume,
      t: index,
    })),
    total: volumes.length,
  };
}

describe('volumeVisibilityHandler', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns undefined for empty kline data', () => {
    expect(getVolumeHiddenState(buildKLineData([]))).toBeUndefined();
  });

  it('hides volume when all kline points have zero volume', () => {
    expect(getVolumeHiddenState(buildKLineData([0, 0, 0]))).toBe(true);
  });

  it('keeps volume visible when any kline point has positive volume', () => {
    expect(getVolumeHiddenState(buildKLineData([0, 1, 0]))).toBe(false);
  });

  it('sends volume visibility updates through the WebView bridge', () => {
    jest.spyOn(Date, 'now').mockReturnValue(1000);
    const sendMessageViaInjectedScript = jest.fn();
    const webRef = {
      current: {
        sendMessageViaInjectedScript,
      },
    } as unknown as IMessageHandlerContext['webRef'];

    sendVolumeVisibilityUpdate({
      kLineData: buildKLineData([0, 0]),
      source: 'history',
      symbol: 'WBTC',
      webRef,
    });

    expect(sendMessageViaInjectedScript).toHaveBeenCalledWith({
      type: VOLUME_VISIBILITY_UPDATE,
      payload: {
        hidden: true,
        source: 'history',
        symbol: 'WBTC',
        timestamp: 1000,
      },
    });
  });

  it('does not hide volume from realtime zero-volume updates', () => {
    const sendMessageViaInjectedScript = jest.fn();
    const webRef = {
      current: {
        sendMessageViaInjectedScript,
      },
    } as unknown as IMessageHandlerContext['webRef'];

    sendVolumeVisibilityUpdate({
      allowHide: false,
      kLineData: buildKLineData([0]),
      source: 'realtime',
      symbol: 'WBTC',
      webRef,
    });

    expect(sendMessageViaInjectedScript).not.toHaveBeenCalled();
  });
});
