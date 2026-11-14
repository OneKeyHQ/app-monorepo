import { ELockDuration } from '@onekeyhq/shared/src/consts/appAutoLockConsts';

let mockReady = Promise.resolve();
let mockLocked = false;
let mockPassword = { isPasswordSet: true, appLockDuration: 5 };
let mockTime = 1_700_000_000_000;
let mockTravel = false;
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms/passwordLock', () => ({
  appIsLocked: { atom: () => 'locked', ready: () => mockReady },
  passwordPersistAtom: { atom: () => 'password', ready: () => mockReady },
}));
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms/settings', () => ({
  settingsLastActivityAtom: { atom: () => 'activity', ready: () => mockReady },
}));
jest.mock('@onekeyhq/kit-bg/src/states/jotai/utils/jotaiDefaultStore', () => ({
  jotaiDefaultStore: {
    get: (key: string) => {
      if (key === 'locked') return mockLocked;
      if (key === 'password') return mockPassword;
      return { time: mockTime };
    },
  },
}));
jest.mock('@onekeyhq/shared/src/travelMode', () => ({
  travelModeManager: {
    getRuntimeEnvironmentSync: () => ({
      profile: { kind: mockTravel ? 'travel-mode' : 'standard' },
    }),
  },
}));
let subject: typeof import('./lockState');
beforeEach(async () => {
  jest.resetModules();
  jest.useFakeTimers();
  mockReady = Promise.resolve();
  mockLocked = false;
  mockPassword = { isPasswordSet: true, appLockDuration: 5 };
  mockTime = 1_700_000_000_000;
  mockTravel = false;
  jest.setSystemTime(mockTime);
  subject = await import('./lockState');
});
afterEach(() => jest.useRealTimers());
it('denies requests before the main lock boundary is initialized', async () => {
  expect(subject.isIntercomLocked()).toBe(true);
  await subject.markIntercomLockReady();
  expect(subject.isIntercomLocked()).toBe(false);
});
it('reads manual locking and auto-lock deadlines directly even before a hook runs', async () => {
  await subject.markIntercomLockReady();
  mockLocked = true;
  expect(subject.isIntercomLocked()).toBe(true);
  mockLocked = false;
  expect(subject.isIntercomLocked()).toBe(false);
  jest.setSystemTime(mockTime + 5 * 60_000);
  expect(subject.isIntercomLocked()).toBe(true);
  mockTime = Date.now();
  expect(subject.isIntercomLocked()).toBe(false);
  jest.setSystemTime(mockTime - 1);
  expect(subject.isIntercomLocked()).toBe(true);
});
it('preserves no-password, Never, and travel-mode auto-lock semantics', async () => {
  await subject.markIntercomLockReady();
  jest.setSystemTime(mockTime + 3_600_000);
  mockPassword.isPasswordSet = false;
  expect(subject.isIntercomLocked()).toBe(false);
  mockPassword = {
    isPasswordSet: true,
    appLockDuration: Number(ELockDuration.Never),
  };
  expect(subject.isIntercomLocked()).toBe(false);
  mockPassword.appLockDuration = 5;
  mockTravel = true;
  expect(subject.isIntercomLocked()).toBe(false);
});

it('does not treat default unlocked values as authoritative before storage is ready', async () => {
  let release!: () => void;
  mockReady = new Promise<void>((resolve) => {
    release = resolve;
  });
  const initializing = subject.markIntercomLockReady();
  expect(subject.isIntercomLocked()).toBe(true);
  mockLocked = true;
  release();
  await initializing;
  expect(subject.isIntercomLocked()).toBe(true);
  mockLocked = false;
  expect(subject.isIntercomLocked()).toBe(false);
});
