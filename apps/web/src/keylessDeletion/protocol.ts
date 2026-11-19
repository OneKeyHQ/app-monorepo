import type { IOneKeyAPIBaseResponse } from '@onekeyhq/shared/types/request';

import {
  DeletionBusinessError,
  type IBusinessNotice,
} from './deletionBusinessError';

export const API_BASE = '/prime/v1/keyless-deletion';
export const DELETION_ROUTES = [
  '/link-info',
  '/otp/send',
  '/delete',
  '/result',
] as const;
export type IDeletionRoute = (typeof DELETION_ROUTES)[number];
export const DELETION_SCOPE = 'onekey_server_share';
export const RETAINED_SCOPE = [
  'juicebox_share',
  'cloud_sync',
  'onekey_id',
] as const;
export const WARNING_CODES = ['recovery_lost', 'new_wallet_separate'] as const;
export const CONFIRMATION_VERSION = 'keyless-server-share-deletion/v1';
export const UPDATED_CONFIRMATION_VERSION = 'keyless-server-share-deletion/v2';
export const OTP_RESEND_SECONDS = 60;
const REQUEST_TIMEOUT_MS = 1500;

export const RECREATION_POLICIES = [
  'allowed_new_wallet',
  'blocked',
  'pending_decision',
] as const;
export const PROVIDERS = ['google', 'apple'] as const;

export type IRecreationPolicy = (typeof RECREATION_POLICIES)[number];
export type IProvider = (typeof PROVIDERS)[number];
export type IWarningCode = (typeof WARNING_CODES)[number];

export function getConfirmationWarnings(
  version: unknown,
): readonly IWarningCode[] | undefined {
  if (
    version === CONFIRMATION_VERSION ||
    version === UPDATED_CONFIRMATION_VERSION
  ) {
    return WARNING_CODES;
  }
  return undefined;
}

export function matchesWarnings(
  value: unknown,
  expected: readonly IWarningCode[],
) {
  return matchesSet(value, expected);
}

export interface ILinkInfo {
  status: 'ready' | 'used';
  allowedProvider: IProvider;
  expiresAt: string;
  serverTime: string;
  confirmationVersion: string;
  deletionScope: [typeof DELETION_SCOPE];
  retainedScope: (typeof RETAINED_SCOPE)[number][];
  warningCodes: IWarningCode[];
  recreationPolicy: IRecreationPolicy;
}

export interface IProof {
  invitationToken: string;
  provider: IProvider;
  supabaseAccessToken: string;
}

export interface IActiveChallenge {
  challengeId: string;
  maskedEmail: string;
  expiresAt: string;
  serverTime: string;
}

export interface IChallenge extends IActiveChallenge {
  resendAfterSeconds: number;
}

export interface IDeleteRequest extends IProof {
  challengeId: string;
  code: string;
  confirmationVersion: string;
  acknowledgements: IWarningCode[];
}

export interface ICompleted {
  status: 'completed';
  resultId: string;
  completedAt: string;
  deletedScope: ILinkInfo['deletionScope'];
  retainedScope: ILinkInfo['retainedScope'];
  supportReference: string;
}

export type IResult =
  | { status: 'not_submitted' }
  | {
      status: 'processing';
      resultId: string;
      retryAfterSeconds: number;
      supportReference: string;
    }
  | ICompleted
  | {
      status: 'manual_review_required';
      resultId: string;
      supportReference: string;
    };

export const ERROR_CODES = [
  'INVITATION_UNAVAILABLE',
  'AUTH_INVALID',
  'AUTH_EXPIRED',
  'IDENTITY_MISMATCH',
  'OTP_INVALID',
  'OTP_EXPIRED',
  'RATE_LIMITED',
  'CONFIRMATION_REQUIRED',
  'CONFIRMATION_CHANGED',
  'TARGET_CHANGED',
  'DELETION_DISABLED',
  'INVALID_REQUEST',
  'IDEMPOTENCY_CONFLICT',
  'OPERATION_IN_PROGRESS',
  'MANUAL_REVIEW_REQUIRED',
  'SERVICE_UNAVAILABLE',
] as const;

export type IErrorCode = (typeof ERROR_CODES)[number];

export const PRIME_DELETION_ERRORS: Readonly<
  Partial<Record<number, IErrorCode>>
