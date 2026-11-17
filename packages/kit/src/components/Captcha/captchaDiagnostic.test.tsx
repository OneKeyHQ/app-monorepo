/** @jest-environment jsdom */

import type { PropsWithChildren } from 'react';

import { act, renderHook } from '@testing-library/react';
import { IntlProvider } from 'react-intl';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import enCatalog from '@onekeyhq/shared/src/locale/json/en_US.json';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import type { ICaptchaDiagnostic } from '@onekeyhq/shared/src/utils/captchaDiagnostics';

import { createCaptchaDiagnostic } from './captchaDiagnostic';
import { useEmailOtpCaptcha } from './useEmailOtpCaptcha';

import type { ICaptchaFrameResult } from './captchaMessage';

const enMessages: Record<string, string> = enCatalog;

function Wrapper({ children }: PropsWithChildren) {
  return (
    <IntlProvider locale="en-US" messages={enMessages}>
      <>{children}</>
    </IntlProvider>
  );
}

const config = {
  enabled: true,
  pageUrl: 'https://login.onekeytest.com/captcha?secret=private-query',
};
const scene = defaultLogger.prime.subscription;
const localRequestId = '6f0d4f7e-cc60-4ca7-aed2-20ed64c0a2dc';
function spyOnEmit() {
  return jest.spyOn(scene, '_emitLog').mockImplementation(() => undefined);
}
let emit: ReturnType<typeof spyOnEmit>;
const records = () =>
  emit.mock.calls
    .filter(([name]) => name === 'emailOtpCaptchaDiagnostic')
    .map(([, args]) => args[0] as ICaptchaDiagnostic);

function start() {
  const hook = renderHook(
    ({ email }) => useEmailOtpCaptcha({ config, email }),
    {
      initialProps: { email: 'private-email@example.com' },
      wrapper: Wrapper,
    },
  );
  let completion!: Promise<unknown>;
  act(() => {
    completion = hook.result.current
      .takeCaptchaToken()
      .catch((error: unknown) => error);
  });
  const requestId = hook.result.current.challenge?.requestId || '';
  const send = (
    status: ICaptchaFrameResult['status'],
    fields: Partial<ICaptchaFrameResult> = {},
  ) => {
    act(() =>
      hook.result.current.onResult({
        type: 'onekey-test-captcha',
        requestId,
        status,
        ...fields,
      }),
    );
  };
  return { ...hook, completion, requestId, send };
}

beforeEach(() => {
  jest.useFakeTimers();
  emit = spyOnEmit();
});
afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});

test('records the 120 second app watchdog without inventing a provider code or ready', async () => {
  const { completion } = start();
  await act(async () => {
    jest.advanceTimersByTime(120_000);
    await completion;
  });
  expect(records()).toEqual([
    expect.objectContaining({
      status: 'start',
      source: 'app_request',
      elapsedMs: 0,
    }),
    expect.objectContaining({
      status: 'timeout',
      source: 'app_watchdog',
      code: null,
      elapsedMs: 120_000,
      readyReceived: false,
      readyElapsedMs: null,
      terminal: true,
    }),
  ]);
});

test.each([undefined, '110620'])(
  'records provider timeout after ready with code %s',
  async (code) => {
    const { send, completion } = start();
    act(() => jest.advanceTimersByTime(500));
    send('ready');
    act(() => jest.advanceTimersByTime(180_000));
    send('timeout', { code });
    await act(async () => {
      await completion;
    });
    expect(records().at(-1)).toMatchObject({
      status: 'timeout',
      source: 'provider_message',
      code: code ?? null,
      elapsedMs: 180_500,
      readyReceived: true,
      readyElapsedMs: 500,
      terminal: true,
    });
    expect(records().filter((r) => r.source === 'app_watchdog')).toHaveLength(
      0,
    );
  },
);

test.each([
  '300010',
  '600010',
  '110600',
  '200500',
  undefined,
  'invalid-secret',
  '110620\n',
])(
  'records retryable error %s without releasing the OTP wait',
  async (code) => {
    const { send, completion, result } = start();
    send('error', { code });
    send('expired');
    act(() => jest.advanceTimersByTime(180_000));
    expect(result.current.isWaiting).toBe(true);
    expect(records().map((r) => r.status)).toEqual([
      'start',
      'error',
      'expired',
    ]);
    expect(records()[1].code).toBe(code?.length === 6 ? code : null);
    send('success', { token: 'private-captcha-token' });
    await act(async () => {
      expect(await completion).toBe('private-captcha-token');
    });
    expect(records().at(-1)).toMatchObject({
      status: 'success',
      terminal: true,
      readyReceived: false,
    });
  },
);

