import { useCallback, useEffect, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import { useIsMounted } from '@onekeyhq/kit/src/hooks/useIsMounted';
import type { IEmailOtpCaptchaConfig } from '@onekeyhq/shared/src/consts/authConsts';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { generateUUID } from '@onekeyhq/shared/src/utils/miscUtils';

import { createCaptchaDiagnostic } from './captchaDiagnostic';

import type { ICaptchaFrameResult } from './captchaMessage';

export type ICaptchaToken = { value: string; expiresAt: number };

export class EmailOtpCaptchaCancelledError extends OneKeyLocalError {
  constructor() {
    super('CAPTCHA cancelled.');
  }
}

type IPendingCaptcha = {
  requestId: string;
  resolve: (token: string) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
  diagnostic: ReturnType<typeof createCaptchaDiagnostic>;
};

// Only codes explicitly marked "Retry: No" may replace the provider's UI.
// https://developers.cloudflare.com/turnstile/troubleshooting/client-side-errors/error-codes/
const TERMINAL_ERROR_CODES = new Set([
  '110100',
  '110110',
  '110200',
  '200100',
  '400020',
  '400021',
  '400070',
]);

export function useEmailOtpCaptcha({
  config,
  active = true,
  email,
  revision = 0,
  initialToken,
}: {
  config: IEmailOtpCaptchaConfig;
  active?: boolean;
  email: string;
  revision?: number;
  initialToken?: ICaptchaToken;
}) {
  const intl = useIntl();
  const intlRef = useRef(intl);
  intlRef.current = intl;
  const { enabled, pageUrl } = config;
  const mounted = useIsMounted();
  const pending = useRef<IPendingCaptcha | undefined>(undefined);
  const generation = useRef(0);
  const [isWaiting, setIsWaiting] = useState(false);
  const [errorKey, setErrorKey] = useState<ETranslations>();
  const cachedToken = useRef<ICaptchaToken>(initialToken);
  const [challenge, setChallenge] = useState<{
    url: string;
    requestId: string;
  }>();

  const settle = useCallback(
    (value: string | Error) => {
      const request = pending.current;
      if (!request) return;
      pending.current = undefined;
      clearTimeout(request.timer);
      if (mounted.current) setIsWaiting(false);
      // Keep the provider result visible until a new attempt or configuration.
      if (typeof value === 'string') request.resolve(value);
      else request.reject(value);
    },
    [mounted],
  );

  const cancelPending = useCallback(
    (source: 'app_cancel' | 'app_cleanup') => {
      generation.current += 1;
      cachedToken.current = undefined;
      pending.current?.diagnostic('cancel', source, undefined, true);
      settle(new EmailOtpCaptchaCancelledError());
      if (mounted.current) {
        setChallenge(undefined);
        setErrorKey(undefined);
      }
    },
    [mounted, settle],
  );

  const cancelCaptcha = useCallback(
    () => cancelPending('app_cancel'),
    [cancelPending],
  );

  // Locale updates must not cancel an active challenge or reset its deadline.
  const createCaptchaError = useCallback(
    (key: ETranslations) =>
      new OneKeyLocalError({
        key,
        message: intlRef.current.formatMessage({ id: key }),
      }),
    [],
  );

  const failCaptcha = useCallback(
    (key: ETranslations) => {
      settle(createCaptchaError(key));
      // Remove the failed frame so late recovery cannot show success for an
      // OTP request that has already been released.
      if (mounted.current) {
        setChallenge(undefined);
        setErrorKey(key);
      }
    },
    [createCaptchaError, mounted, settle],
  );

  useEffect(() => {
    setChallenge(undefined);
    return () => cancelPending('app_cleanup');
  }, [active, email, enabled, pageUrl, revision, cancelPending]);

  useEffect(() => {
    cachedToken.current = initialToken;
  }, [initialToken]);

  const requestToken = useCallback(async () => {
    if (!active) throw new EmailOtpCaptchaCancelledError();
    if (!enabled) return undefined;
    if (!pageUrl)
      throw createCaptchaError(ETranslations.auth_captcha_unavailable__msg);
    if (cachedToken.current && cachedToken.current.expiresAt > Date.now()) {
      const { value } = cachedToken.current;
      cachedToken.current = undefined;
      return value;
    }
    cachedToken.current = undefined;
    if (pending.current)
      throw createCaptchaError(ETranslations.auth_captcha_in_progress__msg);

    const requestId = generateUUID();
    const diagnostic = createCaptchaDiagnostic(requestId);
    const url = new URL(pageUrl);
    url.hash = new URLSearchParams({
      requestId,
    }).toString();
    let resolve!: IPendingCaptcha['resolve'];
    let reject!: IPendingCaptcha['reject'];
    const promise = new Promise<string>((resolveToken, rejectToken) => {
      resolve = resolveToken;
      reject = rejectToken;
    });
    pending.current = {
      requestId,
      diagnostic,
      resolve,
      reject,
      timer: setTimeout(() => {
        if (pending.current?.requestId !== requestId) return;
        diagnostic('timeout', 'app_watchdog', undefined, true);
        failCaptcha(ETranslations.auth_captcha_timeout__msg);
      }, 120_000),
    };
    diagnostic('start', 'app_request');
    setIsWaiting(true);
    setErrorKey(undefined);
    setChallenge({ url: url.toString(), requestId });
    return promise;
  }, [active, enabled, pageUrl, failCaptcha, createCaptchaError]);

  const onResult = useCallback(
    (message: ICaptchaFrameResult) => {
      if (message.requestId !== pending.current?.requestId) return;
      const terminal = Boolean(
        (message.status === 'success' && message.token) ||
        message.status === 'load-error' ||
        message.status === 'timeout' ||
        (message.status === 'error' &&
          message.code &&
          TERMINAL_ERROR_CODES.has(message.code)),
      );
      pending.current.diagnostic(
        message.status,
        message.source ?? 'provider_message',
        message.code,
        terminal,
      );
      if (message.status === 'success' && message.token) {
        settle(message.token);
      } else if (message.status === 'load-error') {
        failCaptcha(ETranslations.auth_captcha_load_failed__msg);
      } else if (message.status === 'timeout') {
        // The hosted page requires a fresh challenge after interaction timeout.
        failCaptcha(ETranslations.auth_captcha_timeout__msg);
      } else if (
        message.status === 'error' &&
        message.code &&
        TERMINAL_ERROR_CODES.has(message.code)
      ) {
        failCaptcha(ETranslations.auth_captcha_unavailable__msg);
      } else {
        // Once the provider is running, its retry/expiry UI owns recovery.
        // Keep the original send waiting for success, including manual Retry.
        clearTimeout(pending.current.timer);
      }
    },
    [failCaptcha, settle],
  );

  const takeCaptchaToken = useCallback(async () => {
    const requestGeneration = generation.current;
    const token = await requestToken();
    if (!mounted.current || generation.current !== requestGeneration)
      throw new EmailOtpCaptchaCancelledError();
    return token;
  }, [mounted, requestToken]);

  return {
    challenge,
    onResult,
    takeCaptchaToken,
    cancelCaptcha,
    isWaiting,
    errorKey,
    errorMessage: errorKey ? intl.formatMessage({ id: errorKey }) : undefined,
  };
}
