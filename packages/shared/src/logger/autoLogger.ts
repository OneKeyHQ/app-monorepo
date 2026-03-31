import { toPlainErrorObject } from '@onekeyhq/shared/src/errors/utils/errorUtils';

// Bounded set of recent error stacks to avoid suppressing different errors
const recentErrorStacks = new Set<string>();
const MAX_RECENT_ERRORS = 50;

// used by 'babel-plugin-catch-logger'
// add console.error() for every try catch block if error.$$autoPrintErrorIgnore is not true
const autoLogger = {
  error: (error: Error, ...messages: unknown[]) => {
    if (process.env.NODE_ENV !== 'production') {
      if (error && (!error.stack || !recentErrorStacks.has(error.stack))) {
        setTimeout(() => {
          try {
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
          } catch (e) {
            console.error('AUTO-LOGS error:', e);
          }
        }, 600);

        if (error.stack) {
          recentErrorStacks.add(error.stack);
        }
        if (recentErrorStacks.size > MAX_RECENT_ERRORS) {
          // Remove oldest entry
          const first = recentErrorStacks.values().next().value;
          if (first) {
            recentErrorStacks.delete(first);
          }
        }
      }
    }
  },
};

export default autoLogger;
