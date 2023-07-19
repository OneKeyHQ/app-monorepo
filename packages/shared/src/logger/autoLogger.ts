import { NotAutoPrintError } from '../errors/common-errors';
import { toPlainErrorObject } from '../utils/errorUtils';

let prevErrorStack: string | undefined;

const autoLogger = {
  error: (error: Error, ...messages: unknown[]) => {
    if (process.env.NODE_ENV !== 'production') {
      if (
        error.stack !== prevErrorStack &&
        !(error instanceof NotAutoPrintError)
      ) {
        setTimeout(() => {
          // @ts-ignore
          if (error && error.$$autoPrintErrorIgnore) {
            return;
          }
          const plainError = toPlainErrorObject(error);
          console.error('AUTO-LOGS:', error, plainError, ...messages);
        }, 600);
        prevErrorStack = error.stack;
      }
    }
  },
};

export default autoLogger;