test.each([
  { status: 'error', code: '400021', source: 'provider_message' },
  { status: 'load-error', code: '110100', source: 'provider_message' },
  { status: 'load-error', source: 'host_load_error' },
  { status: 'load-error', source: 'host_watchdog' },
] as const)('preserves terminal $source / $status / $code', async (message) => {
  const { send, completion, result } = start();
  send(message.status, message);
  await act(async () => {
    await completion;
  });
  expect(result.current.isWaiting).toBe(false);
  expect(records().at(-1)).toMatchObject({
    ...message,
    code: 'code' in message ? message.code : null,
    terminal: true,
  });
});

test('bounds callback floods, reserves ready and terminal, and summarizes suppression', async () => {
  const { send, completion } = start();
  for (let index = 0; index < 100; index += 1)
    send('error', { code: String(300_000 + index) });
  for (let index = 0; index < 100; index += 1) send('ready');
  send('success', { token: 'private-captcha-token' });
  await act(async () => {
    await completion;
  });
  expect(records()).toHaveLength(11);
  expect(records().filter((r) => r.status === 'ready')).toHaveLength(1);
  expect(records().at(-1)).toMatchObject({
    sequence: 11,
    suppressedEvents: 191,
    terminal: true,
  });
});

test('enforces a hard per-challenge budget under repeated starts, unique codes and late callbacks', () => {
  const record = createCaptchaDiagnostic(localRequestId);
  const add = jest.spyOn(Set.prototype, 'add');
  record('start', 'app_request');
  for (let index = 0; index < 10_000; index += 1) {
    record('start', 'app_request');
    record('error', 'provider_message', String(300_000 + index));
    record('ready', 'provider_message');
  }
  // Inspect the actual collection before Jest assertions add their own Sets.
  const retainedSets = add.mock.contexts.map((value) => value as Set<unknown>);
  add.mockRestore();
  record('timeout', 'provider_message', '110620', true);
  for (let index = 0; index < 1000; index += 1) {
    record('success', 'provider_message', undefined, true);
    record('start', 'app_request');
    record('error', 'provider_message', '600010');
  }
  expect(retainedSets).toHaveLength(8);
  expect(
    retainedSets.every(
      (value) => value === retainedSets[0] && value.size === 8,
    ),
  ).toBe(true);
  expect(records()).toHaveLength(11);
  expect(records().map((value) => value.sequence)).toEqual(
    Array.from({ length: 11 }, (_, index) => index + 1),
  );
  expect(records().filter((value) => value.status === 'start')).toHaveLength(1);
  expect(records().filter((value) => value.status === 'ready')).toHaveLength(1);
  expect(records().at(-1)).toMatchObject({
    status: 'timeout',
    code: '110620',
    terminal: true,
    suppressedEvents: 29_991,
  });
});

test('consumes the hard budget before a failing or reentrant logger call and gives new requests their own budget', () => {
  const record = createCaptchaDiagnostic(localRequestId);
  const sink = jest
    .spyOn(scene, 'emailOtpCaptchaDiagnostic')
    .mockImplementation(() => {
      record('start', 'app_request');
      record('error', 'provider_message', '600000');
      throw new OneKeyLocalError('private-logger-secret');
    });
  const consoleError = jest
    .spyOn(console, 'error')
    .mockImplementation(() => {});
  record('start', 'app_request');
  for (let index = 0; index < 1000; index += 1)
    record('error', 'provider_message', String(300_000 + index));
  record('ready', 'provider_message');
  record('cancel', 'app_cancel', undefined, true);
  record('timeout', 'app_watchdog', undefined, true);
  expect(sink).toHaveBeenCalledTimes(11);
  expect(sink.mock.calls.at(-1)?.[0]).toMatchObject({
    terminal: true,
    sequence: 11,
    status: 'cancel',
  });
  const next = createCaptchaDiagnostic('d12b204d-aaf4-4b35-82ec-adab23612345');
  next('start', 'app_request');
  next('ready', 'provider_message');
  next('success', 'provider_message', undefined, true);
  expect(sink).toHaveBeenCalledTimes(14);
  expect(sink.mock.calls.slice(-3).map(([value]) => value.sequence)).toEqual([
    1, 2, 3,
  ]);
  expect(consoleError).not.toHaveBeenCalled();
  expect(JSON.stringify(sink.mock.calls)).not.toContain(
    'private-logger-secret',
  );
});

