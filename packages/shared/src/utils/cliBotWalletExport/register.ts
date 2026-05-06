import axios from 'axios';

import { OneKeyLocalError } from '../../errors';

const DEFAULT_BASE_URL = 'http://127.0.0.1:8787';
const REGISTER_TIMEOUT_MS = 3000;
const REVOKE_TIMEOUT_MS = 3000;

function describeKeyServiceFailure(err: unknown): string {
  if (err && typeof err === 'object') {
    const errObj = err as {
      code?: unknown;
      message?: unknown;
      name?: unknown;
      response?: unknown;
    };
    const code = typeof errObj.code === 'string' ? errObj.code : undefined;
    const name = typeof errObj.name === 'string' ? errObj.name : '';
    const message = typeof errObj.message === 'string' ? errObj.message : '';

    if (code === 'ECONNREFUSED' || /ECONNREFUSED/.test(message)) {
      return 'connection refused';
    }
    if (code === 'ECONNRESET' || /ECONNRESET/.test(message)) {
      return 'connection reset';
    }
    if (
      code === 'ETIMEDOUT' ||
      code === 'ECONNABORTED' ||
      name === 'AbortError' ||
      name === 'TimeoutError' ||
      name === 'CanceledError' ||
      /timeout|timed out/i.test(message)
    ) {
      return 'request timed out';
    }
    if (code === 'ENETUNREACH' || /ENETUNREACH/.test(message)) {
      return 'network unreachable';
    }
    if (code === 'EHOSTUNREACH' || /EHOSTUNREACH/.test(message)) {
      return 'host unreachable';
    }
    if (code === 'ENOTFOUND' || /ENOTFOUND/.test(message)) {
      return 'host not found';
    }

    const response = errObj.response;
    if (response && typeof response === 'object') {
      const status = (response as { status?: unknown }).status;
      if (typeof status === 'number') {
        return `HTTP ${status}`;
      }
    }

    if (message) {
      return message;
    }
    if (code) {
      return code;
    }
  }
  if (typeof err === 'string' && err.length > 0) {
    return err;
  }
  return 'unknown network error';
}

function buildKeyServiceUnreachableError(
  baseUrl: string,
  cause: unknown,
): OneKeyLocalError {
  const reason = describeKeyServiceFailure(cause);
  const error = new OneKeyLocalError(
    `Cannot reach Bot Wallet key service at ${baseUrl} (${reason}). Make sure the local Bot Wallet key service is running on ${baseUrl}, then retry.`,
  );
  if (cause !== undefined) {
    Object.defineProperty(error, 'cause', {
      value: cause,
      enumerable: false,
      configurable: true,
      writable: true,
    });
  }
  return error;
}

/**
 * Minimal structural shape of the HTTP client this module needs. Lets tests
 * inject a plain `{ post: jest.fn() }` without having to satisfy axios's full
 * `AxiosInstance` type surface.
 */
export type ICliBotWalletKeyHttpClient = {
  post: <T = unknown>(
    url: string,
    body?: unknown,
    config?: {
      headers?: Record<string, string>;
      signal?: AbortSignal;
      timeout?: number;
    },
  ) => Promise<{ data: T }>;
};

export type IRegisterKeyResponse = {
  keyId: string;
  accessToken: string;
};

export type ICliBotWalletKeyClientLogger = {
  warn: (message: string, ...rest: unknown[]) => void;
};

const defaultLogger: ICliBotWalletKeyClientLogger = {
  // eslint-disable-next-line no-console
  warn: (message, ...rest) => console.warn(message, ...rest),
};

export type ICliBotWalletKeyClientOptions = {
  /** Override the service base URL. Default: `http://127.0.0.1:8787`. */
  baseUrl?: string;
  /** Inject an HTTP client (used by tests). Default: top-level `axios`. */
  http?: ICliBotWalletKeyHttpClient;
  /** Inject a logger; default `console.warn`. Tests pass a spyable object. */
  logger?: ICliBotWalletKeyClientLogger;
};

/**
 * POST /v1/bot-wallet-keys with **only** `{ keyBase64 }`.
 *
 * The body field set is asserted by tests to be exactly `['keyBase64']` —
 * there is no opportunity for ciphertext, walletId, displayAddress, etc. to
 * leak across the network boundary into the service's request log.
 */
export async function registerKey(
  keyBase64: string,
  options: ICliBotWalletKeyClientOptions = {},
): Promise<IRegisterKeyResponse> {
  const baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
  const http: ICliBotWalletKeyHttpClient =
    options.http ?? (axios as unknown as ICliBotWalletKeyHttpClient);
  const body: { keyBase64: string } = { keyBase64 };
  let res: { data: IRegisterKeyResponse };
  try {
    res = await http.post<IRegisterKeyResponse>(
      `${baseUrl}/v1/bot-wallet-keys`,
      body,
      {
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(REGISTER_TIMEOUT_MS),
        timeout: REGISTER_TIMEOUT_MS,
      },
    );
  } catch (err) {
    throw buildKeyServiceUnreachableError(baseUrl, err);
  }
  if (
    typeof res.data?.keyId !== 'string' ||
    typeof res.data?.accessToken !== 'string'
  ) {
    throw new OneKeyLocalError(
      `Bot Wallet key service at ${baseUrl} returned a malformed response (missing keyId or accessToken).`,
    );
  }
  return { keyId: res.data.keyId, accessToken: res.data.accessToken };
}

/**
 * Best-effort POST /v1/bot-wallet-keys/:keyId/revoke. **Never throws** — any
 * failure (network / 4xx / 5xx / timeout) is swallowed and surfaced as a
 * single `logger.warn` call. Hard-capped at 3s with `AbortSignal.timeout`
 * so that a wedged service cannot block the rollback path.
 */
export async function revokeKey(
  keyId: string,
  accessToken: string,
  options: ICliBotWalletKeyClientOptions = {},
): Promise<void> {
  const baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
  const http: ICliBotWalletKeyHttpClient =
    options.http ?? (axios as unknown as ICliBotWalletKeyHttpClient);
  const logger = options.logger ?? defaultLogger;
  try {
    await http.post(
      `${baseUrl}/v1/bot-wallet-keys/${encodeURIComponent(keyId)}/revoke`,
      undefined,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        signal: AbortSignal.timeout(REVOKE_TIMEOUT_MS),
        timeout: REVOKE_TIMEOUT_MS,
      },
    );
  } catch (e) {
    logger.warn(
      `cliBotWalletExport.revokeKey: best-effort revoke failed for keyId=${keyId} (suppressed)`,
      (e as Error)?.message ?? e,
    );
  }
}

/** Constants exported for tests. */
export const CLI_BOT_WALLET_CLIENT_INTERNALS = {
  DEFAULT_BASE_URL,
  REGISTER_TIMEOUT_MS,
  REVOKE_TIMEOUT_MS,
} as const;
