const MAX_UTM_VALUE_LENGTH = 128;
const MAX_UTM_KEY_LENGTH = 64;
const MAX_UTM_PARAM_COUNT = 8;
const URL_PROTOCOL_PREFIX_REGEXP = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//u;
const DUMMY_URL_ORIGIN = 'https://onekey.local';
const UTM_KEY_REGEXP = /^utm_[a-z0-9_]+$/u;

export type ILoggerUtmParams = Record<string, string>;

const loggerGlobalUtmParams: ILoggerUtmParams = {};
const reportedUtmParamSnapshots = new Set<string>();

function isControlCharacter(value: string): boolean {
  const charCode = value.charCodeAt(0);
  return charCode <= 31 || charCode === 127;
}

function parseUrlLike(value: string): URL | undefined {
  const trimmedValue = value.trim();
  if (!trimmedValue) {
    return undefined;
  }

  try {
    if (
      URL_PROTOCOL_PREFIX_REGEXP.test(trimmedValue) ||
      trimmedValue.startsWith('/')
    ) {
      return new URL(trimmedValue, DUMMY_URL_ORIGIN);
    }
    return new URL(`https://${trimmedValue}`);
  } catch {
    return undefined;
  }
}

function normalizeUtmKey(key: string): string | undefined {
  const normalizedKey = key.trim().toLowerCase();
  if (
    normalizedKey.length > MAX_UTM_KEY_LENGTH ||
    !UTM_KEY_REGEXP.test(normalizedKey)
  ) {
    return undefined;
  }
  return normalizedKey;
}

export function normalizeLoggerUtmValue(
  value: string | string[] | undefined | null,
): string | undefined {
  const rawValue = Array.isArray(value) ? value[0] : value;
  const trimmedValue = rawValue?.trim();
  if (!trimmedValue) {
    return undefined;
  }

  const normalizedValue = Array.from(trimmedValue)
    .filter((char) => !isControlCharacter(char))
    .join('')
    .slice(0, MAX_UTM_VALUE_LENGTH);

  return normalizedValue || undefined;
}

function collectUtmParamsFromSearchParams(
  searchParams: URLSearchParams,
  params: ILoggerUtmParams = {},
): ILoggerUtmParams {
  let paramCount = Object.keys(params).length;
  searchParams.forEach((value, key) => {
    const normalizedKey = normalizeUtmKey(key);
    const normalizedValue = normalizeLoggerUtmValue(value);
    if (normalizedKey && normalizedValue) {
      if (!Object.prototype.hasOwnProperty.call(params, normalizedKey)) {
        if (paramCount >= MAX_UTM_PARAM_COUNT) {
          return;
        }
        paramCount += 1;
      }
      params[normalizedKey] = normalizedValue;
    }
  });
  return params;
}

function buildReportSnapshot(params: ILoggerUtmParams): string {
  return Object.keys(params)
    .toSorted()
    .map((key) => `${key}=${params[key]}`)
    .join('&');
}

function replaceLoggerGlobalUtmParams(params: ILoggerUtmParams) {
  Object.keys(loggerGlobalUtmParams).forEach((key) => {
    delete loggerGlobalUtmParams[key];
  });
  Object.assign(loggerGlobalUtmParams, params);
}

export function getLoggerUtmParamsFromUrl(
  url: string | undefined | null,
): ILoggerUtmParams {
  if (!url) {
    return {};
  }

  const parsedUrl = parseUrlLike(url);
  if (!parsedUrl) {
    return {};
  }

  const params = collectUtmParamsFromSearchParams(parsedUrl.searchParams);
  const hash = parsedUrl.hash;
  const hashQueryIndex = hash.indexOf('?');
  if (hashQueryIndex >= 0) {
    // Hash routes can carry campaign params independently from the outer URL.
    collectUtmParamsFromSearchParams(
      new URLSearchParams(hash.slice(hashQueryIndex + 1)),
      params,
    );
  }

  return params;
}

export function captureLoggerUtmParamsFromUrl(url: string | undefined | null):
  | {
      params: ILoggerUtmParams;
      shouldReport: boolean;
    }
  | undefined {
  const params = getLoggerUtmParamsFromUrl(url);
  // Replace first so a plain URL clears attribution from the previous route.
  replaceLoggerGlobalUtmParams(params);
  if (Object.keys(params).length === 0) {
    return undefined;
  }

  const snapshot = buildReportSnapshot(params);
  const shouldReport = !reportedUtmParamSnapshots.has(snapshot);
  reportedUtmParamSnapshots.add(snapshot);

  return { params, shouldReport };
}

export function getLoggerGlobalUtmParams(): ILoggerUtmParams {
  return { ...loggerGlobalUtmParams };
}