test.each(['success', 'cancel', 'unmount', 'watchdog'] as const)(
  'logger exceptions do not change authentication settlement: %s',
  async (action) => {
    const sink = jest
      .spyOn(scene, 'emailOtpCaptchaDiagnostic')
      .mockImplementation(() => {
        throw new OneKeyLocalError('private-logger-secret');
      });
    const consoleError = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    const { send, completion, result, unmount } = start();
    expect(result.current.isWaiting).toBe(true);
    if (action === 'success')
      send('success', { token: 'private-captcha-token' });
    if (action === 'cancel') act(() => result.current.cancelCaptcha());
    if (action === 'unmount') act(() => unmount());
    if (action === 'watchdog') act(() => jest.advanceTimersByTime(120_000));
    await act(async () => {
      const settled = await completion;
      if (action === 'success') expect(settled).toBe('private-captcha-token');
      else
        expect(settled).toMatchObject({
          message:
            action === 'watchdog'
              ? 'CAPTCHA timed out. Please retry.'
              : 'CAPTCHA cancelled.',
        });
    });
    send('timeout');
    expect(sink).toHaveBeenCalledTimes(2);
    expect(consoleError).not.toHaveBeenCalled();
    if (action !== 'unmount') {
      let next!: Promise<unknown>;
      act(() => {
        next = result.current
          .takeCaptchaToken()
          .catch((error: unknown) => error);
      });
      const requestId = result.current.challenge?.requestId || '';
      await act(async () => {
        result.current.onResult({
          type: 'onekey-test-captcha',
          requestId,
          status: 'success',
          token: 'next-token',
        });
        expect(await next).toBe('next-token');
      });
      expect(sink).toHaveBeenCalledTimes(4);
    }
  },
);

test('normal successful requests still emit exactly start, ready and success', async () => {
  const { send, completion } = start();
  send('ready');
  send('success', { token: 'private-captcha-token' });
  await act(async () => {
    await completion;
  });
  expect(records().map((value) => value.status)).toEqual([
    'start',
    'ready',
    'success',
  ]);
});

test('monotonic integer elapsed time ignores forward and backward wall-clock jumps', () => {
  let now = 100.25;
  jest.spyOn(performance, 'now').mockImplementation(() => now);
  const record = createCaptchaDiagnostic(localRequestId);
  record('start', 'app_request');
  now = 112.9;
  record('ready', 'provider_message');
  jest.setSystemTime(Date.now() + 3_600_000);
  now = 150.9;
  record('error', 'provider_message', '300010');
  jest.setSystemTime(Date.now() - 7_200_000);
  now = 160.9;
  record('success', 'provider_message', undefined, true);
  expect(records().map((value) => value.elapsedMs)).toEqual([0, 12, 50, 60]);
  expect(records().at(-1)?.readyElapsedMs).toBe(12);
});

test.each([NaN, Infinity, -Infinity, -1, 'throw'] as const)(
  'a faulty monotonic clock retains timing and later recovers from the same origin: %s',
  (fault) => {
    let now: number | 'throw' = 100;
    jest.spyOn(performance, 'now').mockImplementation(() => {
      if (now === 'throw') throw new OneKeyLocalError('private-clock-secret');
      return now;
    });
    const record = createCaptchaDiagnostic(localRequestId);
    record('start', 'app_request');
    now = 125;
    record('ready', 'provider_message');
    now = fault;
    jest.setSystemTime(Date.now() + 3_600_000);
    record('error', 'provider_message', '300010');
    now = 150;
    record('timeout', 'provider_message', '110620', true);
    expect(records().map((value) => value.elapsedMs)).toEqual([0, 25, 25, 50]);
    expect(records().at(-1)).toMatchObject({
      terminal: true,
      readyElapsedMs: 25,
    });
  },
);

