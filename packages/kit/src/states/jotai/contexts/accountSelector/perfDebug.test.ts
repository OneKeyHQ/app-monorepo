import { setAccountSelectorPerfE2EAttributionEnabled } from '@onekeyhq/shared/src/logger/scopes/accountSelector/scenes/perf';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { isAccountSelectorPerfDebugEnabled } from './perfDebug';

type IMutablePlatformEnvFlags = { isE2E: boolean; isDev: boolean };

describe('isAccountSelectorPerfDebugEnabled', () => {
  const mutablePlatformEnv = platformEnv as unknown as IMutablePlatformEnvFlags;
  const originalIsE2E = mutablePlatformEnv.isE2E;
  const originalIsDev = mutablePlatformEnv.isDev;

  afterEach(() => {
    mutablePlatformEnv.isE2E = originalIsE2E;
    mutablePlatformEnv.isDev = originalIsDev;
    setAccountSelectorPerfE2EAttributionEnabled(true);
  });

  it('defaults to enabled under E2E', () => {
    mutablePlatformEnv.isE2E = true;
    expect(isAccountSelectorPerfDebugEnabled()).toBe(true);
  });

  it('honors the runtime attribution override under E2E', () => {
    mutablePlatformEnv.isE2E = true;
    setAccountSelectorPerfE2EAttributionEnabled(false);
    expect(isAccountSelectorPerfDebugEnabled()).toBe(false);
    setAccountSelectorPerfE2EAttributionEnabled(true);
    expect(isAccountSelectorPerfDebugEnabled()).toBe(true);
  });

  it('overrides the dev logger branch while E2E attribution is disabled', () => {
    // On a dev-mode E2E build the logger branch could otherwise re-enable
    // attribution and defeat the perf-off coverage.
    mutablePlatformEnv.isE2E = true;
    mutablePlatformEnv.isDev = true;
    setAccountSelectorPerfE2EAttributionEnabled(false);
    expect(isAccountSelectorPerfDebugEnabled()).toBe(false);
  });

  it('stays disabled outside E2E regardless of the override', () => {
    mutablePlatformEnv.isE2E = false;
    mutablePlatformEnv.isDev = false;
    setAccountSelectorPerfE2EAttributionEnabled(true);
    expect(isAccountSelectorPerfDebugEnabled()).toBe(false);
  });
});
