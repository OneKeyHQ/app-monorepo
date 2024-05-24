/* eslint-disable @typescript-eslint/no-unused-vars,@typescript-eslint/no-unsafe-member-access */
import type { Middleware } from 'redux';
// import logger from 'redux-logger';

// const simpleLogger: Middleware<unknown, unknown> =
//   (store) => (next) => (action) => {
//     console.log('dispatching >>> ', action);
//     const result = next(action);
//     console.log('nextState >>> ', store.getState());
//     return result as unknown;
//   };

const middlewares: Middleware<unknown, unknown>[] = [
  // simpleLogger,
  // logger,
  // backgroundCheck,
];

if (__DEV__) {
  // eslint-disable-next-line global-require, @typescript-eslint/no-var-requires
  // const createDebugger = require('redux-flipper').default;
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call
  // middlewares.push(createDebugger());

  const backgroundCheck: Middleware<unknown, unknown> =
    () => (next) => (action) => {
      if (
        action &&
        !action.$isDispatchFromBackground &&
        action.type &&
        // ignore redux-persist action
        !(action.type as string).startsWith('persist/')
      ) {
        const msg =
          'dispatch(action) ERROR: action should be dispatched from background.';
        console.error(msg, action);
        throw new Error(msg);
      }
      const result = next(action);
      return result as unknown;
    };
  middlewares.push(backgroundCheck);
}

export default middlewares;
