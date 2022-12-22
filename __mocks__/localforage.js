class LocalStorageMock {
  constructor() {
    this.store = {};
  }

  clear() {
    this.store = {};
  }

  getItem(key) {
    return this.store[key] || null;
  }

  setItem(key, value) {
    this.store[key] = String(value);
  }

  removeItem(key) {
    delete this.store[key];
  }

  config() {
    return null;
  }

  ready() {
    return true;
  }

  driver() {
    return 'localStorageWrapper';
  }
}

export default new LocalStorageMock();
