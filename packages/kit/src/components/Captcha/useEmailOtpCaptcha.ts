import { useCallback, useEffect, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import { useIsMounted } from '@onekeyhq/kit/src/hooks/useIsMounted';
import type { IEmailOtpCaptchaConfig } from '@onekeyhq/shared/src/consts/authConsts';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { generateUUID } from '@onekeyhq/shared/src/utils/miscUtils';

import type { ICaptchaMessage } from './captchaMessage';

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
};

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

  const cancelCaptcha = useCallback(() => {
    generation.current += 1;
    cachedToken.current = undefined;
    settle(new EmailOtpCaptchaCancelledError());
    if (mounted.current) {
      setChallenge(undefined);
      setErrorKey(undefined);
    }
  }, [mounted, settle]);

  // Locale updates must not cancel an active challenge or reset its deadline.
  const createCaptchaError = useCallback(
    (key: ETranslations) =>
      new OneKeyLocalError({
        key,
        message: intlRef.current.formatMessage({ id: key }),
      }),
    [],
  );

  const failToLoad = useCallback(
    (key: ETranslations) => {
      settle(createCaptchaError(key));
      // No provider result exists yet. Remove the stalled frame so a late load
      // cannot show success for an OTP request that has already been released.
      if (mounted.current) {
        setChallenge(undefined);
        setErrorKey(key);
      }
    },
    [createCaptchaError, mounted, settle],
  );

  useEffect(() => {
    setChallenge(undefined);
    return cancelCaptcha;
  }, [active, email, enabled, pageUrl, revision, cancelCaptcha]);

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
      resolve,
      reject,
      timer: setTimeout(
        () => failToLoad(ETranslations.auth_captcha_timeout__msg),
        120_000,
      ),
    };
    setIsWaiting(true);
    setErrorKey(undefined);
    setChallenge({ url: url.toString(), requestId });
    return promise;
  }, [active, enabled, pageUrl, failToLoad, createCaptchaError]);

  const onResult = useCallback(
    (message: ICaptchaMessage) => {
      if (message.requestId !== pending.current?.requestId) return;
      if (message.status === 'success' && message.token) {
        settle(message.token);
      } else if (message.status === 'load-error') {
        failToLoad(ETranslations.auth_captcha_load_failed__msg);
      } else if (message.status === 'timeout') {
        // The hosted page requires a fresh challenge after interaction timeout.
        failToLoad(ETranslations.auth_captcha_timeout__msg);
      } else {
        // Once the provider is running, its retry/expiry UI owns recovery.
        // Keep the original send waiting for success, including manual Retry.
        clearTimeout(pending.current.timer);
      }
    },
    [failToLoad, settle],
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
    errorMessage: errorKey ? intl.formatMessage({ id: errorKey }) : undefined,
  };
}
