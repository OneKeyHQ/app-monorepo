/** @jest-environment jsdom */

import { act, renderHook } from '@testing-library/react';

import { EPrimeFeatures } from '@onekeyhq/shared/src/routes/prime';
import { ETranslateEngine } from '@onekeyhq/shared/types/discovery';
import { PRIME_FREE_TRIAL_QUOTA_EXHAUSTED_CODE } from '@onekeyhq/shared/types/prime/primeFreeTrialTypes';

import {
  TRANSLATE_COMMAND_TYPE,
  TRANSLATE_REQUEST_TYPE,
  TRANSLATE_RESPONSE_TYPE,
  notifyTabNavigation,
  tryDispatchTranslateMessage,
} from './translateBridge';
import { useWebViewTranslate } from './useWebViewTranslate';

const mockApiTranslate = jest.fn();
const mockInjectJavaScript = jest.fn();

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
    innerRef: { injectJavaScript: mockInjectJavaScript },
  }),
}));

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isNative: true, isDesktop: false },
}));

jest.mock('@onekeyhq/shared/src/logger/logger', () => {
  const noopLogger = new Proxy(jest.fn(), {
    apply: () => undefined,
    get: () => noopLogger,
  });
  return { defaultLogger: noopLogger };
});

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

async function startSession(onFreeTrialUnavailable: jest.Mock) {
  const { result } = renderHook(() =>
    useWebViewTranslate({
      tabId: TAB_ID,
      engine: ETranslateEngine.standard,
      currentTargetLang: 'zh',
      onFreeTrialUnavailable,
    }),
  );
  act(() => {
    result.current.startTranslate('zh', ETranslateEngine.standard);
  });
  act(() => {
    jest.advanceTimersByTime(100);
  });
  const sessionId = injectedMessages().find((m) => m.command === 'start')
    ?.sessionId as string;
  return { result, sessionId };
}

function request(sessionId: string, id: string, texts: string[]) {
  tryDispatchTranslateMessage(
    TAB_ID,
    JSON.stringify({
      type: TRANSLATE_REQUEST_TYPE,
      id,
      sessionId,
      texts,
      sourceLang: 'auto',
      targetLang: 'zh',
    }),
  );
}

describe('useWebViewTranslate free-trial stop', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
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
});