> = {
  90_001: 'INVALID_REQUEST',
  90_900: 'INVITATION_UNAVAILABLE',
  90_901: 'AUTH_INVALID',
  90_902: 'AUTH_EXPIRED',
  90_903: 'IDENTITY_MISMATCH',
  90_904: 'OTP_INVALID',
  90_905: 'OTP_EXPIRED',
  90_906: 'RATE_LIMITED',
  90_907: 'CONFIRMATION_REQUIRED',
  90_908: 'CONFIRMATION_CHANGED',
  90_909: 'TARGET_CHANGED',
  90_910: 'DELETION_DISABLED',
  90_911: 'IDEMPOTENCY_CONFLICT',
  90_912: 'OPERATION_IN_PROGRESS',
  90_913: 'MANUAL_REVIEW_REQUIRED',
  90_914: 'SERVICE_UNAVAILABLE',
  90_915: 'INVALID_REQUEST',
};

export interface IErrorResponse {
  code: IErrorCode;
  retryAfterSeconds?: number;
  supportReference?: string;
}

export class DeletionError extends Error {
  constructor(
    public readonly response: IErrorResponse,
    public readonly notice?: IBusinessNotice,
  ) {
    super(response.code);
  }
}

export type ITransport = (request: Request) => Promise<Response>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isUtcTimestamp(value: unknown): value is string {
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|\+00:00)$/.test(value)
  ) {
    return false;
  }
  const timestamp = Date.parse(value);
  return (
    Number.isFinite(timestamp) &&
    new Date(timestamp).toISOString().slice(0, 19) === value.slice(0, 19)
  );
}

