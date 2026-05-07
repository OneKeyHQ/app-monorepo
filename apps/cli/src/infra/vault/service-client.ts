import axios from 'axios';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import { LOCK_TIMEOUT_MS, REVOKE_TIMEOUT_MS } from './constants';

export const BOT_WALLET_KEY_SERVICE_BASE_URL = 'http://127.0.0.1:8787';

export type IFetchBotWalletKeyInput = {
  keyId: string;
  accessToken: string;
  signal?: AbortSignal;
};

export type IFetchBotWalletKeyResult = {
  keyBase64: string;
};

export type IServiceSelfHealReason =
  | 'TOKEN_INVALID'
  | 'REVOKED'
  | 'KEY_NOT_FOUND';

export type IServiceFailSecureReason = 'SERVICE_UNREACHABLE';

export type IServiceFailSecureCause = {
  code?: string;
  message?: string;
};

export type IServiceResponse =
  | { kind: 'ok'; keyBase64: string }
  | { kind: 'self-heal'; reason: IServiceSelfHealReason }
  | {
      kind: 'fail-secure';
      reason: IServiceFailSecureReason;
      cause?: IServiceFailSecureCause;
    };

type IServiceWarningError = {
  code?: string;
  message: string;
  name?: string;
  status?: number;
};

type IWarnLogger = (
  event: string,
  fields: { error: IServiceWarningError; keyId: string },
) => void;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function getHttpStatus(error: unknown): number | undefined {
  if (!isRecord(error)) {
    return undefined;
  }
  const response = error.response;
  if (!isRecord(response)) {
    return undefined;
  }
  return typeof response.status === 'number' ? response.status : undefined;
}

function hasValidKeyBase64(data: unknown): data is IFetchBotWalletKeyResult {
  return (
    isRecord(data) &&
    typeof data.keyBase64 === 'string' &&
    data.keyBase64.length > 0
  );
}

function getStringField(
  value: Record<string, unknown>,
  field: string,
): string | undefined {
  const fieldValue = value[field];
  return typeof fieldValue === 'string' ? fieldValue : undefined;
}

function extractServiceFailureCause(error: unknown): IServiceFailSecureCause {
  if (!isRecord(error)) {
    if (typeof error === 'string' && error.length > 0) {
      return { message: error };
    }
    return {};
  }
  const cause: IServiceFailSecureCause = {};
  const code = getStringField(error, 'code');
  if (code) {
    cause.code = code;
  }
  const message = getStringField(error, 'message');
  if (message) {
    cause.message = message;
  }
  const status = getHttpStatus(error);
  if (status !== undefined) {
    cause.message = cause.message
      ? `${cause.message} (HTTP ${status})`
      : `HTTP ${status}`;
  }
  return cause;
}

function mapServiceError(error: unknown): IServiceResponse {
  switch (getHttpStatus(error)) {
    case 401:
      return { kind: 'self-heal', reason: 'TOKEN_INVALID' };
    case 403:
      return { kind: 'self-heal', reason: 'REVOKED' };
    case 404:
      return { kind: 'self-heal', reason: 'KEY_NOT_FOUND' };
    default:
      return {
        kind: 'fail-secure',
        reason: 'SERVICE_UNREACHABLE',
        cause: extractServiceFailureCause(error),
      };
  }
}

function toServiceWarningError(error: unknown): IServiceWarningError {
  const fallbackMessage = 'Bot Wallet key service request failed';
  if (!isRecord(error)) {
    return {
      message: typeof error === 'string' ? error : fallbackMessage,
    };
  }

  const warningError: IServiceWarningError = {
    message: getStringField(error, 'message') ?? fallbackMessage,
  };
  const code = getStringField(error, 'code');
  const name = getStringField(error, 'name');
  const status = getHttpStatus(error);
  if (code !== undefined) {
    warningError.code = code;
  }
  if (name !== undefined) {
    warningError.name = name;
  }
  if (status !== undefined) {
    warningError.status = status;
  }
  return warningError;
}

export async function serviceFetch({
  keyId,
  accessToken,
  signal,
}: IFetchBotWalletKeyInput): Promise<IServiceResponse> {
  try {
    const response = await axios.get<IFetchBotWalletKeyResult>(
      `${BOT_WALLET_KEY_SERVICE_BASE_URL}/v1/bot-wallet-keys/${encodeURIComponent(
        keyId,
      )}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        signal: signal ?? AbortSignal.timeout(LOCK_TIMEOUT_MS),
      },
    );

    if (!hasValidKeyBase64(response.data)) {
      return {
        kind: 'fail-secure',
        reason: 'SERVICE_UNREACHABLE',
        cause: {
          message: 'service returned an invalid key payload',
        },
      };
    }

    return { kind: 'ok', keyBase64: response.data.keyBase64 };
  } catch (error) {
    return mapServiceError(error);
  }
}

export async function fetchBotWalletKey({
  keyId,
  accessToken,
  signal,
}: IFetchBotWalletKeyInput): Promise<IFetchBotWalletKeyResult> {
  const response = await serviceFetch({ keyId, accessToken, signal });
  if (response.kind !== 'ok') {
    throw new OneKeyLocalError(response.reason);
  }
  return { keyBase64: response.keyBase64 };
}

export type IRevokeBotWalletKeyInput = IFetchBotWalletKeyInput & {
  signal?: AbortSignal;
  warn?: IWarnLogger;
};

export async function serviceRevoke({
  keyId,
  accessToken,
  signal,
  warn,
}: IRevokeBotWalletKeyInput): Promise<void> {
  try {
    await axios.post(
      `${BOT_WALLET_KEY_SERVICE_BASE_URL}/v1/bot-wallet-keys/${encodeURIComponent(
        keyId,
      )}/revoke`,
      undefined,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        signal: signal ?? AbortSignal.timeout(REVOKE_TIMEOUT_MS),
      },
    );
  } catch (error) {
    warn?.('service.revoke.failed', {
      error: toServiceWarningError(error),
      keyId,
    });
  }
}

export async function revokeBotWalletKey(
  input: IRevokeBotWalletKeyInput,
): Promise<void> {
  await serviceRevoke(input);
}
