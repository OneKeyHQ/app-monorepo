import { isFunction } from 'lodash';

import { NotAutoPrintError } from '../errors';
import { toPlainErrorObject } from '../errors/utils/errorUtils';

let prevErrorStack: string | undefined;
const isJest =
  process.env.JEST_WORKER_ID !== undefined || process.env.NODE_ENV === 'test';

const autoLogger = {
  error: (error: Error, ...messages: unknown[]) => {
    if (isJest) {
      return;
    }
    if (process.env.NODE_ENV !== 'production') {
      if (
        error &&
        error.stack &&
        error.stack !== prevErrorStack &&
        !(error instanceof NotAutoPrintError)
      ) {
        setTimeout(() => {
          // @ts-ignore
          if (error && error.$$autoPrintErrorIgnore) {
            return;
          }
          const plainErrorExtraInfo = toPlainErrorObject(error);
          // @ts-ignore
          const logMethod = console.logErrorOriginal || console.error;
          if (isFunction(logMethod)) {
            // @ts-ignore
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call
            logMethod(
              '**** AUTO-LOGS: (ERROR EXTRA INFO)',
              plainErrorExtraInfo,
              error,
              ...messages,
            );
          }
        }, 600);
        prevErrorStack = error.stack;
      }
    }
  },
};

export default autoLogger;
