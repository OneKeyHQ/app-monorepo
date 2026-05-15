import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';

const SIGN_AND_VERIFY_ROUTE_PROBE = '[sign-and-verify][CRASH_PROBE]';
const DEFAULT_MAX_PROBE_KEYS = 24;
const DEFAULT_MAX_PROBE_ARRAY_ITEMS = 8;
const DEFAULT_MAX_NESTED_PROBE_KEYS = 12;

type IProbeValue = {
  name: string;
  value: unknown;
  maxArrayItems?: number;
  maxDepth?: number;
  maxKeys?: number;
};

function getProbeObject(value: unknown): Record<string, unknown> | null {
  if (
    (typeof value === 'object' && value !== null) ||
    typeof value === 'function'
  ) {
    return value as Record<string, unknown>;
  }
  return null;
}

function getConstructorName(value: unknown) {
  const objectValue = getProbeObject(value);
  if (!objectValue) {
    return '';
  }
  const constructorValue = (
    objectValue as {
      constructor?: unknown;
    }
  ).constructor;
  if (typeof constructorValue === 'function') {
    return constructorValue.name || 'anonymous';
  }
  if (constructorValue === undefined) {
    return 'undefined';
  }
  return `nonFunction:${typeof constructorValue}`;
}

function getPrototypeName(value: object) {
  const proto = Object.getPrototypeOf(value);
  if (proto === null) {
    return 'null';
  }
  if (proto === Object.prototype) {
    return 'Object.prototype';
  }
  if (proto === Array.prototype) {
    return 'Array.prototype';
  }
  return getConstructorName(proto) || typeof proto;
}

function describeToStringDescriptor(descriptor?: PropertyDescriptor) {
  if (!descriptor) {
    return 'none';
  }

  const parts: string[] = [];
  parts.push(descriptor.enumerable ? 'enumerable' : 'nonEnumerable');
  parts.push(descriptor.configurable ? 'configurable' : 'nonConfigurable');
  if ('writable' in descriptor) {
    parts.push(descriptor.writable ? 'writable' : 'readonly');
  }
  if ('value' in descriptor) {
    parts.push(`value:${typeof descriptor.value}`);
  }
  if ('get' in descriptor) {
    parts.push(`get:${typeof descriptor.get}`);
  }
  if ('set' in descriptor) {
    parts.push(`set:${typeof descriptor.set}`);
  }
  return parts.join('/');
}

function describeFieldValue(key: string, value: unknown) {
  if (value === null) {
    return `${key}:null`;
  }

  const valueType = typeof value;
  const objectValue = getProbeObject(value);
  if (!objectValue) {
    return `${key}:${valueType}`;
  }

  const hasOwnToString = Object.prototype.hasOwnProperty.call(
    objectValue,
    'toString',
  );
  const toStringType = typeof (
    objectValue as {
      toString?: unknown;
    }
  ).toString;
  const valueOfType = typeof (
    objectValue as {
      valueOf?: unknown;
    }
  ).valueOf;

  return [
    `${key}:${valueType}`,
    `ctor:${getConstructorName(value)}`,
    `proto:${getPrototypeName(value as object)}`,
    `toString:${toStringType}`,
    `valueOf:${valueOfType}`,
    hasOwnToString ? 'ownToString:true' : 'ownToString:false',
  ].join('/');
}

function describeProbeValue(
  name: string,
  value: unknown,
  maxKeys = DEFAULT_MAX_PROBE_KEYS,
) {
  try {
    if (value === null) {
      return `${name}{type=null}`;
    }

    const valueType = typeof value;
    const objectValue = getProbeObject(value);
    if (!objectValue) {
      return `${name}{type=${valueType}}`;
    }

    const keys = Object.keys(objectValue);
    const ownToString = Object.prototype.hasOwnProperty.call(
      objectValue,
      'toString',
    );
    const ownValueOf = Object.prototype.hasOwnProperty.call(
      objectValue,
      'valueOf',
    );
    const toStringValue = (
      objectValue as {
        toString?: unknown;
      }
    ).toString;
    const valueOfValue = (
      objectValue as {
        valueOf?: unknown;
      }
    ).valueOf;
    const toStringDescriptor = Object.getOwnPropertyDescriptor(
      objectValue,
      'toString',
    );
    const valueOfDescriptor = Object.getOwnPropertyDescriptor(
      objectValue,
      'valueOf',
    );
    const fields = keys
      .slice(0, maxKeys)
      .map((key) => describeFieldValue(key, objectValue[key]));

    return [
      `${name}{type=${valueType}`,
      `ctor=${getConstructorName(value)}`,
      `proto=${getPrototypeName(value as object)}`,
      `array=${Array.isArray(value)}`,
      `keys=${keys.slice(0, maxKeys).join(',')}`,
      `keysLength=${keys.length}`,
      `typeofToString=${typeof toStringValue}`,
      `typeofValueOf=${typeof valueOfValue}`,
      `ownToString=${ownToString}`,
      `ownValueOf=${ownValueOf}`,
      `toStringDesc=${describeToStringDescriptor(toStringDescriptor)}`,
      `valueOfDesc=${describeToStringDescriptor(valueOfDescriptor)}`,
      `fields=${fields.join(',')}}`,
    ].join(';');
  } catch (error) {
    return `${name}{probeError=${
      error instanceof Error ? error.message : String(error)
    }}`;
  }
}

