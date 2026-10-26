/** @jest-environment jsdom */

import type { PropsWithChildren } from 'react';

import { act, renderHook } from '@testing-library/react';
import { IntlProvider } from 'react-intl';

import enCatalog from '@onekeyhq/shared/src/locale/json/en_US.json';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import type { ICaptchaDiagnostic } from '@onekeyhq/shared/src/utils/captchaDiagnostics';

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
