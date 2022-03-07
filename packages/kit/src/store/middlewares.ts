/* eslint-disable @typescript-eslint/no-unused-vars */
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
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if (action && !action.$isDispatchFromBackground) {
      console.error(
        'dispatch(action) ERROR: action should be dispatched from backgroundApi',
        action,
      );
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
