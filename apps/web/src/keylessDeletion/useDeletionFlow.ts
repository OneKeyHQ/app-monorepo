import { useCallback, useEffect, useRef, useState } from 'react';

import { EOneKeyErrorClassNames } from '@onekeyhq/shared/src/errors/types/errorTypes';
import errorToastUtils from '@onekeyhq/shared/src/errors/utils/errorToastUtils';
import { getServerApiErrorMessage } from '@onekeyhq/shared/src/errors/utils/serverApiErrorMessage';

import { DeletionBusinessError } from './deletionBusinessError';
import { otpCooldownDeadline } from './otpInputState';
import {
  DeletionError,
  OTP_RESEND_SECONDS,
  createDeletionClient,
  matchesWarnings,
} from './protocol';

import type {
  IActiveChallenge,
  IDeleteRequest,
  IDeletionClient,
  IErrorCode,
  ILinkInfo,
  IProof,
  IProvider,
  IResult,
  ITransport,
  IWarningCode,
} from './protocol';

export type IBusinessAuth = {
  origin: string;
  transport: ITransport;
  authenticate(provider: IProvider, signal: AbortSignal): Promise<string>;
};

type ILink = { info: ILinkInfo };
type IEmail = ILink & {
  proof: IProof;
  resendAt?: number;
  deleteRetryAt?: number;
  confirmationUpdated?: boolean;
  confirmationReset?: number;
  key?: string;
};
type IReview = IEmail & {
  challenge: IActiveChallenge;
  resendAt: number;
  challengeExpiresAt: number;
};
type IOtpScreen =
  | ({ step: 'email' } & IEmail)
  | ({ step: 'confirm' } & IReview);
type IAttempt = {
  body: Omit<IDeleteRequest, keyof IProof>;
  key: string;
  review: Omit<IReview, 'proof'>;
};
type IKnownResult = Exclude<IResult, { status: 'not_submitted' }>;
type IAcceptedNotice = {
  status: 'processing' | 'manual_review_required';
  supportReference?: string;
};
type IResultScreen = {
  step: 'result';
  provider: IProvider;
  proof?: IProof;
  result?: IResult;
  accepted?: IAcceptedNotice;
  attempt?: IAttempt;
  checkAfter?: number;
  canRetry?: boolean;
  needsNewConfirmation?: boolean;
  cannotRetry?: boolean;
  submissionError?: DeletionBusinessError | DeletionError;
};

export type IResultHistory = Map<string, IResultScreen>;

type IScreen =
  | {
      step:
        | 'loading'
        | 'unavailable'
        | 'recovery-identity'
        | 'policy-pending'
        | 'target-changed'
        | 'rejected';
    }
  | ({ step: 'identity' } & ILink)
  | IOtpScreen
  | IResultScreen;

export type IFlowErrorCode =
  | IErrorCode
  | 'UNKNOWN'
  | 'UNSUPPORTED_CONFIRMATION'
  | 'OTP_SEND_RATE_LIMITED'
  | 'OTP_SEND_UNCERTAIN';

type IFlowError = {
  code: IFlowErrorCode;
  retryAt?: number;
  supportReference?: string;
  userMessage?: string;
  usesSharedToast?: boolean;
};

function isAuthError(cause: unknown) {
  return (
    cause instanceof DeletionError &&
    (cause.response.code === 'AUTH_EXPIRED' ||
      cause.response.code === 'AUTH_INVALID')
  );
}

function checkAfter(result: IResult) {
  return result.status === 'processing'
    ? otpCooldownDeadline(result.retryAfterSeconds)
    : undefined;
}

function getKnownResult(result: IResult | undefined): IKnownResult | undefined {
  return result?.status === 'not_submitted' ? undefined : result;
}

function matchesOriginal(previous: IResultScreen, next: IResult) {
  const known = getKnownResult(previous.result);
  const reference =
    known?.supportReference ?? previous.accepted?.supportReference;
  if (!known && !previous.accepted) {
    return true;
  }
  return (
    next.status !== 'not_submitted' &&
    (!reference || next.supportReference === reference) &&
    (!known || known.resultId === next.resultId) &&
    (known?.status !== 'completed' || next.status === 'completed')
  );
}

