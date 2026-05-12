if (typeof globalThis.window === 'undefined') {
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    writable: true,
    value: globalThis,
  });
}

if (typeof globalThis.self === 'undefined') {
  Object.defineProperty(globalThis, 'self', {
    configurable: true,
    writable: true,
    value: globalThis,
  });
}

if (typeof globalThis.navigator === 'undefined') {
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    writable: true,
    value: {
      maxTouchPoints: 0,
      userAgent: 'jest',
    },
  });
}

const storage = {
  _d: {} as Record<string, string>,
  getItem(key: string) {
    return this._d[key] ?? null;
  },
  setItem(key: string, value: string) {
    this._d[key] = String(value);
  },
  removeItem(key: string) {
    delete this._d[key];
  },
  clear() {
    this._d = {};
  },
  key(index: number) {
    return Object.keys(this._d)[index] ?? null;
  },
  get length() {
    return Object.keys(this._d).length;
  },
};

Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  writable: true,
  value: storage,
});
