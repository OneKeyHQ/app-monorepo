// @ts-nocheck
// eslint-disable-next-line max-classes-per-file
import * as mimeTypes from 'mime-types';

type XMLHttpRequestResponseType =
  | ''
  | 'arraybuffer'
  | 'blob'
  | 'document'
  | 'json'
  | 'text';

function assert(cond: unknown, msg = 'assertion failed'): asserts cond {
  if (!cond) {
    const err = new Error(msg);
    err.name = 'AssertionError';
    throw err;
  }
}

function extractLength(response: Response) {
  // TODO content-length not found in response header
  const values = response.headers.get('content-length')?.split(/\s*,\s*/) ?? [];
  let candidateValue: string | null = null;
  for (const value of values) {
    if (candidateValue == null) {
      candidateValue = value;
    } else if (value !== candidateValue) {
      throw new Error('invalid content-length');
    }
  }
  if (candidateValue === '' || candidateValue == null) {
    return null;
  }
  const v = parseInt(candidateValue, 10);
  return Number.isNaN(v) ? null : v;
}

function getEssence(value: string) {
  return value.split(/\s*;\s*/)[0];
}

function extractMIMEType(headers: Headers) {
  let mimeType: string | null = null;
  const values = headers.get('content-type')?.split(/\s*,\s*/);
  if (!values) {
    throw new Error('missing content type');
  }
  for (const value of values) {
    const temporaryMimeType = mimeTypes.contentType(value);
    if (!temporaryMimeType || getEssence(temporaryMimeType) === '*/*') {
      // eslint-disable-next-line no-continue
      continue;
    }
    mimeType = temporaryMimeType;
  }
  if (mimeType == null) {
    throw new Error('missing content type');
  }
  return mimeType;
}

function isHTMLMIMEType(value: string) {
  return getEssence(value) === 'text/html';
}

function isXMLMIMEType(value: string) {
  const essence = getEssence(value);
  return (
    essence.endsWith('+xml') ||
    essence === 'text/xml' ||
    essence === 'application/xml'
  );
}

const decoder = new TextDecoder();

function parseJSONFromBytes(value: Uint8Array): any {
  const string = decoder.decode(value);
  return JSON.parse(string);
}

function appendBytes(...bytes: Uint8Array[]): Uint8Array {
  let length = 0;
  for (const b of bytes) {
    length += b.length;
  }
  const result = new Uint8Array(length);
  let offset = 0;
  for (const b of bytes) {
    result.set(b, offset);
    offset += b.length;
  }
  return result;
}

// @ts-ignore
class ProgressEvent extends CustomEvent {}

export class XMLHttpRequestEventTarget extends EventTarget {
  onabort: ((this: XMLHttpRequest, ev: ProgressEvent) => any) | null = null;

  onerror: ((this: XMLHttpRequest, ev: ProgressEvent) => any) | null = null;

  onload: ((this: XMLHttpRequest, ev: ProgressEvent) => any) | null = null;

  onloadend: ((this: XMLHttpRequest, ev: ProgressEvent) => any) | null = null;

  onloadstart: ((this: XMLHttpRequest, ev: ProgressEvent) => any) | null = null;

  onprogress: ((this: XMLHttpRequest, ev: ProgressEvent) => any) | null = null;

  ontimeout: ((this: XMLHttpRequest, ev: ProgressEvent) => any) | null = null;

  override dispatchEvent(evt: Event) {
    if (evt instanceof ProgressEvent) {
      const xhr: XMLHttpRequest = this as any;
      switch (evt.type) {
        case 'abort':
          if (this.onabort) {
            this.onabort.call(xhr, evt);
          }
          break;
        case 'error':
          if (this.onerror) {
            this.onerror.call(xhr, evt);
          }
          break;
        case 'load':
          if (this.onload) {
            this.onload.call(xhr, evt);
          }
          break;
        case 'loadend':
          if (this.onloadend) {
            this.onloadend.call(xhr, evt);
          }
          break;
        case 'loadstart':
          if (this.onloadstart) {
            this.onloadstart.call(xhr, evt);
          }
          break;
        case 'progress':
          if (this.onprogress) {
            this.onprogress.call(xhr, evt);
          }
          break;
        case 'timeout':
          if (this.ontimeout) {
            this.ontimeout.call(xhr, evt);
          }
          break;
        default:
          break;
      }
    }
    if (evt.cancelable && evt.defaultPrevented) {
      return false;
    }
    return super.dispatchEvent(evt);
  }
}

