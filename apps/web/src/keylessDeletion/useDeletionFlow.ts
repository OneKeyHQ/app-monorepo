import { useCallback, useEffect, useRef, useState } from 'react';

import { EOneKeyErrorClassNames } from '@onekeyhq/shared/src/errors/types/errorTypes';
import errorToastUtils from '@onekeyhq/shared/src/errors/utils/errorToastUtils';
import { getServerApiErrorMessage } from '@onekeyhq/shared/src/errors/utils/serverApiErrorMessage';

import { DeletionBusinessError } from './deletionBusinessError';
import { otpCooldownDeadline } from './otpInputState';
import { PopupBlockedError } from './popupBlockedError';
import {
  DeletionError,
  OTP_RESEND_SECONDS,
  createDeletionClient,
  matchesWarnings,
} from './protocol';

import type {
  IActiveChallenge,
  ICompleted,
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
  uncertainDeletion?: 'unconfirmed' | 'not_found';
  outcomeCheckAfter?: number;
  outcomeNeedsSignIn?: boolean;
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
  checkAfter?: number;
  resultCheckFailed?: boolean;
};

export type IResultHistory = Map<string, IResultScreen>;

type IScreen =
  | {
      step:
        | 'loading'
        | 'unavailable'
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
  | 'OTP_SEND_UNCERTAIN'
  | 'POPUP_BLOCKED';

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

function withoutCurrentShareStatus(
  result: IResult | undefined,
): IResult | undefined {
  return result?.status === 'completed'
    ? { ...result, currentShareStatus: 'unknown' }
    : result;
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
    (known?.status !== 'completed' ||
      (next.status === 'completed' &&
        Date.parse(known.completedAt) === Date.parse(next.completedAt)))
  );
}

