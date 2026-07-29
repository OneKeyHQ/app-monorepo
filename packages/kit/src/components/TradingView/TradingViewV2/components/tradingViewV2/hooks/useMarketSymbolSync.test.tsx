/** @jest-environment jsdom */

import { renderHook } from '@testing-library/react';

import type { IWebViewRef } from '@onekeyhq/kit/src/components/WebView/types';

import {
  useMarketSymbolSync,
  useMarketTradingViewFrameIdentity,
} from './useMarketSymbolSync';

describe('useMarketTradingViewFrameIdentity', () => {
  it('reloads the warmup frame with the first real market identity', () => {
    const staticTradingViewUrl = 'https://tradingview.onekey.so/?type=market';
    const warmupIdentity = {
      symbol: 'ONEKEY_PREWARM',
      tokenAddress: '',
      networkId: '',
      decimal: 8,
    };
    const realIdentity = {
      symbol: 'ONE',
      tokenAddress: '0x1',
      networkId: 'evm--1',
      decimal: 8,
    };
    const { result, rerender } = renderHook(
      ({
        identity,
        symbolSyncSupport,
      }: {
        identity: typeof warmupIdentity;
        symbolSyncSupport: boolean | undefined;
      }) =>
        useMarketTradingViewFrameIdentity({
          staticTradingViewUrl,
          identity,
          symbolSyncSupport,
        }),
      {
        initialProps: {
          identity: warmupIdentity,
          symbolSyncSupport: undefined,
        },
      },
    );

    expect(result.current.identity).toEqual(warmupIdentity);

    rerender({
      identity: realIdentity,
      symbolSyncSupport: undefined,
    });

    expect(result.current.identity).toEqual(realIdentity);
  });

  it('keeps a ready frame stable when symbol sync is available', () => {
    const staticTradingViewUrl = 'https://tradingview.onekey.so/?type=market';
    const firstIdentity = {
      symbol: 'ONE',
      tokenAddress: '0x1',
      networkId: 'evm--1',
      decimal: 8,
    };
    const nextIdentity = {
      symbol: 'TWO',
      tokenAddress: '0x2',
      networkId: 'evm--1',
      decimal: 8,
    };
    const { result, rerender } = renderHook(
      ({ identity }: { identity: typeof firstIdentity }) =>
        useMarketTradingViewFrameIdentity({
          staticTradingViewUrl,
          identity,
          symbolSyncSupport: true,
        }),
      { initialProps: { identity: firstIdentity } },
    );

    rerender({ identity: nextIdentity });

    expect(result.current.identity).toEqual(firstIdentity);
  });

  it('reloads a pending frame with the latest identity after legacy fallback', () => {
    const staticTradingViewUrl = 'https://tradingview.onekey.so/?type=market';
    const firstIdentity = {
      symbol: 'ONE',
      tokenAddress: '0x1',
      networkId: 'evm--1',
      decimal: 8,
    };
    const nextIdentity = {
      symbol: 'TWO',
      tokenAddress: '0x2',
      networkId: 'evm--1',
      decimal: 8,
    };
    const { result, rerender } = renderHook(
      ({
        identity,
        symbolSyncSupport,
      }: {
        identity: typeof firstIdentity;
        symbolSyncSupport: boolean | undefined;
      }) =>
        useMarketTradingViewFrameIdentity({
          staticTradingViewUrl,
          identity,
          symbolSyncSupport,
        }),
      {
        initialProps: {
          identity: firstIdentity,
          symbolSyncSupport: undefined as boolean | undefined,
        },
      },
    );

    rerender({
      identity: nextIdentity,
      symbolSyncSupport: undefined,
    });
    expect(result.current.identity).toEqual(firstIdentity);

    rerender({
      identity: nextIdentity,
      symbolSyncSupport: false,
    });
    expect(result.current.identity).toEqual(nextIdentity);
  });
});

describe('useMarketSymbolSync', () => {
  const firstIdentity = {
    symbol: 'ONE',
    tokenAddress: '0x1',
    networkId: 'evm--1',
    decimal: 8,
  };
  const secondIdentity = {
    symbol: 'TWO',
    tokenAddress: '0x2',
    networkId: 'evm--1',
    decimal: 8,
  };

  function createWebRef() {
    const sendMessageViaInjectedScript = jest.fn();
    const webRef: { current: IWebViewRef } = {
      current: {
        sendMessageViaInjectedScript,
        reload: jest.fn(),
        loadURL: jest.fn(),
      },
    };
    return { sendMessageViaInjectedScript, webRef };
  }

  it('sends the first identity again after a persistent frame is parked on the second identity', () => {
    const { sendMessageViaInjectedScript, webRef } = createWebRef();
    const { rerender } = renderHook(
      ({
        identity,
        enabled,
      }: {
        identity: typeof firstIdentity;
        enabled: boolean;
      }) =>
        useMarketSymbolSync({
          webRef,
          identity,
          frameIdentity: firstIdentity,
          enabled,
        }),
      {
        initialProps: {
          identity: firstIdentity,
          enabled: true,
        },
      },
    );

    rerender({ identity: secondIdentity, enabled: true });
    rerender({ identity: secondIdentity, enabled: false });
    rerender({ identity: firstIdentity, enabled: true });

    expect(sendMessageViaInjectedScript).toHaveBeenCalledTimes(2);
    expect(sendMessageViaInjectedScript).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        type: 'SYMBOL_CHANGE',
        payload: expect.objectContaining({ symbol: 'TWO' }),
      }),
    );
    expect(sendMessageViaInjectedScript).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        type: 'SYMBOL_CHANGE',
        payload: expect.objectContaining({ symbol: 'ONE' }),
      }),
    );
  });

  it('does not send a duplicate symbol change after the frame reloads with the current identity', () => {
    const { sendMessageViaInjectedScript, webRef } = createWebRef();
    const { rerender } = renderHook(
      ({
        identity,
        frameIdentity,
      }: {
        identity: typeof firstIdentity;
        frameIdentity: typeof firstIdentity;
      }) =>
        useMarketSymbolSync({
          webRef,
          identity,
          frameIdentity,
          enabled: true,
        }),
      {
        initialProps: {
          identity: firstIdentity,
          frameIdentity: firstIdentity,
        },
      },
    );

    rerender({
      identity: secondIdentity,
      frameIdentity: firstIdentity,
    });
    rerender({
      identity: secondIdentity,
      frameIdentity: secondIdentity,
    });

    expect(sendMessageViaInjectedScript).toHaveBeenCalledTimes(1);
    expect(sendMessageViaInjectedScript).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'SYMBOL_CHANGE',
        payload: expect.objectContaining({ symbol: 'TWO' }),
      }),
    );
  });
});
