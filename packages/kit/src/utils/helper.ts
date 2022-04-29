import { getTime } from 'date-fns';

export const getTimeStamp = () => getTime(new Date());

export const delay = (ms: number) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

export const timeout = <T>(p: Promise<T>, ms: number) =>
  new Promise<T>((resolve, reject) => {
    setTimeout(() => reject(new Error('Timeout')), ms);
    p.then((value) => resolve(value)).catch((err) => reject(err));
  });

export class Atom {
  static AppState: Atom = new Atom();

  private locked = false;

  isLocked() {
    return this.locked;
  }

  lock() {
    this.locked = true;
  }

  release() {
    this.locked = false;
  }

  runSync(fn: () => void) {
    if (this.locked) {
      return;
    }
    this.locked = true;
    try {
      return fn();
    } finally {
      this.locked = false;
    }
  }

  async runAsync(fn: () => Promise<unknown>) {
    if (this.locked) {
      return;
    }
    this.locked = true;
    try {
      return await fn();
    } finally {
      this.locked = false;
    }
  }
}
