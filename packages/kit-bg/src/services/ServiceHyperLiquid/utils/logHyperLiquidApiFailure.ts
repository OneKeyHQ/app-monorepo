import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import {
  type IHyperLiquidAccountContext,
  type IHyperLiquidApiFailureEndpoint,
  extractHyperLiquidErrorResponse,
  serializeHyperLiquidError,
} from '@onekeyhq/shared/src/logger/scopes/perp/scenes/hyperliquid';
import { extractHyperLiquidErrorMessage } from '@onekeyhq/shared/src/utils/hyperLiquidErrorResolver';

type IContextProvider =
  | Partial<IHyperLiquidAccountContext>
  | (() =>
      | Partial<IHyperLiquidAccountContext>
      | Promise<Partial<IHyperLiquidAccountContext>>);

type ILogHyperLiquidApiFailureParams = {
  endpoint: IHyperLiquidApiFailureEndpoint;
  action: string;
  request?: unknown;
  response?: unknown;
  error: unknown;
  context?: IContextProvider;
  extra?: Record<string, unknown>;
};

type ILogHyperLiquidClientFailureParams = {
  action: string;
  request: unknown;
  error: unknown;
};

const REDACTED = '[Redacted]';
const MAX_SANITIZE_DEPTH = 8;
const SENSITIVE_KEYS = new Set([
  'signature',
  'signedRequest',
  'signedPayload',
  'privateKey',
  'mnemonic',
  'seed',
  'secret',
]);

function getSingleRequestArg(args: unknown[]): unknown {
  if (args.length === 0) {
    return undefined;
  }
  return args.length === 1 ? args[0] : args;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function isHyperLiquidErrorResult(
  result: unknown,
): result is { status: 'err'; response?: unknown } {
  return isRecord(result) && result.status === 'err';
}

function createHyperLiquidErrorResultError(result: unknown) {
  return new Error(
    extractHyperLiquidErrorMessage({ response: result }) ||
      'HyperLiquid API returned error status',
  );
}

function sanitizePayload(
  payload: unknown,
  seen = new WeakSet<object>(),
  depth = 0,
): unknown {
  if (!payload || typeof payload !== 'object') {
    return payload;
  }

  if (depth >= MAX_SANITIZE_DEPTH) {
    return '[MaxDepth]';
  }

  if (seen.has(payload)) {
    return '[Circular]';
  }
  seen.add(payload);

  if (Array.isArray(payload)) {
    return payload.map((item) => sanitizePayload(item, seen, depth + 1));
  }

  const result: Record<string, unknown> = {};
  Object.entries(payload as Record<string, unknown>).forEach(([key, value]) => {
    if (SENSITIVE_KEYS.has(key)) {
      result[key] = REDACTED;
      return;
    }
    result[key] = sanitizePayload(value, seen, depth + 1);
  });
  return result;
}

function normalizeResponse(response: unknown): unknown {
  if (!isRecord(response)) {
    return response;
  }

  if (
    'data' in response &&
    ('status' in response || 'statusText' in response)
  ) {
    return {
      status: response.status,
      statusText: response.statusText,
      data: response.data,
    };
  }

  return response;
}

function serializeError(error: unknown) {
  const serialized = serializeHyperLiquidError(error);
  if (serialized?.response) {
    serialized.response = normalizeResponse(serialized.response);
  }
  return serialized;
}

async function resolveContext(
  context: IContextProvider | undefined,
): Promise<Partial<IHyperLiquidAccountContext>> {
  if (!context) {
    return {};
  }
  if (typeof context === 'function') {
    return context();
  }
  return context;
}

export async function logHyperLiquidApiFailure({
  endpoint,
  action,
  request,
  response,
  error,
  context,
  extra,
}: ILogHyperLiquidApiFailureParams) {
  try {
    const resolvedContext = await resolveContext(context);
    const resolvedResponse =
      response ?? normalizeResponse(extractHyperLiquidErrorResponse(error));
    const message =
      extractHyperLiquidErrorMessage(error) ||
      (error instanceof Error ? error.message : String(error));

    defaultLogger.perp.hyperliquid.apiRequestFailure({
      ...resolvedContext,
      endpoint,
      action,
      request: sanitizePayload(request),
      response: sanitizePayload(resolvedResponse),
      error: sanitizePayload(serializeError(error)) as
        | Record<string, unknown>
        | undefined,
      message,
      extra: sanitizePayload(extra) as Record<string, unknown> | undefined,
    });
  } catch (logError) {
    console.error('[HyperLiquidApiFailureLog] failed to write log', logError);
  }
}

export function createLoggedHyperLiquidClient<T extends object>(
  client: T,
  options: {
    endpoint: IHyperLiquidApiFailureEndpoint;
    context?: IContextProvider;
    extra?: Record<string, unknown>;
    shouldLogFailure?: (params: ILogHyperLiquidClientFailureParams) => boolean;
  },
): T {
  const methodCache = new Map<PropertyKey, unknown>();
  return new Proxy(client, {
    get(target, prop) {
      const value = Reflect.get(target, prop, target);
      if (typeof value !== 'function') {
        return value;
      }

      if (methodCache.has(prop)) {
        return methodCache.get(prop);
      }

      const method = value as (this: T, ...args: unknown[]) => Promise<unknown>;
      const wrapped = async (...args: unknown[]) => {
        const action = String(prop);
        const request = getSingleRequestArg(args);
        try {
          return await method.apply(target, args);
        } catch (error) {
          if (
            options.shouldLogFailure?.({ action, request, error }) !== false
          ) {
            await logHyperLiquidApiFailure({
              endpoint: options.endpoint,
              action,
              request,
              error,
              context: options.context,
              extra: options.extra,
            });
          }
          throw error;
        }
      };
      methodCache.set(prop, wrapped);
      return wrapped;
    },
  });
}

export async function requestLoggedHyperLiquidTransport<T>(
  transport: {
    request: <TResult>(
      endpoint: IHyperLiquidApiFailureEndpoint,
      payload: unknown,
    ) => Promise<TResult>;
  },
  endpoint: IHyperLiquidApiFailureEndpoint,
  payload: unknown,
  options: {
    action: string;
    context?: IContextProvider;
    extra?: Record<string, unknown>;
  },
): Promise<T> {
  try {
    const result = await transport.request<T>(endpoint, payload);
    if (isHyperLiquidErrorResult(result)) {
      await logHyperLiquidApiFailure({
        endpoint,
        action: options.action,
        request: payload,
        response: result,
        error: createHyperLiquidErrorResultError(result),
        context: options.context,
        extra: options.extra,
      });
    }
    return result;
  } catch (error) {
    await logHyperLiquidApiFailure({
      endpoint,
      action: options.action,
      request: payload,
      error,
      context: options.context,
      extra: options.extra,
    });
    throw error;
  }
}
