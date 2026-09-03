import { ELockDuration } from '@onekeyhq/shared/src/consts/appAutoLockConsts';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { jotaiDefaultStore } from '../utils/jotaiDefaultStore';

import {
  appIsLocked,
  passwordAtom,
  passwordAtomInitialValue,
  passwordPersistAtom,
  passwordPersistManualLockStateAtom,
} from './passwordLock';
import { v4migrationAtom } from './v4migration';

describe('password Never lock session semantics', () => {
  beforeEach(() => {
    jotaiDefaultStore.set(passwordPersistAtom.atom(), {
      ...passwordAtomInitialValue,
      appLockDuration: Number(ELockDuration.Never),
      isPasswordSet: true,
    });
    const passwordState = jotaiDefaultStore.get(passwordAtom.atom());
    jotaiDefaultStore.set(passwordAtom.atom(), {
      ...passwordState,
      unLock: false,
    });
    jotaiDefaultStore.set(passwordPersistManualLockStateAtom.atom(), {
      manualLocking: false,
    });
    const migrationState = jotaiDefaultStore.get(v4migrationAtom.atom());
    jotaiDefaultStore.set(v4migrationAtom.atom(), {
      ...migrationState,
      isMigrationModalOpen: false,
      isProcessing: false,
    });
  });

  it('requires a fresh unlock on browser-class cold start', () => {
    expect(platformEnv.isNative).toBe(false);
    expect(jotaiDefaultStore.get(appIsLocked.atom())).toBe(true);

    jotaiDefaultStore.set(passwordAtom.atom(), (value) => ({
      ...value,
      unLock: true,
    }));
    expect(jotaiDefaultStore.get(appIsLocked.atom())).toBe(false);
  });

  it('keeps manual lock authoritative during an unlocked session', () => {
    jotaiDefaultStore.set(passwordAtom.atom(), (value) => ({
      ...value,
      unLock: true,
    }));
    jotaiDefaultStore.set(passwordPersistManualLockStateAtom.atom(), {
      manualLocking: true,
    });
    expect(jotaiDefaultStore.get(appIsLocked.atom())).toBe(true);
  });
});
