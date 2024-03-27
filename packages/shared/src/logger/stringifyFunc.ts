import { isArray } from 'lodash';

import { toPlainErrorObject } from '../errors/utils/errorUtils';
import platformEnv from '../platformEnv';
import { stableStringify } from '../utils/stringUtils';

function countObjectDepth(source: unknown, maxDepth = 5, depth = 0): number {
  const currentDepth = depth + 1;
  if (currentDepth > maxDepth) {
    return currentDepth;
  }

  if (source == null) {
    return currentDepth;
  }

  if (typeof source !== 'object' || typeof source === 'function') {
    return currentDepth;
  }

  if (Array.isArray(source)) {
    return Math.max(
      ...source.map((item) => countObjectDepth(item, maxDepth, currentDepth)),
    );
  }

  const keys = Object.getOwnPropertyNames(source);
  return Math.max(
    ...keys.map((k) =>
      countObjectDepth(
        (source as { [k: string]: unknown })[k],
        maxDepth,
        currentDepth,
      ),
    ),
  );
}

function convertErrorObject(...args: any[]): any[] {
  return args.map((arg) => {
    if (arg instanceof Error) {
      const error = toPlainErrorObject(arg as any);
      if (platformEnv.isProduction) {
        if (error && error.stack) {
          delete error.stack;
        }
      }
      return error;
    }
    if (isArray(arg)) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      return convertErrorObject(...arg);
    }
    return arg as unknown;
  });
}

const LOG_STRING_LIMIT = 3000;

export function stringifyFunc(...args: any[]): string {
  const argsNew = convertErrorObject(...args);
  if (platformEnv.isDev) {
    const maxDepth = 6;
    try {
      argsNew.forEach((arg) => {
        if (countObjectDepth(arg, maxDepth) > maxDepth) {
          console.warn(
            `Arg nesting too deep. This will affect the performance of logging. Try reducing the level of nesting for the parameter objects.`,
            arg,
          );
        }
      });
    } catch (error) {
      console.warn(
        `Arg nesting too deep. This will affect the performance of logging. Try reducing the level of nesting for the parameter objects.`,
        argsNew,
      );
    }
  }
  const stringifiedLog = stableStringify(argsNew);

  return stringifiedLog.length > LOG_STRING_LIMIT
    ? `${stringifiedLog.slice(0, LOG_STRING_LIMIT)}...(truncated)`
    : stringifiedLog;
}
