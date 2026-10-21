/** @jest-environment jsdom */

import { act, renderHook } from '@testing-library/react';

import { EPrimeFeatures } from '@onekeyhq/shared/src/routes/prime';
import { ETranslateEngine } from '@onekeyhq/shared/types/discovery';
import { PRIME_FREE_TRIAL_QUOTA_EXHAUSTED_CODE } from '@onekeyhq/shared/types/prime/primeFreeTrialTypes';

import {
  TRANSLATE_COMMAND_TYPE,
  TRANSLATE_CONSOLE_PREFIX,
  TRANSLATE_REQUEST_TYPE,
  TRANSLATE_RESPONSE_TYPE,
  notifyTabNavigation,
  notifyTabNavigationEnd,
  tryDispatchTranslateMessage,
} from './translateBridge';
import { useWebViewTranslate } from './useWebViewTranslate';

const mockTrialAttempt = jest.fn();
const mockTrialResult = jest.fn();
const mockApiTranslate = jest.fn();
const mockInjectJavaScript = jest.fn();
const mockAddEventListener = jest.fn();
const mockFreeTrialUsageSuccess = jest.fn();

jest.mock('./translateInject.text-js', () => 'INJECT_SCRIPT', {
  virtual: true,
});

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    servicePrime: {
      apiTranslate: (params: unknown) => mockApiTranslate(params) as unknown,
    },
  },
}));

jest.mock('../../views/Discovery/utils/explorerUtils', () => ({
  getWebviewWrapperRef: () => ({
    innerRef: {
      // Native
      injectJavaScript: mockInjectJavaScript,
      // Desktop (Electron webview)
      executeJavaScript: mockInjectJavaScript,
      addEventListener: mockAddEventListener,
      removeEventListener: jest.fn(),
    },
  }),
}));

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isNative: true, isDesktop: false },
}));

jest.mock('@onekeyhq/shared/src/logger/logger', () => {
  const noopLogger: unknown = new Proxy(jest.fn(), {
    apply: () => undefined,
    get: (_target, key) => {
      if (key === 'primeFreeTrialAttempt') return mockTrialAttempt;
      if (key === 'primeFreeTrialResult') return mockTrialResult;
      if (key === 'primeFreeTrialUsageSuccess')
        return mockFreeTrialUsageSuccess;
      return noopLogger;
    },
  });
  return { defaultLogger: noopLogger };
});

const mockedPlatformEnv = jest.requireMock<{
  default: { isNative: boolean; isDesktop: boolean };
}>('@onekeyhq/shared/src/platformEnv').default;

const TAB_ID = 'tab-1';
const EXHAUSTED = {
  code: PRIME_FREE_TRIAL_QUOTA_EXHAUSTED_CODE,
  data: { featureId: EPrimeFeatures.DAppTranslate, resetAt: 1 },
};

type IInjectedMessage = {
  type: string;
  command?: string;
  sessionId?: string;
  id?: string;
  translations?: Array<string | null>;
};

function injectedMessages(): IInjectedMessage[] {
  return mockInjectJavaScript.mock.calls
    .map(
      ([script]) =>
        /window\.postMessage\((.*?)\);\s*\n/s.exec(String(script))?.[1],
    )
    .filter((json): json is string => Boolean(json))
    .map((json) => JSON.parse(json) as IInjectedMessage);
}

function commands() {
  return injectedMessages()
    .filter((m) => m.type === TRANSLATE_COMMAND_TYPE)
    .map((m) => m.command);
}

function responses() {
  return injectedMessages().filter((m) => m.type === TRANSLATE_RESPONSE_TYPE);
}