export class XMLHttpRequestUpload extends XMLHttpRequestEventTarget {}

enum State {
  UNSENT = 0,
  OPENED = 1,
  HEADERS_RECEIVED = 2,
  LOADING = 3,
  DONE = 4,
}

const METHODS = ['GET', 'HEAD', 'POST', 'DELETE', 'OPTIONS', 'PUT', 'PATCH'];

export class XMLHttpRequest extends XMLHttpRequestEventTarget {
  #abortedFlag = false;

  #abortController?: AbortController;

  #crossOriginCredentials = false;

  #headers = new Headers();

  #mime?: string;

  #receivedBytes = new Uint8Array();

  #requestMethod?: string;

  #response?: Response;

  #responseObject: any = null;

  #responseType: XMLHttpRequestResponseType = '';

  #sendFlag = false;

  #state = State.UNSENT;

  #timedoutFlag = false;

  #timeout = 0;

  #upload = new XMLHttpRequestUpload();

  #uploadCompleteFlag = false;

  #uploadListener = false;

  #url?: URL;

  #getResponseMIMEType() {
    try {
      assert(this.#response);
      const mimeType = extractMIMEType(this.#response.headers);
      return mimeType;
    } catch {
      return 'text/xml';
    }
  }

  #getFinalMIMEType() {
    if (!this.#mime) {
      return this.#getResponseMIMEType();
    }
    return this.#mime;
  }

