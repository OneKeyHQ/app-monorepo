import { useCallback, useEffect, useRef, useState } from 'react';

import { useIsMounted } from '@onekeyhq/kit/src/hooks/useIsMounted';
import { EMAIL_OTP_CAPTCHA_CONFIG } from '@onekeyhq/shared/src/consts/authConsts';
import type { IEmailOtpCaptchaConfig } from '@onekeyhq/shared/src/consts/authConsts';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
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
  config = EMAIL_OTP_CAPTCHA_CONFIG,
  active = true,
  email,
  revision = 0,
  initialToken,
}: {
  config?: IEmailOtpCaptchaConfig;
  active?: boolean;
  email: string;
  revision?: number;
  initialToken?: ICaptchaToken;
}) {
  const { enabled, pageUrl } = config;
  const mounted = useIsMounted();
  const pending = useRef<IPendingCaptcha | undefined>(undefined);
  const generation = useRef(0);
  const [isWaiting, setIsWaiting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>();
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
      setErrorMessage(undefined);
    }
  }, [mounted, settle]);

  const failToLoad = useCallback(
    (message: string) => {
      settle(new OneKeyLocalError(message));
      // No provider result exists yet. Remove the stalled frame so a late load
      // cannot show success for an OTP request that has already been released.
      if (mounted.current) {
        setChallenge(undefined);
        setErrorMessage(message);
      }
    },
    [mounted, settle],
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
      throw new OneKeyLocalError(
        'CAPTCHA is unavailable. Please try again later.',
      );
    if (cachedToken.current && cachedToken.current.expiresAt > Date.now()) {
      const { value } = cachedToken.current;
      cachedToken.current = undefined;
      return value;
    }
    cachedToken.current = undefined;
    if (pending.current)
      throw new OneKeyLocalError('CAPTCHA verification is in progress.');

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
        () => failToLoad('CAPTCHA timed out. Please retry.'),
        120_000,
      ),
    };
    setIsWaiting(true);
    setErrorMessage(undefined);
    setChallenge({ url: url.toString(), requestId });
    return promise;
  }, [active, enabled, pageUrl, failToLoad]);

  const onResult = useCallback(
    (message: ICaptchaMessage) => {
      if (message.requestId !== pending.current?.requestId) return;
      if (message.status === 'success' && message.token) {
        settle(message.token);
      } else if (message.status === 'load-error') {
        failToLoad(
          'CAPTCHA could not load. Check your network connection and retry.',
        );
      } else if (message.status === 'timeout') {
        // The hosted page requires a fresh challenge after interaction timeout.
        failToLoad('CAPTCHA timed out. Please retry.');
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
    errorMessage,
  };
}
