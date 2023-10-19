/* eslint-disable  */
// @ts-nocheck
class Dispatch extends EventTarget {
  dispatch(eventName) {
    const ev = new Event(eventName);
    if ('on' + eventName in this) {
      this['on' + eventName](ev);
    }
    this.dispatchEvent(ev);
  }
}
export class XMLHttpRequest extends Dispatch {
  // readyState enumeration
  UNSENT = 0;
  OPENED = 1;
  HEADERS_RECEIVED = 2;
  LOADING = 3;
  DONE = 4;

  constructor() {
    super();
    this.upload = new Dispatch();
  }

  open(method, url) {
    this.url = url;
    this.method = method;
    this.headers = new Headers();
    this.readyState = this.UNSENT;
    this.responseType = '';
    this._controller = new AbortController();
  }
  setRequestHeader(key, value) {
    this.headers.set(key, value);
  }
  abort() {
    this.upload.dispatch('abort');
    this._controller.abort();
  }
  send(payload) {
    this.readyState = this.OPENED;
    this.status = 0;
    this.dispatch('readystatechange');
    this.upload.dispatch('loadstart');
    fetch(this.url, {
      method: this.method,
      signal: this._controller.signal,
      headers: this.headers,
      credentials: this.withCredentials,
      body: payload,
    })
      .then(async (response) => {
        this.readyState = this.HEADERS_RECEIVED;
        this.responseURL = response.url;
        this.responseType = response.type;
        this.status = response.status;
        this.statusText = response.statusText;

        // todo: this is wrong, fetch response.type possible values are - basic, cors, error, opaque, opaqueredirect
        switch (this.responseType) {
          case '':
            return response.text();
          case 'arraybuffer':
            return response.arrayBuffer();
          case 'blob':
            return response.blob();
          case 'document':
            return response.text(); // todo pass through XMLParser
          case 'json':
            return response.json();
          //todo stream and status 3 and progress
        }
        return response.text();
      })
      .then(
        (value) => {
          this.response = value;
          this.readyState = this.DONE;
          this.dispatch('readystatechange');
          this.upload.dispatch('load');
          this.dispatch('load');
          this.upload.dispatch('progress');
          this.dispatch('progress');
          this.upload.dispatch('loadend');
          this.dispatch('loadend');
        },
        (err) => {
          this.dispatch('error');
          this.upload.dispatch('error');
          this.readyState = this.DONE;
          this.dispatch('readystatechange');
        },
      );
  }
  get responseText() {
    if (this.response) {
      if (this.responseType === 'arraybuffer') {
        return String.fromCharCode.apply(null, new Uint16Array(this.response)); // slower than StringEncoder/StringDecoder API, but meh
      }
      if (this.responseType === 'json') {
        return JSON.stringify(this.response);
      }
      if (this.response === 'blob') {
        return ''; //
      }
      return this.response;
    }
  }

  // No response headers suport yet!
  getAllResponseHeaders() {
    return ''; // todo fix headers at HEADERS_RECEIVED
  }
}