  #getCharsetFromContentTypeHeader(contentTypeHeader: string) {
    const charsetRegExp = /charset=([\w-]+)/i;
    const match = contentTypeHeader.match(charsetRegExp);
    if (match) {
      return match?.[1]?.toLowerCase?.();
    }
    return undefined;
  }

  #getFinalEncoding() {
    return (
      this.#getCharsetFromContentTypeHeader(
        this.#getFinalMIMEType(),
      )?.toLocaleLowerCase() ?? null
    );
  }

  #getTextResponse() {
    if (this.#response?.body == null) {
      return '';
    }
    let charset = this.#getFinalEncoding();
    if (
      this.#responseType === '' &&
      charset == null &&
      isXMLMIMEType(this.#getFinalMIMEType())
    ) {
      charset = 'utf-8';
    }
    charset = charset ?? 'utf8';
    const decoder0 = new TextDecoder(charset);
    return decoder0.decode(this.#receivedBytes);
  }

  #handleResponseEndOfBody() {
    assert(this.#response);
    const loaded = this.#receivedBytes.length;
    const total = extractLength(this.#response) ?? 0;
    this.dispatchEvent(new ProgressEvent('progress', { loaded, total }));
    this.#state = State.DONE;
    this.#sendFlag = false;
    this.dispatchEvent(new Event('readystatechange'));
    this.dispatchEvent(new ProgressEvent('load', { loaded, total }));
    this.dispatchEvent(new ProgressEvent('loadend', { loaded, total }));
  }

  #handleErrors() {
    if (!this.#sendFlag) {
      return;
    }
    if (this.#timedoutFlag) {
      this.#requestErrorSteps('timeout');
    } else if (this.#abortedFlag) {
      this.#requestErrorSteps('abort');
    } else {
      this.#requestErrorSteps('error');
    }
  }

  #requestErrorSteps(event: string) {
    this.#state = State.DONE;
    this.#sendFlag = false;
    this.dispatchEvent(new Event('readystatechange'));
    if (!this.#uploadCompleteFlag) {
      this.#uploadCompleteFlag = true;
      if (this.#uploadListener) {
        this.#upload.dispatchEvent(
          new ProgressEvent(event, { loaded: 0, total: 0 }),
        );
        this.#upload.dispatchEvent(
          new ProgressEvent('loadend', { loaded: 0, total: 0 }),
        );
      }
    }
    this.dispatchEvent(new ProgressEvent(event, { loaded: 0, total: 0 }));
    this.dispatchEvent(new ProgressEvent('loadend', { loaded: 0, total: 0 }));
  }

  #setDocumentResponse() {
    assert(this.#response);
    if (this.#response.body == null) {
      return;
    }
    const finalMIME = this.#getFinalMIMEType();
    if (!(isHTMLMIMEType(finalMIME) || isXMLMIMEType(finalMIME))) {
      return;
    }
    if (this.#responseType === '' && isHTMLMIMEType(finalMIME)) {
      return;
    }
    this.#responseObject = new DOMException(
      'Document bodies are not supported',
      'SyntaxError',
    );
  }

  #terminate() {
    if (this.#abortController) {
      try {
        this.#abortController.abort();
      } catch {
        // just swallowing errors here
      }
      this.#abortController = undefined;
    }
  }

  onreadystatechange: ((this: XMLHttpRequest, ev: Event) => any) | null = null;

  get readyState(): number {
    return this.#state;
  }

  get response(): any {
    if (this.#responseType === '' || this.#responseType === 'text') {
      if (!(this.#state === State.LOADING || this.#state === State.DONE)) {
        return '';
      }
      return this.#getTextResponse();
    }
    if (this.#state !== State.DONE) {
      return null;
    }
    if (this.#responseObject instanceof Error) {
      return null;
    }
    if (this.#responseObject != null) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      return this.#responseObject;
    }
    if (this.#responseType === 'arraybuffer') {
      try {
        this.#responseObject = this.#receivedBytes.buffer.slice(
          this.#receivedBytes.byteOffset,
          this.#receivedBytes.byteLength + this.#receivedBytes.byteOffset,
        );
      } catch (e) {
        this.#responseObject = e;
        return null;
      }
    } else if (this.#responseType === 'blob') {
      this.#responseObject = new Blob([this.#receivedBytes], {
        type: this.#getFinalMIMEType(),
      });
    } else if (this.#responseType === 'document') {
      this.#setDocumentResponse();
    } else {
      assert(this.#responseType === 'json');
      if (this.#response?.body == null) {
        return null;
      }
      let jsonObject;
      try {
        jsonObject = parseJSONFromBytes(this.#receivedBytes);
      } catch {
        return null;
      }
      this.#responseObject = jsonObject;
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return this.#responseObject instanceof Error ? null : this.#responseObject;
  }

  get responseText(): string {
    if (!(this.#responseType === '' || this.#responseType === 'text')) {
      throw new DOMException(
        'Response type is not set properly',
        'InvalidStateError',
      );
    }
    if (!(this.#state === State.LOADING || this.#state === State.DONE)) {
      return '';
    }
    return this.#getTextResponse();
  }

  get responseType(): XMLHttpRequestResponseType {
    return this.#responseType;
  }

  set responseType(value: XMLHttpRequestResponseType) {
    if (value === 'document') {
      return;
    }
    if (this.#state === State.LOADING || this.#state === State.DONE) {
      throw new DOMException(
        'The response type cannot be changed when loading or done',
        'InvalidStateError',
      );
    }
    this.#responseType = value;
  }

  get responseURL(): string {
    return this.#response?.url ?? '';
  }

  get responseXML(): null {
    if (!(this.#responseType === '' || this.#responseType === 'document')) {
      throw new DOMException(
        'Response type is not properly set',
        'InvalidStateError',
      );
    }
    if (this.#state !== State.DONE) {
      return null;
    }
    if (this.#setDocumentResponse instanceof Error) {
      return null;
    }
    this.#setDocumentResponse();
    return null;
  }

  get status(): number {
    return this.#response?.status ?? 0;
  }

  get statusText(): string {
    return this.#response?.statusText ?? '';
  }

  get timeout(): number {
    return this.#timeout;
  }

  set timeout(value: number) {
    this.#timeout = value;
  }

  get upload(): XMLHttpRequestUpload {
    return this.#upload;
  }

  get withCredentials(): boolean {
    return this.#crossOriginCredentials;
  }

  set withCredentials(value: boolean) {
    if (!(this.#state === State.UNSENT || this.#state === State.OPENED)) {
      throw new DOMException(
        'The request is not unsent or opened',
        'InvalidStateError',
      );
    }
    if (this.#sendFlag) {
      throw new DOMException('The request has been sent', 'InvalidStateError');
    }
    this.#crossOriginCredentials = value;
  }

  abort(): void {
    this.#terminate();
    if (
      (this.#state === State.OPENED && this.#sendFlag) ||
      this.#state === State.HEADERS_RECEIVED ||
      this.#state === State.LOADING
    ) {
      this.#requestErrorSteps('abort');
    }
    if (this.#state === State.DONE) {
      this.#state = State.UNSENT;
      this.#response = undefined;
    }
  }

  override dispatchEvent(evt: Event) {
    switch (evt.type) {
      case 'readystatechange':
        if (this.onreadystatechange) {
          this.onreadystatechange.call(this, evt);
        }
        break;
      default:
        break;
    }
    if (evt.cancelable && evt.defaultPrevented) {
      return false;
    }
    return super.dispatchEvent(evt);
  }

  getAllResponseHeaders(): string | null {
    if (!this.#response) {
      return null;
    }
    // @ts-ignore
    const headers = [...this.#response.headers];
    headers.sort(([a]: [string], [b]: [string]) => a.localeCompare(b));
    return headers
      .map(([key, value]: [string, string]) => `${key}: ${value}`)
      .join('\r\n');
  }

  getResponseHeader(name: string): string | null {
    return this.#response?.headers.get(name) ?? null;
  }

  open(
    method: string,
    url: string,
    async = true,
    username: string | null = null,
    password: string | null = null,
  ): void {
    // eslint-disable-next-line no-param-reassign
    method = method.toLocaleUpperCase();
    if (!METHODS.includes(method)) {
      throw new DOMException(
        `The method "${method}" is not allowed.`,
        'SyntaxError',
      );
    }
    let parsedUrl: URL;
    try {
      let base: string | undefined;
      try {
        base = window.location.toString();
      } catch {
        // we just want to avoid the error about location in Deno
      }
      parsedUrl = new URL(url, base);
    } catch {
      throw new DOMException(`The url "${url}" is invalid.`, 'SyntaxError');
    }
    if (username != null) {
      parsedUrl.username = username;
    }
    if (password != null) {
      parsedUrl.password = password;
    }
    if (async === false) {
      throw new DOMException(
        'The polyfill does not support sync operation.',
        'InvalidAccessError',
      );
    }
    this.#terminate();
    this.#sendFlag = false;
    this.#uploadListener = false;
    this.#requestMethod = method;
    this.#url = parsedUrl;
    this.#headers = new Headers();
    this.#response = undefined;
    this.#state = State.OPENED;
    this.dispatchEvent(new Event('readystatechange'));
  }

  overrideMimeType(mime: string): void {
    if (this.#state === State.LOADING || this.#state === State.DONE) {
      throw new DOMException(
        'The request is in an invalid state',
        'InvalidStateError',
      );
    }
    this.#mime = mimeTypes.contentType(mime) || 'application/octet-stream';
  }

  send(body: BodyInit | null = null): void {
    if (this.#state !== State.OPENED) {
      throw new DOMException('Invalid state', 'InvalidStateError');
    }
    if (this.#sendFlag) {
      throw new DOMException('Invalid state', 'InvalidStateError');
    }
    if (this.#requestMethod === 'GET' || this.#requestMethod === 'HEAD') {
      // eslint-disable-next-line no-param-reassign
      body = null;
    }
    const abortController = new AbortController();
    this.#abortController = abortController;
    // eslint-disable-next-line  @typescript-eslint/no-non-null-assertion
    const req = new Request(this.#url!.toString(), {
      method: this.#requestMethod,
      headers: this.#headers,
      body,
      mode: 'cors',
      credentials: this.#crossOriginCredentials ? 'include' : 'same-origin',
      signal: abortController.signal,
    });
    this.#uploadCompleteFlag = false;
    this.#timedoutFlag = false;
    if (req.body == null) {
      this.#uploadCompleteFlag = true;
    }
    this.#sendFlag = true;

    this.dispatchEvent(new ProgressEvent('loadstart', { loaded: 0, total: 0 }));
    this.#upload.dispatchEvent(
      new ProgressEvent('loadstart', { loaded: 0, total: 0 }),
    );
    if (this.#state !== State.OPENED || !this.#sendFlag) {
      return;
    }
    const processRequestEndOfBody = () => {
      this.#uploadCompleteFlag = true;
      if (!this.#uploadListener) {
        return;
      }
      this.#upload.dispatchEvent(
        new ProgressEvent('progress', { loaded: 0, total: 0 }),
      );
      this.#upload.dispatchEvent(
        new ProgressEvent('load', {
          loaded: 0,
          total: 0,
        }),
      );
      this.#upload.dispatchEvent(
        new ProgressEvent('loadend', { loaded: 0, total: 0 }),
      );
    };
    const processResponse = async (response: Response) => {
      this.#response = response;
      this.#state = State.HEADERS_RECEIVED;
      this.dispatchEvent(new Event('readystatechange'));
      if (this.#state !== State.HEADERS_RECEIVED) {
        return;
      }
      if (response.body == null) {
        this.#handleResponseEndOfBody();
        return;
      }
      const total = extractLength(this.#response) ?? 0;
      const processBodyChunk = (bytes: Uint8Array) => {
        this.#receivedBytes = appendBytes(this.#receivedBytes, bytes);
        // the specification indicates that this should return if last invoked
        // was <= 50ms ago, the problem is that often chunks arrive under that
        // and a client doesn't get a progress event, which then causes it to
        // "hang" when long polling
        if (this.#state === State.HEADERS_RECEIVED) {
          this.#state = State.LOADING;
        }
        this.dispatchEvent(new Event('readystatechange'));
        this.dispatchEvent(
          new ProgressEvent('progress', {
            loaded: this.#receivedBytes.length,
            total,
          }),
        );
      };
      const processEndOfBody = () => {
        this.#handleResponseEndOfBody();
      };
      const processBodyError = () => {
        this.#handleErrors();
      };
      try {
        // @ts-ignore
        for await (const bytes of response.body) {
          processBodyChunk(bytes);
        }
        processEndOfBody();
      } catch {
        processBodyError();
      }
    };
    const processRejection = () => {
      this.#handleErrors();
    };
    const p = fetch(req)
      .then((response) => {
        processRequestEndOfBody();
        return processResponse(response);
      })
      .catch(processRejection);
    if (this.#timeout > 0) {
      let tid = -1;
      const t = new Promise<boolean>((res) => {
        tid = setTimeout(() => res(true), this.#timeout) as any;
      });
      Promise.race([p, t]).then((value) => {
        clearTimeout(tid);
        if (value) {
          this.#timedoutFlag = true;
          this.#terminate();
        }
      });
    }
  }

  setRequestHeader(name: string, value: string): void {
    if (this.#state !== State.OPENED) {
      throw new DOMException('Invalid state', 'InvalidStateError');
    }
    if (this.#sendFlag) {
      throw new DOMException('Invalid state', 'InvalidateStateError');
    }
    this.#headers.append(name, value);
  }

  get DONE() {
    return State.DONE;
  }

  get HEADERS_RECEIVED() {
    return State.HEADERS_RECEIVED;
  }

  get LOADING() {
    return State.LOADING;
  }

  get OPENED() {
    return State.OPENED;
  }

  get UNSENT() {
    return State.UNSENT;
  }

  static get DONE() {
    return State.DONE;
  }

  static get HEADERS_RECEIVED() {
    return State.HEADERS_RECEIVED;
  }

  static get LOADING() {
    return State.LOADING;
  }

  static get OPENED() {
    return State.OPENED;
  }

  static get UNSENT() {
    return State.UNSENT;
  }
}

// deno-lint-ignore ban-types
function maybeDefine(value: any, name: string, scope: object) {
  Object.defineProperty(value, 'name', {
    value: name,
    writable: false,
    enumerable: false,
    configurable: true,
  });
  if (!(name in globalThis)) {
    Object.defineProperty(scope, name, {
      value,
      writable: true,
      configurable: true,
      enumerable: false,
    });
  }
}

maybeDefine(XMLHttpRequest, 'XMLHttpRequest', globalThis);
maybeDefine(XMLHttpRequestEventTarget, 'XMLHttpRequestEventTarget', globalThis);
maybeDefine(XMLHttpRequestUpload, 'XMLHttpRequestUpload', globalThis);
