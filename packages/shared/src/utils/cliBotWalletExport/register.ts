import {
  EServiceEndpointEnum,
  type IApiClientResponse,
} from '../../../types/endpoint';
import { appApiClient } from '../../appApiClient/appApiClient';
import { getEndpointByServiceName } from '../../config/endpointsMap';
import { OneKeyLocalError } from '../../errors';

import { isBotWalletHash } from './botWalletHash';
import {
  BOT_WALLET_KEY_API_PATH,
  BOT_WALLET_KEY_API_TOKEN_HEADER,
} from './botWalletKeyApiConsts';

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
  endpoint: string,
  cause: unknown,
): OneKeyLocalError {
  const reason = describeKeyServiceFailure(cause);
  const error = new OneKeyLocalError(
    `Cannot reach Bot Wallet key API at ${endpoint} (${reason}). Check network connectivity and retry.`,
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
  post: <T = unknown, R = { data: T }>(
    url: string,
    body?: unknown,
    config?: {
      headers?: Record<string, string>;
      signal?: AbortSignal;
      timeout?: number;
    },
  ) => Promise<R>;
};

export type IRegisterKeyResponse = {
  keyId: string;
  accessToken: string;
};

export type IRegisterKeyInput = {
  botWalletHash: string;
  keyBase64: string;
};

export type ICliBotWalletKeyClientLogger = {
  warn: (message: string, ...rest: unknown[]) => void;
};

const defaultLogger: ICliBotWalletKeyClientLogger = {
  // eslint-disable-next-line no-console
  warn: (message, ...rest) => console.warn(message, ...rest),
};

export type ICliBotWalletKeyClientOptions = {
  /** Override the Prime service endpoint. Mostly used by tests/dev tooling. */
  baseUrl?: string;
  /** Inject an HTTP client (used by tests). Default: OneKey app API client. */
  http?: ICliBotWalletKeyHttpClient;
  /** Inject a logger; default `console.warn`. Tests pass a spyable object. */
  logger?: ICliBotWalletKeyClientLogger;
};

async function getPrimeServiceEndpoint(baseUrl?: string): Promise<string> {
  return baseUrl ?? getEndpointByServiceName(EServiceEndpointEnum.Prime);
}

async function getPrimeServiceHttpClient({
  baseUrl,
  http,
}: Pick<ICliBotWalletKeyClientOptions, 'baseUrl' | 'http'>): Promise<{
  endpoint: string;
  http: ICliBotWalletKeyHttpClient;
}> {
  const endpoint = await getPrimeServiceEndpoint(baseUrl);
  if (http) {
    return { endpoint, http };
  }
  const client = await appApiClient.getRawDataClient({
    endpoint,
    name: EServiceEndpointEnum.Prime,
  });
  return {
    endpoint,
    http: client as unknown as ICliBotWalletKeyHttpClient,
  };
}

function unwrapApiResponse<T>({
  response,
  endpoint,
}: {
  response: IApiClientResponse<T>;
  endpoint: string;
}): T {
  if (
    typeof response !== 'object' ||
    response === null ||
    typeof response.code !== 'number'
  ) {
    throw new OneKeyLocalError(
      `Bot Wallet key API at ${endpoint} returned a malformed response envelope.`,
    );
  }
  if (response.code !== 0) {
    throw new OneKeyLocalError(
      `Bot Wallet key API error (code ${response.code}): ${
        response.message || 'Unknown error'
      }`,
    );
  }
  return response.data;
}

/**
 * POST /prime/v1/bot-wallet-keys with **only**
 * `{ botWalletHash, keyBase64 }`.
 *
 * The body field set is asserted by tests to be exactly
 * `['botWalletHash', 'keyBase64']` — there is no opportunity for ciphertext,
 * raw walletId, displayAddress, etc. to leak across the network boundary into
 * the API request log.
 */
export async function registerKey(
  input: IRegisterKeyInput,
  options: ICliBotWalletKeyClientOptions = {},
): Promise<IRegisterKeyResponse> {
  if (!isBotWalletHash(input.botWalletHash)) {
    throw new OneKeyLocalError('Bot Wallet key API requires botWalletHash');
  }
  const { endpoint, http } = await getPrimeServiceHttpClient(options);
  const body: IRegisterKeyInput = {
    botWalletHash: input.botWalletHash,
    keyBase64: input.keyBase64,
  };
  let res: { data: IApiClientResponse<IRegisterKeyResponse> };
  try {
    res = await http.post<
      IApiClientResponse<IRegisterKeyResponse>,
      { data: IApiClientResponse<IRegisterKeyResponse> }
    >(BOT_WALLET_KEY_API_PATH, body, {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    throw buildKeyServiceUnreachableError(endpoint, err);
  }
  const data = unwrapApiResponse({
    response: res.data,
    endpoint,
  });
  if (
    typeof data?.keyId !== 'string' ||
    typeof data?.accessToken !== 'string'
  ) {
    throw new OneKeyLocalError(
      `Bot Wallet key API at ${endpoint} returned a malformed response (missing keyId or accessToken).`,
    );
  }
  return { keyId: data.keyId, accessToken: data.accessToken };
}

/**
 * Best-effort POST /prime/v1/bot-wallet-keys/:keyId/revoke. **Never throws** — any
 * failure (network / 4xx / 5xx / timeout) is swallowed and surfaced as a
 * single `logger.warn` call.
 */
export async function revokeKey(
  keyId: string,
  accessToken: string,
  options: ICliBotWalletKeyClientOptions = {},
): Promise<void> {
  const logger = options.logger ?? defaultLogger;
  try {
    const { http } = await getPrimeServiceHttpClient(options);
    await http.post(
      `${BOT_WALLET_KEY_API_PATH}/${encodeURIComponent(keyId)}/revoke`,
      undefined,
      {
        headers: { [BOT_WALLET_KEY_API_TOKEN_HEADER]: accessToken },
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
  BOT_WALLET_KEY_API_PATH,
  BOT_WALLET_KEY_API_TOKEN_HEADER,
} as const;