function describeArrayItems({
  name,
  value,
  maxArrayItems = DEFAULT_MAX_PROBE_ARRAY_ITEMS,
}: IProbeValue) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .slice(0, maxArrayItems)
    .map((item, index) => describeProbeValue(`${name}[${index}]`, item));
}

function getNestedProbeKeyLimit(
  value: unknown,
  maxArrayItems: number,
  maxKeys: number,
) {
  if (Array.isArray(value)) {
    return Math.min(maxArrayItems, maxKeys);
  }
  return maxKeys;
}

function formatNestedProbeName(parentName: string, key: string) {
  if (/^\d+$/.test(key)) {
    return `${parentName}[${key}]`;
  }
  return `${parentName}.${key}`;
}

function describeNestedProbeValues(
  {
    name,
    value,
    maxArrayItems = DEFAULT_MAX_PROBE_ARRAY_ITEMS,
    maxDepth = 0,
    maxKeys = DEFAULT_MAX_NESTED_PROBE_KEYS,
  }: IProbeValue,
  seen = new WeakSet<object>(),
): string[] {
  const objectValue = getProbeObject(value);
  if (!objectValue || maxDepth <= 0) {
    return [];
  }

  if (seen.has(objectValue)) {
    return [`${name}{cycle=true}`];
  }
  seen.add(objectValue);

  try {
    const keyLimit = getNestedProbeKeyLimit(value, maxArrayItems, maxKeys);
    const keys = Object.keys(objectValue).slice(0, keyLimit);
    return keys.flatMap((key) => {
      let childValue: unknown;
      const childName = formatNestedProbeName(name, key);
      try {
        childValue = objectValue[key];
      } catch (error) {
        return [
          `${childName}{probeError=${
            error instanceof Error ? error.message : String(error)
          }}`,
        ];
      }

      return [
        describeProbeValue(childName, childValue, maxKeys),
        ...describeNestedProbeValues(
          {
            name: childName,
            value: childValue,
            maxArrayItems,
            maxDepth: maxDepth - 1,
            maxKeys,
          },
          seen,
        ),
      ];
    });
  } catch (error) {
    return [
      `${name}{nestedProbeError=${
        error instanceof Error ? error.message : String(error)
      }}`,
    ];
  }
}

function getProbeStack() {
  return (
    new Error(SIGN_AND_VERIFY_ROUTE_PROBE).stack
      ?.split('\n')
      .slice(1, 8)
      .map((line) => line.trim())
      .join(' <- ') || 'unavailable'
  );
}

export function logSignAndVerifyCrashProbe(
  stage: string,
  values: IProbeValue[],
) {
  const message = [
    `${SIGN_AND_VERIFY_ROUTE_PROBE} ${stage}`,
    ...values.flatMap((value) => {
      const shouldUseNestedProbe = (value.maxDepth ?? 0) > 0;
      return [
        describeProbeValue(value.name, value.value, value.maxKeys),
        ...(shouldUseNestedProbe
          ? describeNestedProbeValues(value)
          : describeArrayItems(value)),
      ];
    }),
    `stack=${getProbeStack()}`,
  ].join(' | ');

  try {
    console.error(message);
    defaultLogger.app.error.log(message);
  } catch (error) {
    console.error(
      `${SIGN_AND_VERIFY_ROUTE_PROBE} logger failed`,
      error instanceof Error ? error.message : String(error),
    );
  }
}

function encodeProbeText(text: unknown) {
  if (text === null || text === undefined) {
    return String(text);
  }
  return String(text).replace(/\r?\n/g, ' <- ').replace(/\s+/g, ' ');
}

