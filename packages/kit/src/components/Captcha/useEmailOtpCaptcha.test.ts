/** @jest-environment jsdom */

import { act, renderHook } from '@testing-library/react';

import { useEmailOtpCaptcha } from './useEmailOtpCaptcha';

const config = {
  enabled: true,
  pageUrl: 'https://captcha.example.com/verify',
};

describe('Email OTP CAPTCHA lifecycle', () => {
  afterEach(() => jest.useRealTimers());

  test('disabled CAPTCHA returns no token without starting a challenge', async () => {
    const { result } = renderHook(() =>
      useEmailOtpCaptcha({
        config: { ...config, enabled: false },
        email: 'a@example.com',
      }),
    );
    await expect(result.current.takeCaptchaToken()).resolves.toBeUndefined();
    expect(result.current.challenge).toBeUndefined();
  });

  test('a prepared token is consumed once and a resend waits for a new challenge', async () => {
    const initialToken = {
      value: 'prepared-token',
      expiresAt: Date.now() + 60_000,
    };
    const { result } = renderHook(() =>
      useEmailOtpCaptcha({
        config,
        email: 'a@example.com',
        initialToken,
      }),
    );
    await expect(result.current.takeCaptchaToken()).resolves.toBe(
      'prepared-token',
    );
    expect(result.current.challenge).toBeUndefined();
    let request!: Promise<string | undefined>;
    act(() => {
      request = result.current.takeCaptchaToken();
    });
    const requestId = result.current.challenge?.requestId;
    expect(requestId).toBeTruthy();
    await expect(result.current.takeCaptchaToken()).rejects.toThrow(
      'in progress',
    );
    const resolved = jest.fn();
    const completion = request.then(resolved);
    act(() =>
      result.current.onResult({
        type: 'onekey-test-captcha',
        requestId: 'stale-id',
        status: 'success',
        token: 'stale-token',
      }),
    );
    expect(resolved).not.toHaveBeenCalled();
    await act(async () => {
      result.current.onResult({
        type: 'onekey-test-captcha',
        requestId: requestId || '',
        status: 'success',
        token: 'fresh-token',
      });
      await completion;
    });
    expect(resolved).toHaveBeenCalledWith('fresh-token');
    expect(result.current.challenge?.requestId).toBe(requestId);
  });

  test.each(['error', 'expired', 'ready'] as const)(
    'provider %s keeps waiting across the old deadline for a retry success',
    async (status) => {
      jest.useFakeTimers();
      const { result } = renderHook(() =>
        useEmailOtpCaptcha({ config, email: 'a@example.com' }),
      );
      let request!: Promise<string | undefined>;
      act(() => {
        request = result.current.takeCaptchaToken();
      });
      const firstId = result.current.challenge?.requestId;
      expect(result.current.isWaiting).toBe(true);
      const resolved = jest.fn();
      const rejected = jest.fn();
      const completion = request.then(resolved, rejected);
      await act(async () => {
        result.current.onResult({
          type: 'onekey-test-captcha',
          requestId: firstId || '',
          status,
        });
        jest.advanceTimersByTime(180_000);
      });
      expect(resolved).not.toHaveBeenCalled();
      expect(rejected).not.toHaveBeenCalled();
      expect(result.current.isWaiting).toBe(true);
      expect(result.current.challenge?.requestId).toBe(firstId);
      await act(async () => {
        result.current.onResult({
          type: 'onekey-test-captcha',
          requestId: result.current.challenge?.requestId || '',
          status: 'success',
          token: 'retry-token',
        });
        await completion;
      });
      expect(resolved).toHaveBeenCalledWith('retry-token');
      expect(result.current.isWaiting).toBe(false);
    },
  );

  test('configuration changes cancel pending verification and reject stale callbacks', async () => {
    const { result, rerender } = renderHook(
      ({ revision }) =>
        useEmailOtpCaptcha({ config, email: 'a@example.com', revision }),
      { initialProps: { revision: 0 } },
    );
    let request!: Promise<string | undefined>;
    act(() => {
      request = result.current.takeCaptchaToken();
    });
    const requestId = result.current.challenge?.requestId || '';
    const rejection = request.catch((error: unknown) => error);
    await act(async () => {
      rerender({ revision: 1 });
    });
    expect(await rejection).toMatchObject({
      message: expect.stringContaining('CAPTCHA cancelled'),
    });
    act(() =>
      result.current.onResult({
        type: 'onekey-test-captcha',
        requestId,
        status: 'success',
        token: 'stale-token',
      }),
    );
    expect(result.current.challenge).toBeUndefined();
  });

  test.each(['success', 'error'] as const)(
    'disabling CAPTCHA clears a retained %s result',
    async (status) => {
      const { result, rerender } = renderHook(
        ({ enabled }) =>
          useEmailOtpCaptcha({
            config: { ...config, enabled },
            email: 'a@example.com',
          }),
        { initialProps: { enabled: true } },
      );
      let request!: Promise<string | undefined>;
      act(() => {
        request = result.current.takeCaptchaToken();
      });
      const challenge = result.current.challenge;
      const completion = request.catch((error: unknown) => error);
      await act(async () => {
        result.current.onResult({
          type: 'onekey-test-captcha',
          requestId: challenge?.requestId || '',
          status,
          ...(status === 'success' ? { token: 'fresh-token' } : {}),
        });
        if (status === 'success') await completion;
      });
      expect(result.current.challenge).toBe(challenge);
      rerender({ enabled: false });
      await completion;
      expect(result.current.challenge).toBeUndefined();
      await expect(result.current.takeCaptchaToken()).resolves.toBeUndefined();
    },
  );

  test('closing the dialog cancels pending verification', async () => {
    const { result, unmount } = renderHook(() =>
      useEmailOtpCaptcha({ config, email: 'a@example.com' }),
    );
    let request!: Promise<string | undefined>;
    act(() => {
      request = result.current.takeCaptchaToken();
    });
    const rejection = request.catch((error: unknown) => error);
    unmount();
    expect(await rejection).toMatchObject({
      message: expect.stringContaining('CAPTCHA cancelled'),
    });
  });

  test('leaving an embedded step cancels and returning starts a fresh challenge', async () => {
    const { result, rerender } = renderHook(
      ({ active }) =>
        useEmailOtpCaptcha({ config, email: 'a@example.com', active }),
      { initialProps: { active: true } },
    );
    let request!: Promise<string | undefined>;
    act(() => {
      request = result.current.takeCaptchaToken();
    });
    const oldId = result.current.challenge?.requestId || '';
    const rejection = request.catch((error: unknown) => error);
    rerender({ active: false });
    expect(await rejection).toMatchObject({ message: 'CAPTCHA cancelled.' });
    expect(result.current.isWaiting).toBe(false);
    expect(result.current.challenge).toBeUndefined();
    await expect(result.current.takeCaptchaToken()).rejects.toThrow(
      'cancelled',
    );
    rerender({ active: true });
    act(() => {
      request = result.current.takeCaptchaToken();
    });
    const resolved = jest.fn();
    const completion = request.then(resolved);
    await act(async () => {
      result.current.onResult({
        type: 'onekey-test-captcha',
        requestId: oldId,
        status: 'success',
        token: 'stale',
      });
    });
    expect(resolved).not.toHaveBeenCalled();
    await act(async () => {
      result.current.onResult({
        type: 'onekey-test-captcha',
        requestId: result.current.challenge?.requestId || '',
        status: 'success',
        token: 'fresh',
      });
      await completion;
    });
    expect(resolved).toHaveBeenCalledWith('fresh');
  });

  test('cancelling in the same turn as success prevents consuming the token', async () => {
    const { result } = renderHook(() =>
      useEmailOtpCaptcha({ config, email: 'a@example.com' }),
    );
    let request!: Promise<string | undefined>;
    act(() => {
      request = result.current.takeCaptchaToken();
    });
    const rejection = request.catch((error: unknown) => error);
    act(() => {
      result.current.onResult({
        type: 'onekey-test-captcha',
        requestId: result.current.challenge?.requestId || '',
        status: 'success',
        token: 'fresh',
      });
      result.current.cancelCaptcha();
    });
    expect(await rejection).toMatchObject({ message: 'CAPTCHA cancelled.' });
  });

  test('a frame or SDK load failure releases the request for an explicit resend', async () => {
    const { result } = renderHook(() =>
      useEmailOtpCaptcha({ config, email: 'a@example.com' }),
    );
    let request!: Promise<string | undefined>;
    act(() => {
      request = result.current.takeCaptchaToken();
    });
    const rejection = request.catch((error: unknown) => error);
    await act(async () => {
      result.current.onResult({
        type: 'onekey-test-captcha',
        requestId: result.current.challenge?.requestId || '',
        status: 'load-error',
      });
      await rejection;
    });
    expect(await rejection).toMatchObject({
      message:
        'CAPTCHA could not load. Check your network connection and retry.',
    });
    expect(result.current.isWaiting).toBe(false);
    expect(result.current.errorMessage).toBe(
      'CAPTCHA could not load. Check your network connection and retry.',
    );
    expect(result.current.challenge).toBeUndefined();
    act(() => result.current.cancelCaptcha());
    expect(result.current.errorMessage).toBeUndefined();
  });

  test('hosted interaction timeout releases the send and a fresh challenge can succeed', async () => {
    const { result } = renderHook(() =>
      useEmailOtpCaptcha({ config, email: 'a@example.com' }),
    );
    let request!: Promise<string | undefined>;
    act(() => {
      request = result.current.takeCaptchaToken();
    });
    const requestId = result.current.challenge?.requestId || '';
    const rejection = request.catch((error: unknown) => error);
    await act(async () => {
      result.current.onResult({
        type: 'onekey-test-captcha',
        requestId,
        status: 'ready',
      });
      result.current.onResult({
        type: 'onekey-test-captcha',
        requestId,
        status: 'timeout',
      });
      await rejection;
    });
    expect(await rejection).toMatchObject({
      message: 'CAPTCHA timed out. Please retry.',
    });
    expect(result.current.isWaiting).toBe(false);
    expect(result.current.challenge).toBeUndefined();
    act(() => {
      request = result.current.takeCaptchaToken();
    });
    expect(result.current.challenge?.requestId).not.toBe(requestId);
    await act(async () => {
      result.current.onResult({
        type: 'onekey-test-captcha',
        requestId: result.current.challenge?.requestId || '',
        status: 'success',
        token: 'fresh-token',
      });
      await request;
    });
    await expect(request).resolves.toBe('fresh-token');
  });

  test('expired prepared tokens require a new challenge and stalled challenges time out', async () => {
    jest.useFakeTimers();
    const { result } = renderHook(() =>
      useEmailOtpCaptcha({
        config,
        email: 'a@example.com',
        initialToken: { value: 'expired', expiresAt: Date.now() - 1 },
      }),
    );
    let request!: Promise<string | undefined>;
    act(() => {
      request = result.current.takeCaptchaToken();
    });
    expect(result.current.challenge).toBeDefined();
    const rejection = request.catch((error: unknown) => error);
    await act(async () => {
      jest.advanceTimersByTime(120_000);
      await rejection;
    });
    expect(await rejection).toMatchObject({
      message: expect.stringContaining('CAPTCHA timed out'),
    });
    expect(result.current.challenge).toBeUndefined();
  });
});
