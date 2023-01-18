/* eslint-disable @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-return,@typescript-eslint/no-unsafe-member-access */
// @ts-nocheck

import superagent from 'superagent';

// @ts-ignore
const RequestOrigin = superagent.Request;
class NewRequest extends RequestOrigin {
  // eslint-disable-next-line no-useless-constructor,@typescript-eslint/no-useless-constructor
  constructor(...args: any[]) {
    // console.log('intercept superagent >>>>> ', ...args);

    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    super(...args);
  }

  send(...args: any[]) {
    // console.log('intercept superagent send >>>>> ', ...args);

    // eslint-disable-next-line @typescript-eslint/no-unsafe-return,@typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-call
    return super.send(...args);
  }

  _end(...args: any[]) {
    const self = this as superagent.Request;
    self.set({
      // TODO merge current header
      'X-Request-By': 'OneKey/superagent',
    });
    // self.retry(0); // update retry
    // self.timeout(10); // update timeout

    // console.log('intercept superagent _end >>>>> ', ...args, {
    //   header: self.header,
    //   method: self.method,
    //   url: self.url,
    //   data: self._data,
    //   query: self._query,
    //   timeout: self._timeout,
    //   retries: self._retries,
    //   maxRetries: self._maxRetries,
    // });

    return super._end(...args);
  }
}

export function normalizeSuperagent() {
  if (process.env.NODE_ENV !== 'production') {
    // @ts-ignore
    global.$$superagent = superagent;
  }

  superagent.RequestOrigin = RequestOrigin;
  superagent.Request = NewRequest;
}