export function logSignAndVerifyTextProbe(stage: string, text: string) {
  const message = `${SIGN_AND_VERIFY_ROUTE_PROBE} ${stage} | ${text} | stack=${getProbeStack()}`;
  try {
    console.error(message);
    defaultLogger.app.error.log(message);
  } catch (error) {
    console.error(
      `${SIGN_AND_VERIFY_ROUTE_PROBE} logger failed`,
      error instanceof Error ? error.message : String(error),
    );
  }
}

export function captureSignAndVerifyError<T>(stage: string, fn: () => T): T {
  try {
    return fn();
  } catch (error) {
    const errorObj = error as Error | null;
    logSignAndVerifyTextProbe(
      stage,
      `caught=true | error.name=${encodeProbeText(
        errorObj?.name,
      )} | error.message=${encodeProbeText(
        errorObj?.message,
      )} | error.stack=${encodeProbeText(errorObj?.stack)}`,
    );
    throw error;
  }
}

const SIGN_AND_VERIFY_GLOBAL_ERROR_PROBE_INSTALLED =
  '__signAndVerifyGlobalErrorProbeInstalled__';

type IErrorUtilsLike = {
  setGlobalHandler?: (
    handler: (error: Error, isFatal?: boolean) => void,
  ) => void;
  getGlobalHandler?: () => (error: Error, isFatal?: boolean) => void;
};

function resolveErrorUtils(): {
  source: string;
  errorUtils: IErrorUtilsLike | undefined;
} {
  const candidates: { source: string; value: unknown }[] = [];
  try {
    candidates.push({
      source: 'globalThis.ErrorUtils',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      value: (globalThis as any)?.ErrorUtils,
    });
  } catch {
    // ignore
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fromGlobalAlias = (globalThis as any)?.global?.ErrorUtils;
    candidates.push({
      source: 'globalThis.global.ErrorUtils',
      value: fromGlobalAlias,
    });
  } catch {
    // ignore
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fromBracket = (globalThis as any)?.['ErrorUtils'];
    candidates.push({ source: 'globalThis[ErrorUtils]', value: fromBracket });
  } catch {
    // ignore
  }
  for (const candidate of candidates) {
    const v = candidate.value as IErrorUtilsLike | undefined;
    if (
      v &&
      typeof v.setGlobalHandler === 'function' &&
      typeof v.getGlobalHandler === 'function'
    ) {
      return { source: candidate.source, errorUtils: v };
    }
  }
  return { source: 'none', errorUtils: undefined };
}

function installSignAndVerifyGlobalErrorProbe() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const globalScope = globalThis as any;
    if (globalScope[SIGN_AND_VERIFY_GLOBAL_ERROR_PROBE_INSTALLED]) {
      logSignAndVerifyTextProbe(
        'global error probe install skipped',
        'reason=already-installed',
      );
      return;
    }
    const { source, errorUtils } = resolveErrorUtils();
    if (!errorUtils || !errorUtils.setGlobalHandler) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const hasGlobalAlias = typeof (globalThis as any)?.global;
      logSignAndVerifyTextProbe(
        'global error probe install skipped',
        `reason=no-error-utils | typeofGlobalThis=${typeof globalThis} | typeofGlobalAlias=${hasGlobalAlias}`,
      );
      return;
    }
    globalScope[SIGN_AND_VERIFY_GLOBAL_ERROR_PROBE_INSTALLED] = true;
    const previousHandler = errorUtils.getGlobalHandler
      ? errorUtils.getGlobalHandler()
      : undefined;
    errorUtils.setGlobalHandler((error, isFatal) => {
      try {
        const errorObj = error as Error | null;
        logSignAndVerifyTextProbe(
          'global error handler',
          `isFatal=${String(isFatal)} | error.name=${encodeProbeText(
            errorObj?.name,
          )} | error.message=${encodeProbeText(
            errorObj?.message,
          )} | error.stack=${encodeProbeText(errorObj?.stack)}`,
        );
      } catch {
        // swallow probe failure
      }
      if (typeof previousHandler === 'function') {
        previousHandler(error, isFatal);
      }
    });
    logSignAndVerifyTextProbe(
      'global error probe installed',
      `source=${source} | typeofPreviousHandler=${typeof previousHandler}`,
    );
  } catch (error) {
    const errorObj = error as Error | null;
    try {
      logSignAndVerifyTextProbe(
        'global error probe install threw',
        `error.name=${encodeProbeText(
          errorObj?.name,
        )} | error.message=${encodeProbeText(errorObj?.message)}`,
      );
    } catch {
      console.error(
        `${SIGN_AND_VERIFY_ROUTE_PROBE} global handler install failed`,
        errorObj?.message ?? String(error),
      );
    }
  }
}

installSignAndVerifyGlobalErrorProbe();