export function useDeletionFlow(
  token: string,
  business: IBusinessAuth,
  history: IResultHistory,
) {
  const [screen, setScreen] = useState<IScreen>({ step: 'loading' });
  const [error, setError] = useState<IFlowError>();
  const [busy, setBusy] = useState(false);
  const request = useRef<symbol | undefined>(undefined);
  const channel = useRef<
    { close(): void; client: IDeletionClient; signal: AbortSignal } | undefined
  >(undefined);

  const invalidate = useCallback(() => {
    request.current = undefined;
    channel.current?.close();
    channel.current = undefined;
  }, []);

  const showError = useCallback(
    (
      cause: unknown,
      codeOverride?: IFlowErrorCode,
      defaultBackoff?: number,
    ) => {
      const protocolError = cause instanceof DeletionError ? cause : undefined;
      const businessError =
        cause instanceof DeletionBusinessError ? cause : undefined;
      const { retryAfterSeconds = defaultBackoff, supportReference } =
        protocolError?.response ?? {};
      const notice = protocolError?.notice ?? businessError?.notice;
      const code =
        codeOverride ??
        protocolError?.response.code ??
        (cause instanceof DOMException && cause.name === 'NotSupportedError'
          ? 'UNSUPPORTED_CONFIRMATION'
          : 'UNKNOWN');
      const usesSharedToast = code === 'UNKNOWN';
      setError({
        code,
        retryAt:
          retryAfterSeconds === undefined
            ? undefined
            : otpCooldownDeadline(retryAfterSeconds),
        supportReference,
        userMessage: notice?.userMessage,
        usesSharedToast,
      });
      if (usesSharedToast && !notice?.disableAutoToast) {
        errorToastUtils.showToastOfError({
          autoToast: true,
          code: businessError?.serverCode,
          httpStatusCode: businessError?.httpStatusCode,
          className:
            cause instanceof TypeError
              ? EOneKeyErrorClassNames.AxiosNetworkError
              : EOneKeyErrorClassNames.OneKeyServerApiError,
          message: getServerApiErrorMessage({
            message: notice?.userMessage,
          }),
        });
      }
    },
    [],
  );

  const handleError = useCallback(
    (cause: unknown) => {
      if (cause instanceof DeletionError) {
        switch (cause.response.code) {
          case 'INVITATION_UNAVAILABLE':
            setScreen({ step: 'unavailable' });
            return;
          case 'TARGET_CHANGED':
            setScreen({ step: 'target-changed' });
            showError(cause);
            return;
          case 'DELETION_DISABLED':
            setScreen({ step: 'rejected' });
            showError(cause);
            return;
          default:
            break;
        }
      }
      showError(cause);
    },
    [showError],
  );

  const run = useCallback(
    (
      work: (isCurrent: () => boolean) => Promise<void>,
      onError = handleError,
    ) => {
      if (request.current) {
        return;
      }
      const id = Symbol('deletion request');
      request.current = id;
      const isCurrent = () => request.current === id;
      setError(undefined);
      setBusy(true);
      void work(isCurrent)
        .catch((cause: unknown) => {
          if (isCurrent()) {
            onError(cause);
          }
        })
        .finally(() => {
          if (isCurrent()) {
            request.current = undefined;
            setBusy(false);
          }
        });
    },
    [handleError],
  );

  function remember(value: IResultScreen) {
    history.set(token, value);
    setScreen(value);
  }

  const open = useCallback(() => {
    invalidate();
    setScreen({ step: 'loading' });
    run(async (isCurrent) => {
      const controller = new AbortController();
      const client = createDeletionClient(business.transport, {
        signal: controller.signal,
        origin: business.origin,
        timeoutMs: 8000,
      });
      channel.current = {
        close: () => controller.abort(),
        client,
        signal: controller.signal,
      };
      const previous = history.get(token);
      if (previous) {
        setScreen(previous);
        return;
      }
      const info = await client.getLinkInfo(token);
      if (isCurrent()) {
        if (
          info.status === 'ready' &&
          info.recreationPolicy === 'pending_decision'
        ) {
          setScreen({ step: 'policy-pending' });
        } else {
          setScreen({ step: 'identity', info });
        }
      }
    });
  }, [business, history, invalidate, run, token]);

  useEffect(() => {
    open();
    return () => {
      invalidate();
      history.delete(token);
    };
  }, [open, invalidate, history, token]);

  async function authenticate(
    provider: IProvider,
    signal: AbortSignal,
  ): Promise<IProof> {
    return {
      invitationToken: token,
      provider,
      supabaseAccessToken: await business.authenticate(provider, signal),
    };
  }

  function signIn(provider: IProvider) {
    if (screen.step !== 'identity' || !channel.current || request.current) {
      return;
    }
    const { info } = screen;
    if (provider !== info.allowedProvider) {
      return;
    }
    if (info.status === 'used') {
      recoverResult(provider);
      return;
    }
    const { client, signal } = channel.current;
    run(async (isCurrent) => {
      const proof = await authenticate(provider, signal);
      if (!isCurrent()) {
        return;
      }
      const email = { step: 'email', info, proof } as const;
      await requestOtp(client, email, isCurrent);
    });
  }

  function openRecovery() {
    setError(undefined);
    setScreen({ step: 'recovery-identity' });
  }

  function recoverResult(provider: IProvider) {
    if (
      !channel.current ||
      (screen.step !== 'recovery-identity' && screen.step !== 'identity')
    ) {
      return;
    }
    const { client, signal } = channel.current;
    run(async (isCurrent) => {
      const proof = await authenticate(provider, signal);
      if (!isCurrent()) {
        return;
      }
      const result = await client.getResult(proof);
      if (isCurrent()) {
        remember({
          step: 'result',
          provider: proof.provider,
          proof,
          result,
          checkAfter: checkAfter(result),
        });
      }
    });
  }

  async function requestOtp(
    client: IDeletionClient,
    previous: IOtpScreen,
    isCurrent: () => boolean,
  ) {
    const {
      info,
      proof,
      key,
      confirmationUpdated,
      confirmationReset,
      resendAt,
      deleteRetryAt,
    } = previous;
    const email = {
      step: 'email',
      info,
      proof,
      key,
      confirmationUpdated,
      confirmationReset,
      resendAt,
      deleteRetryAt,
    } as const;
    let challenge: IActiveChallenge;
    let resendAfterSeconds: number;
    try {
      const issued = await client.sendDeletionOtp(email.proof);
      challenge = issued;
      resendAfterSeconds = issued.resendAfterSeconds;
    } catch (cause) {
      if (!isCurrent()) {
        return;
      }
      if (
        cause instanceof DeletionBusinessError &&
        cause.httpStatusCode < 500
      ) {
        setScreen(email);
        showError(cause);
        return;
      }
      if (
        !(cause instanceof DeletionError) ||
        cause.response.code === 'SERVICE_UNAVAILABLE'
      ) {
        const seconds =
          cause instanceof DeletionError
            ? (cause.response.retryAfterSeconds ?? OTP_RESEND_SECONDS)
            : OTP_RESEND_SECONDS;
        setScreen({ ...email, resendAt: otpCooldownDeadline(seconds) });
        showError(cause, 'OTP_SEND_UNCERTAIN', OTP_RESEND_SECONDS);
        return;
      }
      if (isAuthError(cause) || cause.response.code === 'IDENTITY_MISMATCH') {
        setScreen({ step: 'identity', info: email.info });
        showError(cause);
        return;
      }
      if (cause.response.code === 'RATE_LIMITED') {
        const active =
          previous.step === 'confirm' &&
          globalThis.performance.now() < previous.challengeExpiresAt;
        setScreen({
          ...(active ? previous : email),
          resendAt: otpCooldownDeadline(
            cause.response.retryAfterSeconds ?? OTP_RESEND_SECONDS,
          ),
        });
        showError(cause, 'OTP_SEND_RATE_LIMITED');
        return;
      }
      if (previous.step === 'email') {
        setScreen(email);
      }
      handleError(cause);
      return;
    }
    if (isCurrent()) {
      setScreen({
        ...email,
        step: 'confirm',
        challenge,
        resendAt: otpCooldownDeadline(resendAfterSeconds),
        challengeExpiresAt: otpCooldownDeadline(
          (Date.parse(challenge.expiresAt) - Date.parse(challenge.serverTime)) /
            1000,
        ),
      });
    }
  }

  function sendDeletionOtp() {
    if (
      !(screen.step === 'email' || screen.step === 'confirm') ||
      !channel.current
    ) {
      return;
    }
    if (globalThis.performance.now() < (screen.resendAt ?? 0)) {
      return;
    }
    const { client } = channel.current;
    run((isCurrent) => requestOtp(client, screen, isCurrent));
  }

  async function loadResult(
    client: IDeletionClient,
    previous: IResultScreen,
    proof: IProof,
    isCurrent: () => boolean,
  ) {
    try {
      const result = await client.getResult(proof);
      if (!isCurrent()) {
        return;
      }
      if (!matchesOriginal(previous, result)) {
        throw new SyntaxError('Result does not match the original deletion.');
      }
      if (
        result.status === 'not_submitted' &&
        previous.needsNewConfirmation &&
        previous.attempt
      ) {
        const info = await client.getLinkInfo(token);
        if (!isCurrent()) {
          return;
        }
        if (
          info.status !== 'ready' ||
          info.allowedProvider !== previous.provider ||
          info.confirmationVersion === previous.attempt.body.confirmationVersion
        ) {
          throw new SyntaxError(
            'The invitation changed during confirmation refresh.',
          );
        }
        if (info.recreationPolicy === 'pending_decision') {
          setScreen({ step: 'policy-pending' });
          return;
        }
        history.delete(token);
        setScreen({
          ...previous.attempt.review,
          step: 'confirm',
          info,
          proof,
          key: undefined,
          confirmationUpdated: true,
        });
        return;
      }
      const { submissionError, ...resolved } = previous;
      remember({
        ...resolved,
        proof,
        result,
        canRetry:
          result.status === 'not_submitted' &&
          !!previous.attempt &&
          !previous.cannotRetry,
        checkAfter: checkAfter(result),
        attempt: result.status === 'completed' ? undefined : previous.attempt,
      });
      if (result.status === 'not_submitted' && submissionError) {
        showError(submissionError);
      }
    } catch (cause) {
      if (isCurrent()) {
        remember({
          ...previous,
          proof:
            isAuthError(cause) ||
            (cause instanceof DeletionError &&
              cause.response.code === 'IDENTITY_MISMATCH')
              ? undefined
              : previous.proof,
          canRetry: false,
        });
        const transportFailed =
          cause instanceof TypeError ||
          (cause instanceof DOMException && cause.name === 'TimeoutError');
        showError(cause, transportFailed ? 'SERVICE_UNAVAILABLE' : undefined);
      }
    }
  }

  function submitAttempt(attempt: IAttempt, proof: IProof) {
    if (!channel.current) {
      return;
    }
    const { client } = channel.current;
    run(async (isCurrent) => {
      const pending: IResultScreen = {
        step: 'result',
        provider: proof.provider,
        proof,
        attempt,
      };
      history.set(token, pending);
      try {
        const result = await client.deleteShare(
          { ...attempt.body, ...proof },
          attempt.key,
        );
        if (isCurrent()) {
          remember({ step: 'result', provider: proof.provider, proof, result });
        }
      } catch (cause) {
        if (!isCurrent()) {
          return;
        }
        if (isAuthError(cause)) {
          remember({ ...pending, proof: undefined });
          showError(cause);
          return;
        }
        const response =
          cause instanceof DeletionError ? cause.response : undefined;
        const code = response?.code;
        if (
          code === 'OTP_INVALID' ||
          code === 'OTP_EXPIRED' ||
          code === 'RATE_LIMITED'
        ) {
          history.delete(token);
          setScreen({
            ...attempt.review,
            step: 'confirm',
            proof,
            key: attempt.key,
            deleteRetryAt:
              code === 'RATE_LIMITED'
                ? otpCooldownDeadline(
                    response?.retryAfterSeconds ?? OTP_RESEND_SECONDS,
                  )
                : attempt.review.deleteRetryAt,
          });
          showError(cause);
          return;
        }
        if (code === 'IDENTITY_MISMATCH') {
          history.delete(token);
          setScreen({ step: 'identity', info: attempt.review.info });
          showError(cause);
          return;
        }
        if (code === 'CONFIRMATION_REQUIRED') {
          history.delete(token);
          setScreen({
            ...attempt.review,
            step: 'confirm',
            proof,
            key: attempt.key,
            confirmationReset: (attempt.review.confirmationReset ?? 0) + 1,
          });
          showError(cause);
          return;
        }
        if (code === 'TARGET_CHANGED' || code === 'DELETION_DISABLED') {
          history.delete(token);
          handleError(cause);
          return;
        }
        const accepted =
          code === 'OPERATION_IN_PROGRESS' || code === 'MANUAL_REVIEW_REQUIRED'
            ? {
                status:
                  code === 'OPERATION_IN_PROGRESS'
                    ? ('processing' as const)
                    : ('manual_review_required' as const),
                supportReference: response?.supportReference,
              }
            : undefined;
        const recovery = {
          ...pending,
          accepted,
          checkAfter:
            response?.retryAfterSeconds === undefined
              ? undefined
              : otpCooldownDeadline(response.retryAfterSeconds),
          needsNewConfirmation: code === 'CONFIRMATION_CHANGED',
          submissionError:
            cause instanceof DeletionBusinessError ||
            (cause instanceof DeletionError &&
              (code === 'SERVICE_UNAVAILABLE' || code === 'INVALID_REQUEST'))
              ? cause
              : undefined,
          cannotRetry: Boolean(accepted || code === 'IDEMPOTENCY_CONFLICT'),
        };
        remember(recovery);
        if (code !== 'MANUAL_REVIEW_REQUIRED') {
          await loadResult(client, recovery, proof, isCurrent);
        }
      }
    });
  }

  function submit(code: string, acknowledgements: IWarningCode[]) {
    if (
      screen.step !== 'confirm' ||
      !code ||
      !matchesWarnings(acknowledgements, screen.info.warningCodes) ||
      globalThis.performance.now() < (screen.deleteRetryAt ?? 0) ||
      globalThis.performance.now() >= screen.challengeExpiresAt
    ) {
      return;
    }
    const { step: _step, proof, ...review } = screen;
    const { info, challenge } = review;
    submitAttempt(
      {
        body: {
          challengeId: challenge.challengeId,
          code,
          confirmationVersion: info.confirmationVersion,
          acknowledgements,
        },
        key: screen.key ?? globalThis.crypto.randomUUID(),
        review,
      },
      proof,
    );
  }

  function checkStatus() {
    if (screen.step !== 'result' || !channel.current || !screen.proof) {
      return;
    }
    const { client } = channel.current;
    const { proof } = screen;
    const previous = { ...screen, canRetry: false };
    run((isCurrent) => loadResult(client, previous, proof, isCurrent));
  }

  function reauthenticate() {
    if (screen.step === 'result' && channel.current && !screen.proof) {
      const { client, signal } = channel.current;
      const previous = screen;
      run(async (isCurrent) => {
        const proof = await authenticate(previous.provider, signal);
        if (isCurrent()) {
          await loadResult(client, previous, proof, isCurrent);
        }
      });
    }
  }

  function retrySubmit() {
    if (
      screen.step === 'result' &&
      screen.attempt &&
      screen.canRetry &&
      screen.proof
    ) {
      submitAttempt(screen.attempt, screen.proof);
    }
  }

  function editCode() {
    setError((previous) =>
      previous?.code === 'OTP_INVALID' ? undefined : previous,
    );
  }

  return {
    screen,
    error,
    busy,
    open,
    signIn,
    openRecovery,
    recoverResult,
    sendDeletionOtp,
    editCode,
    submit,
    checkStatus,
    reauthenticate,
    retrySubmit,
  };
}
