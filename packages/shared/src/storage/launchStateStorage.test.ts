import {
  APP_LAUNCH_STATE_STORAGE_KEY,
  createAppLaunchStateStorage,
} from './launchStateStorage.shared';

describe('appLaunchStateStorage', () => {
  function createStorage() {
    const values = new Map<string, string>();
    return {
      storage: createAppLaunchStateStorage({
        getItem: (key) => values.get(key),
        setItem: (key, value) => values.set(key, value),
      }),
      values,
    };
  }

  it('keeps an absent marker distinct from a confirmed first launch', () => {
    const { storage } = createStorage();

    expect(storage.getStatus()).toBe('legacyUnknown');
    const state = storage.markOnboardingPending();

    expect(state.onboardingCompleted).toBe(false);
    expect(storage.getStatus()).toBe('onboardingPending');
  });

  it('persists onboarding completion without losing installation identity', () => {
    const { storage } = createStorage();

    storage.setInstallationTime(123);
    storage.markOnboardingCompleted();

    expect(storage.read()).toEqual(
      expect.objectContaining({
        installationTime: 123,
        onboardingCompleted: true,
      }),
    );
  });

  it('replaces an old installation with an onboarding tombstone', () => {
    const { storage } = createStorage();
    storage.markOnboardingCompleted(123);

    storage.markFreshInstallationPending(456);

    expect(storage.read()).toEqual(
      expect.objectContaining({
        installationTime: 456,
        onboardingCompleted: false,
      }),
    );
    expect(storage.getStatus()).toBe('onboardingPending');
  });

  it('treats invalid persisted data as a first launch', () => {
    const { storage, values } = createStorage();
    values.set(APP_LAUNCH_STATE_STORAGE_KEY, '{"schemaVersion":2}');

    expect(storage.read()).toBeUndefined();
    expect(storage.getStatus()).toBe('legacyUnknown');
  });
});
