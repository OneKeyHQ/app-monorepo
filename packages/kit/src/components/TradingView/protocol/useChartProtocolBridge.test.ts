/** @jest-environment jsdom */

import { act, renderHook } from '@testing-library/react';

import { useChartProtocolBridge } from './useChartProtocolBridge';

import type { IWebViewRef } from '../../WebView/types';

function createRuntimeReadyMessage(seq: number) {
  return {
    protocol: 'onekey-chart',
    version: 1,
    direction: 'page-to-app',
    seq,
    method: 'chart.runtimeReady',
  };
}

describe('useChartProtocolBridge', () => {
  it('tracks each runtime and resets pending requests when the WebView changes', async () => {
    const sendMessageViaInjectedScript = jest.fn();
    const webRef = {
      current: {
        sendMessageViaInjectedScript,
      } as unknown as IWebViewRef,
    };
    const { result, rerender } = renderHook(
      ({ runtimeKey }: { runtimeKey: string }) =>
        useChartProtocolBridge({
          webRef,
          enabled: true,
          runtimeKey,
        }),
      { initialProps: { runtimeKey: 'runtime-a' } },
    );

    act(() => {
      result.current.handleProtocolMessage(createRuntimeReadyMessage(1));
    });
    expect(result.current.isRuntimeReady).toBe(true);
    expect(result.current.runtimeGeneration).toBe(1);

    const pendingRequest = result.current.sendRequest(
      'chart.applyConfig',
      undefined,
      60_000,
    );
    const pendingRequestError = pendingRequest.catch((error: unknown) => error);

    rerender({ runtimeKey: 'runtime-b' });

    expect(result.current.isRuntimeReady).toBe(false);
    await expect(pendingRequestError).resolves.toEqual(
      new Error('Chart protocol runtime changed.'),
    );

    act(() => {
      result.current.handleProtocolMessage(createRuntimeReadyMessage(2));
    });
    expect(result.current.isRuntimeReady).toBe(true);
    expect(result.current.runtimeGeneration).toBe(2);
  });
});
