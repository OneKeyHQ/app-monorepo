import type { RefObject } from 'react';

import type { IWebViewRef } from '@onekeyhq/kit/src/components/WebView/types';

import { captureTradingViewRequestTarget } from './tradingViewRequestTarget';

function buildTarget() {
  const sendMessageViaInjectedScript = jest.fn();
  const firstWebView = {
    loadURL: jest.fn(),
    reload: jest.fn(),
    sendMessageViaInjectedScript,
  } as IWebViewRef;
  const webRef = {
    current: firstWebView,
  } as RefObject<IWebViewRef | null>;
  const webViewLoadGeneration = { current: 1 };
  let isRequestCurrent = true;
  const requestTarget = captureTradingViewRequestTarget({
    webRef,
    webViewLoadGeneration,
    isRequestCurrent: () => isRequestCurrent,
  });

  return {
    firstWebView,
    requestTarget,
    sendMessageViaInjectedScript,
    setIsRequestCurrent: (value: boolean) => {
      isRequestCurrent = value;
    },
    webRef,
    webViewLoadGeneration,
  };
}

describe('captureTradingViewRequestTarget', () => {
  it('sends only while the original WebView document and identity are current', () => {
    const { requestTarget, sendMessageViaInjectedScript } = buildTarget();

    expect(requestTarget.sendMessage({ type: 'response' })).toBe(true);
    expect(sendMessageViaInjectedScript).toHaveBeenCalledWith({
      type: 'response',
    });
  });

  it('drops a response after the document reloads', () => {
    const {
      requestTarget,
      sendMessageViaInjectedScript,
      webViewLoadGeneration,
    } = buildTarget();
    webViewLoadGeneration.current += 1;

    expect(requestTarget.sendMessage({ type: 'stale' })).toBe(false);
    expect(sendMessageViaInjectedScript).not.toHaveBeenCalled();
  });

  it('keeps sending when React refreshes the wrapper for the same document', () => {
    const { requestTarget, sendMessageViaInjectedScript, webRef } =
      buildTarget();
    const currentDocumentSend = jest.fn();
    webRef.current = {
      loadURL: jest.fn(),
      reload: jest.fn(),
      sendMessageViaInjectedScript: currentDocumentSend,
    };

    expect(requestTarget.sendMessage({ type: 'response' })).toBe(true);
    expect(currentDocumentSend).toHaveBeenCalledWith({ type: 'response' });
    expect(sendMessageViaInjectedScript).not.toHaveBeenCalled();
  });

  it('drops a response after the request identity changes', () => {
    const { requestTarget, sendMessageViaInjectedScript, setIsRequestCurrent } =
      buildTarget();
    setIsRequestCurrent(false);

    expect(requestTarget.sendMessage({ type: 'stale-identity' })).toBe(false);
    expect(sendMessageViaInjectedScript).not.toHaveBeenCalled();
  });

  it('falls back to wrapper identity without a document generation', () => {
    const sendMessageViaInjectedScript = jest.fn();
    const webRef = {
      current: {
        loadURL: jest.fn(),
        reload: jest.fn(),
        sendMessageViaInjectedScript,
      } as IWebViewRef,
    } as RefObject<IWebViewRef | null>;
    const requestTarget = captureTradingViewRequestTarget({ webRef });

    webRef.current = {
      loadURL: jest.fn(),
      reload: jest.fn(),
      sendMessageViaInjectedScript: jest.fn(),
    };

    expect(requestTarget.sendMessage({ type: 'stale-webview' })).toBe(false);
    expect(sendMessageViaInjectedScript).not.toHaveBeenCalled();
  });
});
