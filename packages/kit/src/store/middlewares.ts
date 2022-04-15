/* eslint-disable @typescript-eslint/no-unused-vars,@typescript-eslint/no-unsafe-member-access */
import { Middleware } from 'redux';
import logger from 'redux-logger';

const simpleLogger: Middleware<unknown, unknown> =
  (store) => (next) => (action) => {
    console.log('dispatching >>> ', action);
    const result = next(action);
    console.log('nextState >>> ', store.getState());
    return result as unknown;
  };

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

const middlewares = [
  // simpleLogger,
  // logger,
  backgroundCheck,
];

export default middlewares;
