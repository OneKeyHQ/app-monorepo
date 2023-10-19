// eslint-disable-next-line max-classes-per-file
const sErrored = Symbol('errored');
const sTimeout = Symbol('timeout');
const sTimedOut = Symbol('timedOut');

/*
  **** XMLHttpRequest polyfill samples
  https://gist.github.com/yigaldviri/f77066e7fb596ec7d5e4dce6b7a4ddf1
  https://github.com/apple502j/xhr-shim/blob/main/src/index.js
  https://github.com/kitsonk/xhr/blob/main/mod.ts
*/

class Dispatch extends EventTarget {
  dispatch(eventName: string) {
    const ev = new Event(eventName);

    const attr = `on${eventName}`;
    // @ts-ignore
    if (typeof this[attr] === 'function') {
      // @ts-ignore
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      this[attr](ev);
    }

    this.dispatchEvent(ev);
  }
}

type IResponseType = '' | 'arraybuffer' | 'blob' | 'document' | 'json' | 'text';

const XMLHttpRequestShim = class XMLHttpRequest extends Dispatch {
  static get UNSENT() {
    return 0;
  }

  static get OPENED() {
    return 1;
  }

  static get HEADERS_RECEIVED() {
    return 2;
  }

  static get LOADING() {
    return 3;
  }

  static get DONE() {
    return 4;
  }

  isXMLHttpRequestShim = true;

  readyState: number = XMLHttpRequest.UNSENT; // 0

  response: string | Blob | ArrayBuffer | object = '';

  responseText = '';

  responseType: IResponseType = '';

  responseURL = '';

  responseXML: any = null;

  status = 0;

  statusText = '';

  timeout = 0;

  upload: Dispatch = new Dispatch(); // XMLHttpRequestUpload

  withCredentials = false;

  headers: Record<string, string> = Object.create({
    accept: '*/*',
  });

  resHeaders: Record<string, string> = Object.create({});

  abortController: AbortController = new AbortController();

  method = '';

  url = '';

  MIME = '';

  [sErrored] = false;

  [sTimeout]: ReturnType<typeof setTimeout> | number = 0;

  [sTimedOut] = false;

  open(method: string, url: string) {
    this.abortController = new AbortController();
    this.upload = new Dispatch();
    this.url = url;
    this.method = method;
    this.readyState = XMLHttpRequest.OPENED;
    this.response = '';
    this.responseText = '';
    this.responseType = '';
    this.responseURL = '';
    this.responseXML = null;
    this.status = 0;
    this.statusText = '';
  }

  setRequestHeader(key: string, value: string) {
    // eslint-disable-next-line no-param-reassign
    key = String(key).toLowerCase();
    if (typeof this.headers[key] === 'undefined') {
      this.headers[key] = String(value);
    } else {
      this.headers[key] += `, ${String(value)}`;
    }
  }

  abort() {
    this.abortController.abort();
    this.status = 0;
    this.readyState = XMLHttpRequest.UNSENT;
    this.upload.dispatch('abort');
  }

  getAllResponseHeaders() {
    if (this[sErrored] || this.readyState < XMLHttpRequest.HEADERS_RECEIVED)
      return '';
    return Object.entries(this.resHeaders)
      .map(([header, value]) => `${header}: ${value}`)
      .join('\r\n');
  }

  getResponseHeader(headerName: string) {
    const headers = this.resHeaders;
    const value = headers[String(headerName).toLowerCase()];
    return typeof value === 'string' ? value : null;
  }

  send(body = null) {
    if (this.timeout > 0) {
      this[sTimeout] = setTimeout(() => {
        this[sTimedOut] = true;
        this.abort();
      }, this.timeout);
    }

    this.readyState = XMLHttpRequest.OPENED;
    this.status = 0;

    this.upload.dispatch('loadstart');
    this.dispatch('loadstart');
    this.dispatch('readystatechange');

    fetch(this.url, {
      method: this.method || 'GET',
      signal: this.abortController.signal,
      headers: this.headers, // TODO custom request headers working?
      credentials: this.withCredentials ? 'include' : 'same-origin',
      body,
    })
      .then(
        async (resp: Response) => {
          this.readyState = XMLHttpRequest.HEADERS_RECEIVED;
          this.responseURL = resp.url;
          this.responseType = ''; // mismatched type resp.type; basic, cors, error, opaque, opaqueredirect
          this.status = resp.status;
          this.statusText = resp.statusText;

          const resHeaders: Record<string, string> = {};
          // @ts-ignore
          // eslint-disable-next-line @typescript-eslint/no-unsafe-call
          Array.from(resp.headers.entries()).forEach(([k, v]) => {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            resHeaders[k] = v;
          });
          this.resHeaders = resHeaders;

          let responseType: IResponseType = (this.resHeaders['content-type'] ||
            'text') as IResponseType;
          // Content-Type: application/json; charset=UTF-8
          if (responseType.startsWith('application/json')) {
            responseType = 'json';
          }
          this.responseType = responseType;

          const finalMIME =
            this.MIME || this.resHeaders['content-type'] || 'text/plain';
          switch (this.responseType) {
            case 'json':
              // this.response = await resp.json();
              // this.responseText = JSON.stringify(this.response);

              // response should be a string even if xhr.setRequestHeader('content-type', 'application/json');
              this.response = await resp.text();
              this.responseText = this.response;

              break;
            // TODO arraybuffer type
            case 'arraybuffer':
              this.response = await resp.arrayBuffer();
              this.responseText = String.fromCharCode.apply(
                null,
                // @ts-ignore
                new Uint16Array(this.response),
              );
              break;
            // TODO blob type
            case 'blob':
              // this.response = await resp.blob();
              this.response = new Blob([await resp.arrayBuffer()], {
                type: finalMIME,
              });
              this.responseText = '';
              break;
            default: // other types like:  document, text, ''
              this.response = await resp.text();
              this.responseText = this.response;
              break;
          }

          this.readyState = XMLHttpRequest.DONE;
          this.dispatch('readystatechange');

          this.dispatch('load');
          this.dispatch('progress');
          this.dispatch('loadend');

          this.upload.dispatch('load');
          this.upload.dispatch('progress');
          this.upload.dispatch('loadend');
        },
        (err) => {
          let errorEventName = 'abort';
          if ((err as Error)?.name !== 'AbortError') {
            this[sErrored] = true;
            errorEventName = 'error';
          } else if (this[sTimedOut]) {
            errorEventName = 'timeout';
          }

          this.readyState = XMLHttpRequest.DONE;
          this.dispatch('readystatechange');
          this.dispatch(errorEventName);
          this.upload.dispatch(errorEventName);
        },
      )
      .finally(() => {
        clearTimeout(this[sTimeout]);
      });
  }
};

global.XMLHttpRequest = global.XMLHttpRequest || XMLHttpRequestShim;
export default global.XMLHttpRequest;
