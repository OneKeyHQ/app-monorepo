import { useEffect } from 'react';

export class AppLockBypass {
  static Singleton: AppLockBypass = new AppLockBypass();

  private value = false;

  isOK() {
    return this.value;
  }

  bypass() {
    this.value = true;
  }

  release() {
    this.value = false;
  }

  runSync(fn: () => void) {
    if (this.value) {
      return;
    }
    this.value = true;
    try {
      return fn();
    } finally {
      this.value = false;
    }
  }

  async runAsync<T>(fn: () => Promise<T>) {
    if (this.value) {
      return;
    }
    this.value = true;
    try {
      return await fn();
    } finally {
      this.value = false;
    }
  }
}

export const SkipAppLock = () => {
  useEffect(() => {
    AppLockBypass.Singleton.bypass();
    return () => {
      AppLockBypass.Singleton.release();
    };
  }, []);
  return null;
};