function isSeconds(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function matchesSet(value: unknown, expected: readonly string[]) {
  return (
    Array.isArray(value) &&
    value.length === expected.length &&
    expected.every((scope) => value.includes(scope))
  );
}

function isLinkInfo(data: unknown): data is ILinkInfo {
  if (!isRecord(data)) {
    return false;
  }
  const warnings = getConfirmationWarnings(data.confirmationVersion);
  if (!warnings || !matchesWarnings(data.warningCodes, warnings)) {
    throw new DOMException(
      'Unsupported confirmation content.',
      'NotSupportedError',
    );
  }
  return (
    (data.status === 'ready' || data.status === 'used') &&
    PROVIDERS.some((provider) => provider === data.allowedProvider) &&
    isUtcTimestamp(data.expiresAt) &&
    isUtcTimestamp(data.serverTime) &&
    Date.parse(data.expiresAt) > Date.parse(data.serverTime) &&
    matchesSet(data.deletionScope, [DELETION_SCOPE]) &&
    matchesSet(data.retainedScope, RETAINED_SCOPE) &&
    RECREATION_POLICIES.some((policy) => policy === data.recreationPolicy) &&
    Object.keys(data).length === 9
  );
}

function hasChallengeFields(data: Record<string, unknown>) {
  return (
    isText(data.challengeId) &&
    isText(data.maskedEmail) &&
    isUtcTimestamp(data.expiresAt) &&
    isUtcTimestamp(data.serverTime) &&
    Date.parse(data.expiresAt) > Date.parse(data.serverTime)
  );
}

function isChallenge(data: unknown): data is IChallenge {
  return (
    isRecord(data) &&
    hasChallengeFields(data) &&
    isSeconds(data.resendAfterSeconds) &&
    Object.keys(data).length === 5
  );
}

function isCompleted(data: unknown): data is ICompleted {
  return (
    isRecord(data) &&
    data.status === 'completed' &&
    isText(data.resultId) &&
    isText(data.supportReference) &&
    isUtcTimestamp(data.completedAt) &&
    matchesSet(data.deletedScope, [DELETION_SCOPE]) &&
    matchesSet(data.retainedScope, RETAINED_SCOPE) &&
    Object.keys(data).length === 6
  );
}

function isResult(data: unknown): data is IResult {
  if (!isRecord(data)) {
    return false;
  }
  if (data.status === 'completed') {
    return isCompleted(data);
  }
  if (
    'completedAt' in data ||
    'deletedScope' in data ||
    'retainedScope' in data
  ) {
    return false;
  }
  if (data.status === 'not_submitted') {
    return Object.keys(data).length === 1;
  }
  return (
    isText(data.resultId) &&
    isText(data.supportReference) &&
    ((data.status === 'manual_review_required' &&
      Object.keys(data).length === 3) ||
      (data.status === 'processing' &&
        isSeconds(data.retryAfterSeconds) &&
        Object.keys(data).length === 4))
  );
}

type IDeletionEnvelope = Omit<IOneKeyAPIBaseResponse<unknown>, 'data'> & {
  data?: unknown;
  retryAfterSec?: unknown;
};

function isApiEnvelope(value: unknown): value is IDeletionEnvelope {
  return (
    isRecord(value) &&
    typeof value.code === 'number' &&
    Number.isSafeInteger(value.code) &&
    typeof value.message === 'string' &&
    (value.messageId === undefined || typeof value.messageId === 'string') &&
    (value.translatedMessage === undefined ||
      typeof value.translatedMessage === 'string') &&
    (value.disableAutoToast === undefined ||
      typeof value.disableAutoToast === 'boolean') &&
    (value.stopPolling === undefined || typeof value.stopPolling === 'boolean')
  );
}

function getSafeMessage(value: unknown, secrets: unknown[]) {
  if (typeof value !== 'string') {
    return undefined;
  }
  const message = value.trim();
  if (
    !message ||
    message.length > 300 ||
    /[<>{}\r\n\t\u202a-\u202e\u2066-\u2069]|&(?:#\w+|[a-z]+);/i.test(message) ||
    /https?:|\b(?:request.?id|authorization|bearer|invitation.?token|(?:supabase)?access.?token|refresh.?token|challenge.?id|idempotency.?key|password|mnemonic|private.?key|stack.?trace|traceback)\b|\b[a-z]*error\s*:|\b[\da-f]{8}(?:-[\da-f]+){4}\b|\b[\da-f]{32,}\b|\beyJ[\w-]+\.[\w.-]+/i.test(
      message,
    ) ||
    /\b\S+@\S+\.\S+\b|\/prime\/|\b(?:curl|GET|POST)\s+\/|(?:验证码|访问令牌|邀请令牌|私钥|助记词)\s*[:：=]/.test(
      message,
    ) ||
    secrets.some(
      (secret) =>
        typeof secret === 'string' &&
        (message === secret ||
          (secret.length >= 4 && message.includes(secret))),
    )
  ) {
    return undefined;
  }
  return message;
}

function retryAfterHeader(headers: Headers) {
  const value = headers.get('Retry-After')?.trim();
  if (!value) {
    return undefined;
  }
  if (/^\d+$/.test(value)) {
    const seconds = Number(value);
    return Number.isSafeInteger(seconds) ? seconds : undefined;
  }
  const date = Date.parse(value);
  const serverTime = Date.parse(headers.get('Date') ?? '');
  return Number.isFinite(date)
    ? Math.max(
        0,
        Math.ceil(
          (date - (Number.isFinite(serverTime) ? serverTime : Date.now())) /
            1000,
        ),
      )
    : undefined;
}

function availableBackoff(value: unknown, headers: Headers) {
  const headerSeconds = retryAfterHeader(headers);
  if (isSeconds(value)) {
    return Math.max(value, headerSeconds ?? 0);
  }
  return headerSeconds;
}

function parseError(
  envelope: IDeletionEnvelope,
  response: Response,
  secrets: unknown[],
) {
  const { status, headers } = response;
  if (status !== 200 && (status < 400 || status > 599)) {
    return undefined;
  }
  const notice = {
    userMessage:
      getSafeMessage(envelope.translatedMessage, secrets) ??
      getSafeMessage(envelope.message, secrets),
    disableAutoToast: envelope.disableAutoToast === true,
  };
  const details = isRecord(envelope.data) ? envelope.data : {};
  const wireError = PRIME_DELETION_ERRORS[envelope.code];
  const code = status === 429 ? 'RATE_LIMITED' : wireError;
  if (code && (status < 500 || code === 'SERVICE_UNAVAILABLE')) {
    const supportReference = getSafeMessage(details.supportReference, secrets);
    if (code === 'MANUAL_REVIEW_REQUIRED' && !supportReference) {
      return undefined;
    }
    const retryAfterSeconds =
      availableBackoff(envelope.retryAfterSec, headers) ??
      (code === 'RATE_LIMITED' ? OTP_RESEND_SECONDS : undefined);
    return new DeletionError(
      { code, retryAfterSeconds, supportReference },
      notice,
    );
  }
  return new DeletionBusinessError(envelope.code, status, notice);
}

function unstructuredRateLimit(response: Response) {
  return new DeletionError({
    code: 'RATE_LIMITED',
    retryAfterSeconds: retryAfterHeader(response.headers) ?? OTP_RESEND_SECONDS,
  });
}

function proofFields({
  invitationToken,
  provider,
  supabaseAccessToken,
}: IProof): IProof {
  return { invitationToken, provider, supabaseAccessToken };
}

export function createDeletionClient(
  transport: ITransport,
  {
    signal,
    timeoutMs = REQUEST_TIMEOUT_MS,
    origin,
  }: {
    signal?: AbortSignal;
    timeoutMs?: number;
    origin: string;
  },
) {
  async function request<T>(
    route: IDeletionRoute,
    body: object,
    isValid: (value: unknown) => value is T,
    idempotencyKey?: string,
  ): Promise<T> {
    signal?.throwIfAborted();
    const controller = new AbortController();
    const cancel = () =>
      controller.abort(new DOMException('Request cancelled.', 'AbortError'));
    signal?.addEventListener('abort', cancel, { once: true });
    const timeout = globalThis.setTimeout(
      () =>
        controller.abort(
          new DOMException('Request deadline exceeded.', 'TimeoutError'),
        ),
      timeoutMs,
    );
    const deadline = new Promise<never>((_resolve, reject) => {
      controller.signal.addEventListener(
        'abort',
        () => reject(controller.signal.reason),
        { once: true },
      );
    });
    const headers = new Headers({
      Accept: 'application/json',
      'Content-Type': 'application/json',
    });
    if (idempotencyKey) {
      headers.set('Idempotency-Key', idempotencyKey);
    }
    async function readResponse() {
      const response = await transport(
        new Request(`${origin}${API_BASE}${route}`, {
          method: 'POST',
          credentials: 'omit',
          headers,
          body: JSON.stringify(body),
          signal: controller.signal,
        }),
      );
      controller.signal.throwIfAborted();
      if (
        response.headers.get('content-type')?.split(';')[0]?.trim() !==
        'application/json'
      ) {
        if (response.status === 429) {
          throw unstructuredRateLimit(response);
        }
        throw new SyntaxError('Unknown deletion response content type.');
      }
      const envelope: unknown = await response
        .json()
        .catch((error: unknown) => {
          throw response.status === 429
            ? unstructuredRateLimit(response)
            : error;
        });
      if (!isApiEnvelope(envelope)) {
        if (response.status === 429) {
          throw unstructuredRateLimit(response);
        }
        throw new SyntaxError('Unknown deletion API envelope.');
      }
      if (envelope.code !== 0) {
        const secrets = isRecord(body)
          ? [
              body.invitationToken,
              body.supabaseAccessToken,
              body.challengeId,
              body.code,
              idempotencyKey,
            ]
          : [];
        const error = parseError(envelope, response, secrets);
        throw error ?? new SyntaxError('Unknown deletion error response.');
      }
      if (
        response.status !== 200 ||
        ERROR_CODES.some((code) => code === envelope.messageId) ||
        !isValid(envelope.data)
      ) {
        if (response.status === 429) {
          throw unstructuredRateLimit(response);
        }
        throw new SyntaxError('Unknown deletion success response.');
      }
      return envelope.data;
    }
    try {
      return await Promise.race([readResponse(), deadline]);
    } finally {
      globalThis.clearTimeout(timeout);
      signal?.removeEventListener('abort', cancel);
    }
  }

  return {
    getLinkInfo: (invitationToken: string) =>
      request('/link-info', { invitationToken }, isLinkInfo),
    sendDeletionOtp: (body: IProof) =>
      request('/otp/send', proofFields(body), isChallenge),
    deleteShare: async (
      {
        challengeId,
        code,
        confirmationVersion,
        acknowledgements,
        ...proof
      }: IDeleteRequest,
      idempotencyKey: string,
    ) => {
      const warnings = getConfirmationWarnings(confirmationVersion);
      const uniqueAcknowledgements = [...new Set(acknowledgements)];
      if (!warnings || !matchesWarnings(uniqueAcknowledgements, warnings)) {
        throw new DOMException(
          'Unsupported confirmation content.',
          'NotSupportedError',
        );
      }
      return request(
        '/delete',
        {
          ...proofFields(proof),
          challengeId,
          code,
          confirmationVersion,
          acknowledgements: uniqueAcknowledgements,
        },
        isCompleted,
        idempotencyKey,
      );
    },
    getResult: (body: IProof) =>
      request('/result', proofFields(body), isResult),
  };
}

export type IDeletionClient = ReturnType<typeof createDeletionClient>;
