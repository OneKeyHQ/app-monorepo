import { NotAutoPrintError } from '../errors/common-errors';

let prevErrorStack: string | undefined;

const autoLogger = {
  error: (error: Error) => {
    if (
      error.stack !== prevErrorStack &&
      !(error instanceof NotAutoPrintError)
    ) {
      console.error('AUTO LOGS:', error);
      prevErrorStack = error.stack;
    }
  },
};

export default autoLogger;
