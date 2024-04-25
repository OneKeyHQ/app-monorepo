import { toPlainErrorObject } from '@onekeyhq/shared/src/errors/utils/errorUtils';

let prevErrorStack: string | undefined;

const autoLogger = {
  error: (error: Error, ...messages: unknown[]) => {
    if (process.env.NODE_ENV !== 'production') {
      if (error.stack !== prevErrorStack) {
        setTimeout(() => {
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