export function useDeletionFlow(
  token: string,
  business: IBusinessAuth,
  history: IResultHistory,
) {
  const [screen, setScreen] = useState<IScreen>({ step: 'loading' });
  const [error, setError] = useState<IFlowError>();
  const [busyAction, setBusyAction] = useState<'request' | 'delete'>();
  const busy = busyAction !== undefined;
  const resultCheckAfter =
    screen.step === 'result' ? (screen.checkAfter ?? 0) : 0;
  const request = useRef<symbol | undefined>(undefined);
  const invitationTimer = useRef<
    ReturnType<typeof globalThis.setTimeout> | undefined
  >(undefined);
  const channel = useRef<
    | {
        close(): void;
        client: IDeletionClient;
        signal: AbortSignal;
        expiresAt?: number;
      }
    | undefined
  >(undefined);

  const invalidate = useCallback(() => {
    request.current = undefined;
    globalThis.clearTimeout(invitationTimer.current);
    channel.current?.close();
    channel.current = undefined;
  }, []);

  const endInvitation = useCallback(() => {
    invalidate();
    history.delete(token);
    setScreen({ step: 'unavailable' });
    setError(undefined);
    setBusyAction(undefined);
  }, [history, invalidate, token]);

  const setInvitationDeadline = useCallback(
    (info: ILinkInfo) => {
      const active = channel.current;
      if (!active) return false;
      const remaining =
        Date.parse(info.expiresAt) - Date.parse(info.serverTime);
      if (remaining <= 0) {
        endInvitation();
        return false;
      }
      const deadline = globalThis.performance.now() + remaining;
      active.expiresAt = deadline;
      globalThis.clearTimeout(invitationTimer.current);
      const waitForExpiry = () => {
        const wait = deadline - globalThis.performance.now();
        if (wait <= 0) endInvitation();
        else
          invitationTimer.current = globalThis.setTimeout(
            waitForExpiry,
            Math.min(wait, 2_147_483_647),
          );
      };
      waitForExpiry();
      return true;
    },
    [endInvitation],
  );

  function hasActiveInvitation() {
    const deadline = channel.current?.expiresAt;
    if (deadline === undefined) return false;
    if (globalThis.performance.now() < deadline) return true;
    endInvitation();
    return false;
  }

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
      let code: IFlowErrorCode = 'UNKNOWN';
      if (codeOverride) code = codeOverride;
      else if (protocolError) code = protocolError.response.code;
      else if (cause instanceof PopupBlockedError) code = 'POPUP_BLOCKED';
      else if (
        cause instanceof DOMException &&
        cause.name === 'NotSupportedError'
      ) {
        code = 'UNSUPPORTED_CONFIRMATION';
      }
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
            cause instanceof TypeError ||
            (cause instanceof DOMException && cause.name === 'TimeoutError')
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
            endInvitation();
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
    [endInvitation, showError],
  );

  const run = useCallback(
    (
      work: (isCurrent: () => boolean) => Promise<void>,
      action: 'request' | 'delete' = 'request',
    ) => {
      if (request.current) {
        return;
      }
      const id = Symbol('deletion request');
      request.current = id;
      const isCurrent = () => request.current === id;
      setError(undefined);
      setBusyAction(action);
      void work(isCurrent)
        .catch((cause: unknown) => {
          if (isCurrent()) {
            handleError(cause);
          }
        })
        .finally(() => {
          if (isCurrent()) {
            request.current = undefined;
            setBusyAction(undefined);
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
      const info = await client.getLinkInfo(token);
      if (!isCurrent() || !setInvitationDeadline(info)) return;

      const previous = history.get(token);
      if (previous?.provider === info.allowedProvider) {
        const restored = {
          ...previous,
          result: withoutCurrentShareStatus(previous.result),
        };
        history.set(token, restored);
        setScreen(restored);
      } else if (
        info.status === 'ready' &&
        info.recreationPolicy === 'pending_decision'
      ) {
        setScreen({ step: 'policy-pending' });
      } else {
        setScreen({ step: 'identity', info });
      }
    });
  }, [business, history, invalidate, run, setInvitationDeadline, token]);

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
    if (
      screen.step !== 'identity' ||
      !channel.current ||
      request.current ||
      provider !== screen.info.allowedProvider ||
      !hasActiveInvitation()
    ) {
      return;
    }
    const { info } = screen;
    const { client, signal } = channel.current;
    run(async (isCurrent) => {
      const proof = await authenticate(provider, signal);
      if (!isCurrent() || !hasActiveInvitation()) return;
      if (info.status === 'used') {
        const previous = {
          step: 'result',
          provider,
          proof,
        } as const;
        await loadResult(client, previous, proof, isCurrent, () => {
          setScreen({ step: 'identity', info });
        });
      } else {
        await requestOtp(client, { step: 'email', info, proof }, isCurrent);
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
    if (isCurrent() && hasActiveInvitation()) {
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
    if (
      (screen.step === 'confirm' && !!screen.uncertainDeletion) ||
      globalThis.performance.now() < (screen.resendAt ?? 0) ||
      !hasActiveInvitation()
    ) {
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
    onIdentityMismatch?: () => void,
  ) {
    if (!hasActiveInvitation()) return;
    try {
      const result = await client.getResult(proof);
      if (!isCurrent() || !hasActiveInvitation()) {
        return;
      }
      if (!matchesOriginal(previous, result)) {
        throw new SyntaxError('Result does not match the original deletion.');
      }
      remember({
        ...previous,
        proof,
        result,
        resultCheckFailed: false,
        checkAfter: checkAfter(result),
      });
    } catch (cause) {
      if (isCurrent()) {
        if (
          cause instanceof DeletionError &&
          cause.response.code === 'INVITATION_UNAVAILABLE'
        ) {
          endInvitation();
          return;
        }
        if (
          onIdentityMismatch &&
          cause instanceof DeletionError &&
          cause.response.code === 'IDENTITY_MISMATCH'
        ) {
          onIdentityMismatch();
          showError(cause);
          return;
        }
        const retryAfterSeconds =
          cause instanceof DeletionError
            ? (cause.response.retryAfterSeconds ??
              (cause.response.code === 'RATE_LIMITED'
                ? OTP_RESEND_SECONDS
                : undefined))
            : undefined;
        remember({
          ...previous,
          result: withoutCurrentShareStatus(previous.result),
          resultCheckFailed: true,
          proof:
            isAuthError(cause) ||
            (cause instanceof DeletionError &&
              cause.response.code === 'IDENTITY_MISMATCH')
              ? undefined
              : previous.proof,
          checkAfter:
            retryAfterSeconds === undefined
              ? previous.checkAfter
              : Math.max(
                  previous.checkAfter ?? 0,
                  otpCooldownDeadline(retryAfterSeconds),
                ),
        });
        showError(cause);
      }
    }
  }

  function submitAttempt(attempt: IAttempt, proof: IProof) {
    if (!channel.current || !hasActiveInvitation()) {
      return;
    }
    const { client } = channel.current;
    run(async (isCurrent) => {
      let result: ICompleted;
      try {
        result = await client.deleteShare(
          { ...attempt.body, ...proof },
          attempt.key,
        );
      } catch (cause) {
        if (!isCurrent()) {
          return;
        }
        const response =
          cause instanceof DeletionError ? cause.response : undefined;
        const code = response?.code;
        const retryAfterSeconds =
          response?.retryAfterSeconds ??
          (code === 'RATE_LIMITED' ? OTP_RESEND_SECONDS : undefined);
        const deleteRetryAt =
          retryAfterSeconds === undefined
            ? attempt.review.deleteRetryAt
            : otpCooldownDeadline(retryAfterSeconds);
        if (isAuthError(cause) || code === 'IDENTITY_MISMATCH') {
          if (attempt.review.uncertainDeletion) {
            setScreen({
              ...attempt.review,
              step: 'confirm',
              proof,
              deleteRetryAt,
              outcomeNeedsSignIn: true,
            });
          } else {
            history.delete(token);
            setScreen({ step: 'identity', info: attempt.review.info });
          }
          showError(cause);
          return;
        }
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
            challengeExpiresAt:
              code === 'OTP_EXPIRED' ? 0 : attempt.review.challengeExpiresAt,
            deleteRetryAt,
          });
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
            deleteRetryAt,
            confirmationReset: (attempt.review.confirmationReset ?? 0) + 1,
          });
          showError(cause);
          return;
        }
        if (
          code === 'INVITATION_UNAVAILABLE' ||
          code === 'TARGET_CHANGED' ||
          code === 'DELETION_DISABLED'
        ) {
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
        if (accepted) {
          const acknowledged: IResultScreen = {
            step: 'result',
            provider: proof.provider,
            proof,
            accepted,
          };
          if (accepted.status === 'processing') {
            await loadResult(client, acknowledged, proof, isCurrent);
          } else {
            remember(acknowledged);
          }
          return;
        }
        const uncertain =
          code === 'SERVICE_UNAVAILABLE' ||
          code === 'IDEMPOTENCY_CONFLICT' ||
          (!response &&
            (!(cause instanceof DeletionBusinessError) ||
              (cause.httpStatusCode ?? 0) >= 500));
        // No confirmed outcome. A manual retry must reuse the request key.
        setScreen({
          ...attempt.review,
          step: 'confirm',
          proof,
          key: attempt.key,
          deleteRetryAt,
          uncertainDeletion: uncertain
            ? 'unconfirmed'
            : attempt.review.uncertainDeletion,
        });
        showError(cause);
        return;
      }
      if (isCurrent()) {
        const completed: IResultScreen = {
          step: 'result',
          provider: proof.provider,
          proof,
          result,
        };
        await loadResult(client, completed, proof, isCurrent);
      }
    }, 'delete');
  }

  function submit(code: string, acknowledgements: IWarningCode[]) {
    if (
      screen.step !== 'confirm' ||
      screen.outcomeNeedsSignIn ||
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

  function checkDeleteOutcome() {
    if (
      screen.step !== 'confirm' ||
      !screen.uncertainDeletion ||
      globalThis.performance.now() < (screen.outcomeCheckAfter ?? 0) ||
      !channel.current ||
      !hasActiveInvitation()
    ) {
      return;
    }
    const { client, signal } = channel.current;
    const previous = screen;
    run(async (isCurrent) => {
      try {
        const proof = previous.outcomeNeedsSignIn
          ? await authenticate(previous.proof.provider, signal)
          : previous.proof;
        if (!isCurrent() || !hasActiveInvitation()) return;
        const result = await client.getResult(proof);
        if (!isCurrent() || !hasActiveInvitation()) return;
        if (result.status === 'not_submitted') {
          setScreen({
            ...previous,
            proof,
            uncertainDeletion: 'not_found',
            outcomeNeedsSignIn: false,
            outcomeCheckAfter: undefined,
          });
          return;
        }
        remember({
          step: 'result',
          provider: proof.provider,
          proof,
          result,
          checkAfter: checkAfter(result),
        });
      } catch (cause) {
        if (!isCurrent() || !hasActiveInvitation()) return;
        if (
          cause instanceof DeletionError &&
          cause.response.code !== 'INVITATION_UNAVAILABLE'
        ) {
          const { code, retryAfterSeconds } = cause.response;
          const retryAfter =
            retryAfterSeconds ??
            (code === 'RATE_LIMITED' ? OTP_RESEND_SECONDS : 0);
          if (
            isAuthError(cause) ||
            code === 'IDENTITY_MISMATCH' ||
            retryAfter
          ) {
            setScreen({
              ...previous,
              outcomeNeedsSignIn:
                previous.outcomeNeedsSignIn ||
                isAuthError(cause) ||
                code === 'IDENTITY_MISMATCH',
              outcomeCheckAfter: retryAfter
                ? otpCooldownDeadline(retryAfter)
                : previous.outcomeCheckAfter,
            });
          }
        }
        handleError(cause);
      }
    });
  }

  function checkStatus() {
    if (
      screen.step !== 'result' ||
      !channel.current ||
      !screen.proof ||
      globalThis.performance.now() < resultCheckAfter ||
      !hasActiveInvitation()
    ) {
      return;
    }
    const { client } = channel.current;
    const { proof } = screen;
    const previous = screen;
    run((isCurrent) => loadResult(client, previous, proof, isCurrent));
  }

  function reauthenticate() {
    if (
      screen.step === 'result' &&
      channel.current &&
      !screen.proof &&
      globalThis.performance.now() >= resultCheckAfter &&
      hasActiveInvitation()
    ) {
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

  function editCode() {
    setError((previous) =>
      previous?.code === 'OTP_INVALID' ? undefined : previous,
    );
  }

  return {
    screen,
    error,
    busy,
    submittingDelete: busyAction === 'delete',
    resultCheckAfter,
    open,
    signIn,
    sendDeletionOtp,
    editCode,
    submit,
    checkDeleteOutcome,
    checkStatus,
    reauthenticate,
  };
}
