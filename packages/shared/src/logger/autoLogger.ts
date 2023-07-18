import { NotAutoPrintError } from '../errors/common-errors';

let prevErrorStack: string | undefined;

const autoLogger = {
  error: (error: Error, ...messages) => {
    if (
      error.stack !== prevErrorStack &&
      !(error instanceof NotAutoPrintError)
    ) {
      console.error('AUTO LOGS:', error, ...messages);
      prevErrorStack = error.stack;
    }
  },
};

export default autoLogger;