async function flush() {
  for (let i = 0; i < 10; i += 1) {
    await Promise.resolve();
  }
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

function startedSessionIds() {
  return injectedMessages()
    .filter((m) => m.command === 'start')
    .map((m) => m.sessionId as string);
}

async function startSession(
  onFreeTrialUnavailable: jest.Mock,
  {
    engine = ETranslateEngine.standard,
    entitlementSource,
    onAITranslateUnavailable,
  }: {
    engine?: ETranslateEngine;
    entitlementSource?: 'prime' | 'freeTrial';
    onAITranslateUnavailable?: jest.Mock;
  } = {},
) {
  const { result, unmount } = renderHook(() =>
    useWebViewTranslate({
      tabId: TAB_ID,
      engine,
      dappUrl: 'https://app.example.com/swap',
      currentTargetLang: 'zh',
      entitlementSource,
      onFreeTrialUnavailable,
      onAITranslateUnavailable,
    }),
  );
  act(() => {
    result.current.startTranslate('zh', engine);
  });
  act(() => {
    jest.advanceTimersByTime(100);
  });
  const sessionId = startedSessionIds()[0];
  return { result, sessionId, unmount };
}

function requestMessage(sessionId: string, id: string, texts: string[]) {
  return JSON.stringify({
    type: TRANSLATE_REQUEST_TYPE,
    id,
    sessionId,
    texts,
    sourceLang: 'auto',
    targetLang: 'zh',
  });
}

function request(sessionId: string, id: string, texts: string[]) {
  tryDispatchTranslateMessage(TAB_ID, requestMessage(sessionId, id, texts));
}

// Desktop: the injected script reports requests through console messages.
function desktopRequest(sessionId: string, id: string, texts: string[]) {
  const listener = mockAddEventListener.mock.calls.findLast(
    ([name]) => name === 'console-message',
  )?.[1] as ((event: { message: string }) => void) | undefined;
  listener?.({
    message: `${TRANSLATE_CONSOLE_PREFIX}${requestMessage(
      sessionId,
      id,
      texts,
    )}`,
  });
}

describe('useWebViewTranslate free-trial stop', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('does not report completion before a billed response, then records actual success once', async () => {
    const { sessionId, unmount } = await startSession(jest.fn(), {
      entitlementSource: 'freeTrial',
    });
    expect(mockTrialAttempt).toHaveBeenCalledTimes(1);
    expect(mockTrialResult).not.toHaveBeenCalled();
    mockApiTranslate.mockResolvedValue({
      translations: ['translated'],
      hasBilledBatch: true,
    });
    await act(async () => {
      request(sessionId, 'tr_analytics', ['private page text']);
      await flush();
    });
    expect(mockTrialResult).toHaveBeenCalledWith(
      expect.objectContaining({ result: 'success', attemptId: sessionId }),
    );
    unmount();
    expect(mockTrialResult).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(mockTrialAttempt.mock.calls)).not.toContain(
      'private page text',
    );
  });

  it.each([90_600, 90_601])(
    'records a server rejection %s once for a non-billed session',
    async (code) => {
      mockApiTranslate.mockResolvedValue({
        translations: ['original'],
        freeTrialError: {
          code,
          data: { featureId: EPrimeFeatures.DAppTranslate },
        },
      });
      const { sessionId, unmount } = await startSession(jest.fn(), {
        entitlementSource: 'freeTrial',
      });
      await act(async () => {
        request(sessionId, 'tr_rejected', ['original']);
        await flush();
      });
      unmount();
      expect(mockTrialResult).toHaveBeenCalledTimes(1);
      expect(mockTrialResult).toHaveBeenCalledWith(
        expect.objectContaining({
          result: code === 90_600 ? 'exhausted' : 'notOpen',
          rejectionSource: 'server',
        }),
      );
    },
  );
  it('records a late billed result after restoring instead of claiming the in-flight request was cancelled', async () => {
    const pending = deferred<unknown>();
    mockApiTranslate.mockReturnValueOnce(pending.promise);
    const { result, sessionId } = await startSession(jest.fn(), {
      entitlementSource: 'freeTrial',
    });
    act(() => {
      request(sessionId, 'tr_cancelled', ['private text']);
      result.current.restoreOriginal();
    });
    await act(async () => {
      pending.resolve({ translations: ['translated'], hasBilledBatch: true });
      await flush();
    });
    expect(mockTrialResult).toHaveBeenCalledTimes(1);
    expect(mockTrialResult).toHaveBeenCalledWith(
      expect.objectContaining({ result: 'success' }),
    );
  });
  it('records original-text fallback as failure rather than successful translation', async () => {
    mockApiTranslate.mockResolvedValue({
      translations: ['original'],
      hasBilledBatch: false,
    });
    const { sessionId } = await startSession(jest.fn(), {
      entitlementSource: 'freeTrial',
    });
    await act(async () => {
      request(sessionId, 'tr_fallback', ['original']);
      await flush();
    });
    expect(mockTrialResult).toHaveBeenCalledWith(
      expect.objectContaining({ result: 'failed' }),
    );
    expect(mockFreeTrialUsageSuccess).not.toHaveBeenCalled();
  });

  it('waits for concurrent requests and preserves a billed result when another request is rejected', async () => {
    const pending = deferred<unknown>();
    mockApiTranslate
      .mockReturnValueOnce(pending.promise)
      .mockResolvedValueOnce({
        translations: ['original'],
        freeTrialError: EXHAUSTED,
      });
    const { sessionId } = await startSession(jest.fn(), {
      entitlementSource: 'freeTrial',
    });
    await act(async () => {
      request(sessionId, 'tr_pending_result', ['a']);
      request(sessionId, 'tr_denied_result', ['b']);
      await flush();
    });
    expect(mockTrialResult).not.toHaveBeenCalled();
    await act(async () => {
      pending.resolve({ translations: ['A'], hasBilledBatch: true });
      await flush();
    });
    expect(mockTrialResult).toHaveBeenCalledTimes(1);
    expect(mockTrialResult).toHaveBeenCalledWith(
      expect.objectContaining({ result: 'success' }),
    );
  });
  it('records a cancelled session before any request without success on opening the translator', async () => {
    const { result } = await startSession(jest.fn(), {
      entitlementSource: 'freeTrial',
    });
    expect(mockTrialResult).not.toHaveBeenCalled();
    act(() => {
      result.current.restoreOriginal();
    });
    expect(mockTrialResult).toHaveBeenCalledWith(
      expect.objectContaining({ result: 'cancelled' }),
    );
    expect(mockApiTranslate).not.toHaveBeenCalled();
  });

  it('corrects an earlier failed request group when the streaming session later delivers billed translations', async () => {
    mockApiTranslate
      .mockResolvedValueOnce({
        translations: ['original'],
        hasBilledBatch: false,
      })
      .mockResolvedValueOnce({
        translations: ['translated'],
        hasBilledBatch: true,
      });
    const { sessionId, unmount } = await startSession(jest.fn(), {
      entitlementSource: 'freeTrial',
    });
    await act(async () => {
      request(sessionId, 'tr_early_failure', ['original']);
      await flush();
    });
    await act(async () => {
      request(sessionId, 'tr_later_success', ['later']);
      await flush();
    });
    expect(mockTrialResult).toHaveBeenCalledTimes(2);
    expect(mockTrialResult).toHaveBeenLastCalledWith(
      expect.objectContaining({
        result: 'success',
        previousResult: 'failed',
        attemptId: sessionId,
      }),
    );
    unmount();
    expect(mockTrialResult).toHaveBeenCalledTimes(2);
  });

  it('writes billed translations back, then stops without restoring', async () => {
    const onFreeTrialUnavailable = jest.fn();
    mockApiTranslate.mockResolvedValueOnce({
      translations: ['A', 'b'],
      freeTrialError: EXHAUSTED,
    });
    const { sessionId } = await startSession(onFreeTrialUnavailable);

    await act(async () => {
      request(sessionId, 'tr_1', ['a', 'b']);
      await flush();
    });

    expect(responses()[0]).toMatchObject({
      id: 'tr_1',
      translations: ['A', 'b'],
    });
    expect(onFreeTrialUnavailable).toHaveBeenCalledTimes(1);
    expect(commands()).toEqual(['start', 'stop']);
    // No whole-request retry: the billed batches are not sent again.
    expect(mockApiTranslate).toHaveBeenCalledTimes(1);
  });

  it('answers requests arriving before stop without billing', async () => {
    const onFreeTrialUnavailable = jest.fn();
    const pending = deferred<unknown>();
    mockApiTranslate
      .mockResolvedValueOnce({ translations: ['A'], freeTrialError: EXHAUSTED })
      .mockReturnValueOnce(pending.promise);
    const { sessionId } = await startSession(onFreeTrialUnavailable);

    await act(async () => {
      request(sessionId, 'tr_1', ['a']);
      request(sessionId, 'tr_pending', ['p']);
      await flush();
      // Stop is still waiting for tr_pending; a new DOM batch arrives.
      request(sessionId, 'tr_2', ['c']);
      await flush();
    });

    expect(mockApiTranslate).toHaveBeenCalledTimes(2);
    expect(responses().find((m) => m.id === 'tr_2')?.translations).toEqual([
      'c',
    ]);
    expect(commands()).toEqual(['start']);
  });

  it('waits for in-flight requests before sending stop', async () => {
    const onFreeTrialUnavailable = jest.fn();
    const second = deferred<unknown>();
    mockApiTranslate
      .mockResolvedValueOnce({ translations: ['A'], freeTrialError: EXHAUSTED })
      .mockReturnValueOnce(second.promise);
    const { sessionId } = await startSession(onFreeTrialUnavailable);

    await act(async () => {
      request(sessionId, 'tr_1', ['a']);
      request(sessionId, 'tr_2', ['b']);
      await flush();
    });
    // tr_2 is still in flight: stop would drop its pending response.
    expect(commands()).toEqual(['start']);

    await act(async () => {
      second.resolve({ translations: ['B'] });
      await flush();
    });
    expect(responses().find((m) => m.id === 'tr_2')?.translations).toEqual([
      'B',
    ]);
    expect(commands()).toEqual(['start', 'stop']);
    expect(onFreeTrialUnavailable).toHaveBeenCalledTimes(1);
  });

  describe('closed tab reopened with the same tabId', () => {
    it('sends no stop when a request runs out after the close', async () => {
      const onFreeTrialUnavailable = jest.fn();
      const pending = deferred<unknown>();
      mockApiTranslate.mockReturnValueOnce(pending.promise);
      const { sessionId, unmount } = await startSession(onFreeTrialUnavailable);

      await act(async () => {
        request(sessionId, 'tr_1', ['a']);
        await flush();
      });
      unmount();
      await act(async () => {
        pending.resolve({ translations: ['A'], freeTrialError: EXHAUSTED });
        await flush();
      });

      expect(commands()).toEqual(['start']);
      expect(onFreeTrialUnavailable).not.toHaveBeenCalled();
    });

    it('sends no stop when the last request returns after the close', async () => {
      const onFreeTrialUnavailable = jest.fn();
      const second = deferred<unknown>();
      mockApiTranslate
        .mockResolvedValueOnce({
          translations: ['A'],
          freeTrialError: EXHAUSTED,
        })
        .mockReturnValueOnce(second.promise);
      const { sessionId, unmount } = await startSession(onFreeTrialUnavailable);

      await act(async () => {
        request(sessionId, 'tr_1', ['a']);
        request(sessionId, 'tr_2', ['b']);
        await flush();
      });
      // The stop waits for tr_2 when the tab closes.
      expect(commands()).toEqual(['start']);
      unmount();
      await act(async () => {
        second.resolve({ translations: ['B'] });
        await flush();
        jest.advanceTimersByTime(20_000);
      });

      expect(commands()).toEqual(['start']);
    });
  });

  it('forces stop after 15s when a request never returns', async () => {
    const onFreeTrialUnavailable = jest.fn();
    mockApiTranslate
      .mockReturnValueOnce(new Promise(() => {}))
      .mockResolvedValueOnce({
        translations: ['A'],
        freeTrialError: EXHAUSTED,
      });
    const { sessionId } = await startSession(onFreeTrialUnavailable);

    await act(async () => {
      request(sessionId, 'tr_hang', ['x']);
      request(sessionId, 'tr_1', ['a']);
      await flush();
    });
    expect(commands()).toEqual(['start']);

    act(() => {
      jest.advanceTimersByTime(15_000);
    });
    expect(commands()).toEqual(['start', 'stop']);
  });

  it('sends a single stop when a request returns after the 15s cap', async () => {
    const onFreeTrialUnavailable = jest.fn();
    const late = deferred<unknown>();
    mockApiTranslate.mockReturnValueOnce(late.promise).mockResolvedValueOnce({
      translations: ['A'],
      freeTrialError: EXHAUSTED,
    });
    const { sessionId } = await startSession(onFreeTrialUnavailable);

    await act(async () => {
      request(sessionId, 'tr_late', ['x']);
      request(sessionId, 'tr_1', ['a']);
      await flush();
    });
    act(() => {
      jest.advanceTimersByTime(15_000);
    });
    await act(async () => {
      late.resolve({ translations: ['X'] });
      await flush();
    });

    expect(commands()).toEqual(['start', 'stop']);
  });

  it('stops through console messages on Desktop', async () => {
    mockedPlatformEnv.isNative = false;
    mockedPlatformEnv.isDesktop = true;
    try {
      const onFreeTrialUnavailable = jest.fn();
      mockApiTranslate.mockResolvedValueOnce({
        translations: ['A', 'b'],
        freeTrialError: EXHAUSTED,
      });
      const { sessionId } = await startSession(onFreeTrialUnavailable);

      await act(async () => {
        desktopRequest(sessionId, 'tr_1', ['a', 'b']);
        await flush();
      });

      expect(responses()[0]).toMatchObject({
        id: 'tr_1',
        translations: ['A', 'b'],
      });
      expect(onFreeTrialUnavailable).toHaveBeenCalledTimes(1);
      expect(commands()).toEqual(['start', 'stop']);
    } finally {
      mockedPlatformEnv.isNative = true;
      mockedPlatformEnv.isDesktop = false;
    }
  });

  it('keeps 90104 on the AI-unavailable path (abort + restore)', async () => {
    const onFreeTrialUnavailable = jest.fn();
    const onAITranslateUnavailable = jest.fn();
    mockApiTranslate.mockRejectedValueOnce({ code: 90_104 });
    const { sessionId } = await startSession(onFreeTrialUnavailable, {
      engine: ETranslateEngine.ai,
      onAITranslateUnavailable,
    });

    await act(async () => {
      request(sessionId, 'tr_1', ['a']);
      await flush();
    });

    expect(responses()[0]).toMatchObject({ id: 'tr_1', abort: true });
    expect(commands()).toEqual(['start', 'restore']);
    expect(onAITranslateUnavailable).toHaveBeenCalledWith({
      code: 90_104,
      targetLang: 'zh',
    });
    expect(onFreeTrialUnavailable).not.toHaveBeenCalled();
  });

  it('logs the free-trial usage once, and only after a billed batch', async () => {
    const onFreeTrialUnavailable = jest.fn();
    mockApiTranslate
      .mockResolvedValueOnce({ translations: ['a'], hasBilledBatch: false })
      .mockResolvedValueOnce({ translations: ['B'], hasBilledBatch: true })
      .mockResolvedValueOnce({ translations: ['C'], hasBilledBatch: true });
    const { sessionId } = await startSession(onFreeTrialUnavailable, {
      entitlementSource: 'freeTrial',
    });

    await act(async () => {
      request(sessionId, 'tr_1', ['a']);
      await flush();
    });
    expect(mockFreeTrialUsageSuccess).not.toHaveBeenCalled();

    await act(async () => {
      request(sessionId, 'tr_2', ['b']);
      request(sessionId, 'tr_3', ['c']);
      await flush();
    });
    expect(mockFreeTrialUsageSuccess).toHaveBeenCalledTimes(1);
  });

  it('keeps the billed answer of the previous session on the same page', async () => {
    const onFreeTrialUnavailable = jest.fn();
    const first = deferred<unknown>();
    mockApiTranslate.mockReturnValueOnce(first.promise).mockResolvedValueOnce({
      translations: ['b'],
      freeTrialError: EXHAUSTED,
    });
    const { result } = renderHook(() =>
      useWebViewTranslate({
        tabId: TAB_ID,
        dappUrl: 'https://app.example.com/swap',
        currentTargetLang: 'zh',
        onFreeTrialUnavailable,
      }),
    );
    // The translation starts while the page is still loading.
    act(() => {
      notifyTabNavigation(TAB_ID);
      result.current.startTranslate('zh');
    });
    act(() => {
      jest.advanceTimersByTime(100);
    });
    const firstSessionId = startedSessionIds()[0];
    await act(async () => {
      request(firstSessionId, 'tr_a', ['a']);
      await flush();
    });

    // The load ends: the same document continues in a new session.
    act(() => {
      notifyTabNavigationEnd(TAB_ID);
    });
    act(() => {
      jest.advanceTimersByTime(100);
    });
    const nextSessionId = startedSessionIds()[1];
    expect(nextSessionId).toBeTruthy();
    expect(nextSessionId).not.toEqual(firstSessionId);
    await act(async () => {
      request(nextSessionId, 'tr_b', ['b']);
      await flush();
    });
    // The new session ran out, but tr_a is still pending in the page.
    expect(onFreeTrialUnavailable).toHaveBeenCalledTimes(1);
    expect(commands()).toEqual(['start', 'start']);

    await act(async () => {
      first.resolve({ translations: ['A'] });
      await flush();
    });
    expect(responses().find((m) => m.id === 'tr_a')?.translations).toEqual([
      'A',
    ]);
    expect(commands()).toEqual(['start', 'start', 'stop']);
  });

  it('does not wait for requests a retranslate restored away', async () => {
    const onFreeTrialUnavailable = jest.fn();
    const old = deferred<unknown>();
    mockApiTranslate.mockReturnValueOnce(old.promise).mockResolvedValueOnce({
      translations: ['b'],
      freeTrialError: EXHAUSTED,
    });
    const { result, sessionId } = await startSession(onFreeTrialUnavailable);
    await act(async () => {
      request(sessionId, 'tr_old', ['a']);
      await flush();
    });

    // Retranslate: the restore drops tr_old's pending response in the page.
    act(() => {
      result.current.startTranslate('zh');
    });
    act(() => {
      jest.advanceTimersByTime(100);
    });
    const nextSessionId = startedSessionIds()[1];
    await act(async () => {
      request(nextSessionId, 'tr_new', ['b']);
      await flush();
    });
    expect(commands()).toEqual(['start', 'restore', 'start', 'stop']);

    await act(async () => {
      old.resolve({ translations: ['A'] });
      await flush();
    });
    expect(commands()).toEqual(['start', 'restore', 'start', 'stop']);
  });

  it('keeps the next page session running after a navigation', async () => {
    const onFreeTrialUnavailable = jest.fn();
    const old = deferred<unknown>();
    mockApiTranslate.mockReturnValueOnce(old.promise).mockResolvedValueOnce({
      translations: ['N'],
      freeTrialError: EXHAUSTED,
    });
    const { sessionId } = await startSession(onFreeTrialUnavailable);

    await act(async () => {
      request(sessionId, 'tr_old', ['o']);
      await flush();
      notifyTabNavigation(TAB_ID);
      notifyTabNavigationEnd(TAB_ID);
    });
    act(() => {
      jest.advanceTimersByTime(100);
    });
    const nextSessionId = startedSessionIds()[1];
    expect(nextSessionId).toBeTruthy();
    expect(nextSessionId).not.toEqual(sessionId);

    await act(async () => {
      // The old page's late error must not stop the new session.
      old.resolve({ translations: ['O'], freeTrialError: EXHAUSTED });
      await flush();
    });
    expect(onFreeTrialUnavailable).not.toHaveBeenCalled();
    expect(commands()).toEqual(['start', 'start']);

    await act(async () => {
      request(nextSessionId, 'tr_new', ['n']);
      await flush();
    });
    expect(onFreeTrialUnavailable).toHaveBeenCalledTimes(1);
    expect(onFreeTrialUnavailable.mock.calls[0][0]).toMatchObject({
      sessionId: nextSessionId,
    });
    expect(commands()).toEqual(['start', 'start', 'stop']);
  });

  it('ignores an old session error after a navigation', async () => {
    const onFreeTrialUnavailable = jest.fn();
    const old = deferred<unknown>();
    mockApiTranslate.mockReturnValueOnce(old.promise);
    const { sessionId } = await startSession(onFreeTrialUnavailable);

    await act(async () => {
      request(sessionId, 'tr_1', ['a']);
      await flush();
      notifyTabNavigation(TAB_ID);
      old.resolve({ translations: ['A'], freeTrialError: EXHAUSTED });
      await flush();
    });

    expect(onFreeTrialUnavailable).not.toHaveBeenCalled();
    expect(commands()).toEqual(['start']);
  });

  it('keeps the session on a load end without a navigation', async () => {
    const onFreeTrialUnavailable = jest.fn();
    mockApiTranslate.mockResolvedValueOnce({
      translations: ['a'],
      freeTrialError: EXHAUSTED,
    });
    const { sessionId } = await startSession(onFreeTrialUnavailable);

    // did-stop-loading / did-fail-load of an iframe: the page did not change,
    // so the page's script keeps this session.
    act(() => {
      notifyTabNavigationEnd(TAB_ID);
      jest.advanceTimersByTime(100);
    });
    expect(startedSessionIds()).toEqual([sessionId]);

    await act(async () => {
      request(sessionId, 'tr_1', ['a']);
      await flush();
    });
    expect(onFreeTrialUnavailable).toHaveBeenCalledTimes(1);
    expect(commands()).toEqual(['start', 'stop']);
  });

  it('ignores load ends after the page loaded untranslated', async () => {
    const onFreeTrialUnavailable = jest.fn();
    mockApiTranslate.mockResolvedValueOnce({
      translations: ['a'],
      freeTrialError: EXHAUSTED,
    });
    const { result } = renderHook(() =>
      useWebViewTranslate({
        tabId: TAB_ID,
        dappUrl: 'https://app.example.com/swap',
        currentTargetLang: 'zh',
        onFreeTrialUnavailable,
      }),
    );
    // The page loads before the user starts translating.
    act(() => {
      notifyTabNavigation(TAB_ID);
      notifyTabNavigationEnd(TAB_ID);
    });
    act(() => {
      result.current.startTranslate('zh');
      jest.advanceTimersByTime(100);
    });
    const [sessionId] = startedSessionIds();

    act(() => {
      notifyTabNavigationEnd(TAB_ID);
      jest.advanceTimersByTime(100);
    });
    expect(startedSessionIds()).toEqual([sessionId]);

    await act(async () => {
      request(sessionId, 'tr_1', ['a']);
      await flush();
    });
    expect(onFreeTrialUnavailable).toHaveBeenCalledTimes(1);
  });

  it('reports once when concurrent requests all run out', async () => {
    const onFreeTrialUnavailable = jest.fn();
    const pending = Array.from({ length: 12 }, () => deferred<unknown>());
    pending.forEach((item) => {
      mockApiTranslate.mockReturnValueOnce(item.promise);
    });
    const { sessionId } = await startSession(onFreeTrialUnavailable);

    await act(async () => {
      pending.forEach((_, i) => request(sessionId, `tr_${i}`, ['t']));
      await flush();
    });
    await act(async () => {
      pending.forEach((item) =>
        item.resolve({ translations: ['t'], freeTrialError: EXHAUSTED }),
      );
      await flush();
    });

    expect(onFreeTrialUnavailable).toHaveBeenCalledTimes(1);
    expect(commands()).toEqual(['start', 'stop']);
    expect(responses()).toHaveLength(12);

    // Content showing up after the pause is answered without a request.
    await act(async () => {
      request(sessionId, 'tr_late', ['late']);
      await flush();
    });
    expect(mockApiTranslate).toHaveBeenCalledTimes(12);
    expect(onFreeTrialUnavailable).toHaveBeenCalledTimes(1);
  });
});
