// Desktop main-process MMKV implementation backed by electron-store.
// Also registers synchronous IPC handlers so the renderer process can
// access the same persistent store via ipcRenderer.sendSync().

import { ipcMain } from 'electron';
import Store from 'electron-store';

const IPC_CHANNEL = 'mmkv:sync';
const PERSISTENT_IDS = new Set(['onekey-app-setting']);

const stores = new Map<string, Store>();

function getOrCreateStore(id: string): Store {
  let s = stores.get(id);
  if (!s) {
    s = new Store({ name: `mmkv-${id}` });
    stores.set(id, s);
  }
  return s;
}

// ---------------------------------------------------------------------------
// IPC handler (synchronous) — renderer calls ipcRenderer.sendSync(IPC_CHANNEL, …)
// ---------------------------------------------------------------------------
if (ipcMain) {
  ipcMain.on(
    IPC_CHANNEL,
    (
      event,
      args: { method: string; id: string; key?: string; value?: unknown },
    ) => {
      const { method, id, key } = args;
      const store = getOrCreateStore(id);
      let result: unknown;
      switch (method) {
        case 'set':
          store.set(key!, args.value);
          break;
        case 'getString': {
          const v = store.get(key!);
          result = typeof v === 'string' ? v : undefined;
          break;
        }
        case 'getNumber': {
          const v = store.get(key!);
          result = typeof v === 'number' ? v : undefined;
          break;
        }
        case 'getBoolean': {
          const v = store.get(key!);
          result = typeof v === 'boolean' ? v : undefined;
          break;
        }
        case 'remove': {
          result = store.has(key!);
          store.delete(key!);
          break;
        }
        case 'contains':
          result = store.has(key!);
          break;
        case 'getAllKeys':
          result = Object.keys(store.store);
          break;
        case 'clearAll':
          store.clear();
          break;
        default:
          break;
      }
      event.returnValue = result;
    },
  );
}

// ---------------------------------------------------------------------------
// MMKV class — used directly in the main process via createMMKV()
// ---------------------------------------------------------------------------
class MMKV {
  private store: Store | null;

  private memoryStore: Map<string, boolean | string | number | ArrayBuffer>;

  private listeners: Set<(changedKey: string) => void>;

  constructor(options: { id: string }) {
    this.listeners = new Set();
    this.memoryStore = new Map();
    this.store = PERSISTENT_IDS.has(options.id)
      ? getOrCreateStore(options.id)
      : null;
  }

  set(key: string, value: boolean | string | number | ArrayBuffer): void {
    if (this.store) {
      this.store.set(key, value);
    } else {
      this.memoryStore.set(key, value);
    }
    this.notifyListeners(key);
  }

  getString(key: string): string | undefined {
    const value = this.store ? this.store.get(key) : this.memoryStore.get(key);
    return typeof value === 'string' ? value : undefined;
  }

  getNumber(key: string): number | undefined {
    const value = this.store ? this.store.get(key) : this.memoryStore.get(key);
    return typeof value === 'number' ? value : undefined;
  }

  getBoolean(key: string): boolean | undefined {
    const value = this.store ? this.store.get(key) : this.memoryStore.get(key);
    return typeof value === 'boolean' ? value : undefined;
  }

  getBuffer(_key: string): ArrayBuffer | undefined {
    return undefined;
  }

  getAllKeys(): string[] {
    if (this.store) {
      return Object.keys(this.store.store);
    }
    return Array.from(this.memoryStore.keys());
  }

  recrypt(_key: string | undefined): void {
    // eslint-disable-next-line no-restricted-syntax
    throw new Error('Method not implemented.');
  }

  remove(key: string): boolean {
    let result: boolean;
    if (this.store) {
      result = this.store.has(key);
      this.store.delete(key);
    } else {
      result = this.memoryStore.delete(key);
    }
    this.notifyListeners(key);
    return result;
  }

  contains(key: string): boolean {
    if (this.store) {
      return this.store.has(key);
    }
    return this.memoryStore.has(key);
  }

  clearAll(): void {
    const keys = this.getAllKeys();
    if (this.store) {
      this.store.clear();
    } else {
      this.memoryStore.clear();
    }
    keys.forEach((key) => this.notifyListeners(key));
  }

  addOnValueChangedListener(listener: (changedKey: string) => void): {
    remove: () => void;
  } {
    this.listeners.add(listener);
    return {
      remove: () => {
        this.listeners.delete(listener);
      },
    };
  }

  private notifyListeners(key: string): void {
    this.listeners.forEach((listener) => listener(key));
  }
}

export const createMMKV = (options: { id: string }): MMKV => new MMKV(options);