test('a clock unavailable at creation uses a fixed wall-clock fallback and bounds its faults', () => {
  const clock = jest.spyOn(performance, 'now').mockReturnValue(NaN);
  const record = createCaptchaDiagnostic(localRequestId);
  record('start', 'app_request');
  act(() => jest.advanceTimersByTime(500));
  record('ready', 'provider_message');
  clock.mockReturnValue(9_000_000);
  const wall = jest.spyOn(Date, 'now').mockReturnValue(NaN);
  record('expired', 'provider_message');
  wall.mockImplementation(() => {
    throw new OneKeyLocalError('private-clock-secret');
  });
  record('error', 'provider_message', '300010');
  wall.mockReturnValue(Number.MAX_SAFE_INTEGER);
  record('timeout', 'app_watchdog', undefined, true);
  expect(records().map((value) => value.elapsedMs)).toEqual([
    0, 500, 500, 500, 2_147_483_647,
  ]);
  expect(records().at(-1)).toMatchObject({
    terminal: true,
    readyElapsedMs: 500,
  });
});

test('deduplicates alternating repeated callbacks and ignores stale/settled requests', async () => {
  const { send, completion, requestId } = start();
  for (let index = 0; index < 10; index += 1) {
    send('error', { code: '300010' });
    send('expired');
  }
  send('timeout', { requestId: 'stale-request' });
  send('success', { token: 'private-captcha-token' });
  send('timeout');
  await act(async () => {
    await completion;
  });
  expect(records().map((r) => r.status)).toEqual([
    'start',
    'error',
    'expired',
    'success',
  ]);
  expect(records().every((r) => r.requestId === requestId)).toBe(true);
  expect(records().at(-1)?.suppressedEvents).toBe(18);
});

test('cancel, configuration cleanup, and a new attempt keep separate request IDs', async () => {
  const { send, result, rerender, unmount, completion, requestId } = start();
  act(() => result.current.cancelCaptcha());
  await act(async () => {
    await completion;
  });
  expect(records().at(-1)).toMatchObject({
    status: 'cancel',
    source: 'app_cancel',
    requestId,
  });
  let second!: Promise<unknown>;
  act(() => {
    second = result.current.takeCaptchaToken().catch((error: unknown) => error);
  });
  const secondId = result.current.challenge?.requestId;
  expect(secondId).not.toBe(requestId);
  send('timeout');
  act(() => rerender({ email: 'different-private-email@example.com' }));
  await act(async () => {
    await second;
  });
  expect(records().at(-1)).toMatchObject({
    status: 'cancel',
    source: 'app_cleanup',
    requestId: secondId,
  });
  let third!: Promise<unknown>;
  act(() => {
    third = result.current.takeCaptchaToken().catch((error: unknown) => error);
  });
  const thirdId = result.current.challenge?.requestId;
  act(() => unmount());
  await act(async () => {
    await third;
    jest.advanceTimersByTime(180_000);
  });
  expect(records().at(-1)).toMatchObject({
    status: 'cancel',
    source: 'app_cleanup',
    requestId: thirdId,
  });
  expect(records()).toHaveLength(6);
});

test('concurrent calls do not create a second diagnostic or cancel the active attempt', async () => {
  const { result, send, completion, requestId } = start();
  await expect(result.current.takeCaptchaToken()).rejects.toThrow(
    'in progress',
  );
  expect(records()).toHaveLength(1);
  send('success', { token: 'private-captcha-token' });
  await act(async () => {
    await completion;
  });
  expect(records().every((r) => r.requestId === requestId)).toBe(true);
});

test('clock rollback after ready preserves terminal timing and logging', async () => {
  const { send, completion } = start();
  const startedAt = Date.now();
  act(() => jest.advanceTimersByTime(500));
  send('ready');
  jest.setSystemTime(startedAt - 1000);
  send('timeout', { code: '110620' });
  await act(async () => {
    await completion;
  });
  expect(records().at(-1)).toMatchObject({
    status: 'timeout',
    elapsedMs: 500,
    readyElapsedMs: 500,
    terminal: true,
  });
});

test('logger output is a local-only scalar whitelist with no bridge secrets', async () => {
  const { send, completion } = start();
  const injected = {
    code: '600010',
    token: 'private-captcha-token',
    email: 'private-email@example.com',
    secret: 'private-secret',
    message: 'Bearer private-refresh-token',
    url: config.pageUrl,
    otp: 'private-otp',
    userAgent: 'private-user-agent',
  };
  send('error', injected);
  send('success', { ...injected, code: undefined });
  await act(async () => {
    await completion;
  });
  const output = JSON.stringify(emit.mock.calls);
  expect(output).not.toMatch(
    /private-|Bearer|userAgent|email"|token"|secret"|otp"|url"/,
  );
  expect(records()[1].code).toBe('600010');
  for (const [, , metadata] of emit.mock.calls)
    expect(metadata).toEqual([{ type: 'local', level: 'info' }]);
});
