/* eslint-disable @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-return,@typescript-eslint/no-unsafe-member-access */

// eslint-disable-next-line max-classes-per-file
import { isNil, isString } from 'lodash';
import superagent from 'superagent';

import {
  RequestInterceptorBase,
  RequestLibNames,
} from './RequestInterceptorBase';

class RequestInterceptorSuperagent extends RequestInterceptorBase {
  constructor(superagentRequest: superagent.Request) {
    super();
    this.superagentRequest = superagentRequest;
  }

  superagentRequest: superagent.Request;

  requestLibName: RequestLibNames = RequestLibNames.superagent;

  setDefaultRetry(count: number): void {
    // @ts-ignore
    if (isNil(this.superagentRequest._maxRetries)) {
      this.superagentRequest.retry(count);
    }
  }

  setDefaultTimeout(ms: number): void {
    // @ts-ignore
    if (isNil(this.superagentRequest._timeout)) {
      this.superagentRequest.timeout(ms);
    }
  }

  setHeader(key: string, val: string): void {
    this.superagentRequest.set(key, val);
  }
}

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
    // @ts-ignore
    const self = this as superagent.Request;
    const interceptor = new RequestInterceptorSuperagent(self);
    // @ts-ignore
    let { url } = self;

    // TODO baseURL support https://github.com/koenpunt/superagent-use
    url = isString(url) ? url : '';
    interceptor.interceptRequest({ url });

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

  // @ts-ignore
  superagent.RequestOrigin = RequestOrigin;
  // @ts-ignore
  superagent.Request = NewRequest;
}
