import { NotAutoPrintError } from '../errors/common-errors';
import { toPlainErrorObject } from '../utils/errorUtils';

let prevErrorStack: string | undefined;

const autoLogger = {
  error: (error: Error, ...messages: unknown[]) => {
    if (
      error.stack !== prevErrorStack &&
      !(error instanceof NotAutoPrintError)
    ) {
      console.error(
        'AUTO LOGS:',
        error,
        toPlainErrorObject(error),
        ...messages,
      );
      prevErrorStack = error.stack;
    }
  },
};

export default autoLogger;
