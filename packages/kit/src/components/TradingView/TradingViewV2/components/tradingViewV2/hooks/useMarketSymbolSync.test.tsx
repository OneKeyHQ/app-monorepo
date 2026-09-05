/** @jest-environment jsdom */

import { renderHook } from '@testing-library/react';

import type { IWebViewRef } from '@onekeyhq/kit/src/components/WebView/types';

import {
  useMarketSymbolSync,
  useMarketTradingViewFrameIdentity,
} from './useMarketSymbolSync';

describe('useMarketTradingViewFrameIdentity', () => {
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

  it('keeps a ready frame stable when symbol sync is available', () => {
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

  it('reloads the pending frame after legacy capability fallback', () => {
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

    rerender({ identity: nextIdentity, symbolSyncSupport: undefined });
    expect(result.current.identity).toEqual(firstIdentity);

    rerender({ identity: nextIdentity, symbolSyncSupport: false });
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

  it('sends a symbol change without remounting the ready frame', () => {
    const { sendMessageViaInjectedScript, webRef } = createWebRef();
    const { rerender } = renderHook(
      ({ identity }: { identity: typeof firstIdentity }) =>
        useMarketSymbolSync({
          webRef,
          identity,
          frameIdentity: firstIdentity,
          documentGeneration: 0,
          enabled: true,
        }),
      { initialProps: { identity: firstIdentity } },
    );

    rerender({ identity: secondIdentity });

    expect(sendMessageViaInjectedScript).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'SYMBOL_CHANGE',
        payload: expect.objectContaining({ symbol: 'TWO' }),
      }),
    );
  });

  it('sends the current identity again after the document reloads', () => {
    const { sendMessageViaInjectedScript, webRef } = createWebRef();
    const { rerender } = renderHook(
      ({ documentGeneration }: { documentGeneration: number }) =>
        useMarketSymbolSync({
          webRef,
          identity: secondIdentity,
          frameIdentity: firstIdentity,
          documentGeneration,
          enabled: true,
        }),
      { initialProps: { documentGeneration: 0 } },
    );

    rerender({ documentGeneration: 1 });

    expect(sendMessageViaInjectedScript).toHaveBeenCalledTimes(2);
    expect(sendMessageViaInjectedScript).toHaveBeenLastCalledWith(
      expect.objectContaining({
        type: 'SYMBOL_CHANGE',
        payload: expect.objectContaining({ symbol: 'TWO' }),
      }),
    );
  });

  it('cancels a delayed symbol change when the outgoing screen unmounts', () => {
    jest.useFakeTimers();
    const { sendMessageViaInjectedScript, webRef } = createWebRef();
    const { rerender, unmount } = renderHook(
      ({ identity }: { identity: typeof firstIdentity }) =>
        useMarketSymbolSync({
          webRef,
          identity,
          frameIdentity: firstIdentity,
          documentGeneration: 0,
          enabled: true,
          deliveryDelayMs: 150,
        }),
      { initialProps: { identity: firstIdentity } },
    );

    rerender({ identity: secondIdentity });
    unmount();
    jest.advanceTimersByTime(150);

    expect(sendMessageViaInjectedScript).not.toHaveBeenCalled();
    jest.useRealTimers();
  });

  it('delivers a delayed symbol change when the screen remains mounted', () => {
    jest.useFakeTimers();
    const { sendMessageViaInjectedScript, webRef } = createWebRef();
    const { rerender } = renderHook(
      ({ identity }: { identity: typeof firstIdentity }) =>
        useMarketSymbolSync({
          webRef,
          identity,
          frameIdentity: firstIdentity,
          documentGeneration: 0,
          enabled: true,
          deliveryDelayMs: 150,
        }),
      { initialProps: { identity: firstIdentity } },
    );

    rerender({ identity: secondIdentity });
    jest.advanceTimersByTime(149);
    expect(sendMessageViaInjectedScript).not.toHaveBeenCalled();

    jest.advanceTimersByTime(1);
    expect(sendMessageViaInjectedScript).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'SYMBOL_CHANGE',
        payload: expect.objectContaining({ symbol: 'TWO' }),
      }),
    );
    jest.useRealTimers();
  });
});
