import { toPlainErrorObject } from '@onekeyhq/shared/src/errors/utils/errorUtils';

let prevErrorStack: string | undefined;

// used by 'babel-plugin-catch-logger'
// add console.error() for every try catch block if error.$$autoPrintErrorIgnore is not true
const autoLogger = {
  error: (error: Error, ...messages: unknown[]) => {
    if (process.env.NODE_ENV !== 'production') {
      if (error && error?.stack !== prevErrorStack) {
        setTimeout(() => {
          /*
          how to mute auto error log:
              try {
                ...
              } catch (error) {
                error.$$autoPrintErrorIgnore = true;
                ...
                throw error;
              }
          */
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
