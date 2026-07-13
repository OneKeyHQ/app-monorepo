/**
 * @jest-environment jsdom
 */
/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, import/first */
// Tests for the analytics-side helpers used by softwareUpdateResult /
// startSoftwareUpdate Mixpanel events. The attempt-id state is module-
// scoped (intentional: lets resume-mid-flow callers observe the same id
// the original downloadPackage() rotated in), so each test must reset
// it via the test-only escape hatch to avoid cross-test bleed.
//
// yarn jest packages/kit/src/components/AppUpdate/updateAnalytics.test.ts

// generateUUID is mocked to a deterministic counter so we can assert
// rotation / lazy-init semantics without parsing real UUIDs.
let uuidCounter = 0;
jest.mock('@onekeyhq/shared/src/utils/miscUtils', () => ({
  generateUUID: jest.fn(() => {
    uuidCounter += 1;
    return `uuid-${uuidCounter}`;
  }),
}));

// platformEnv is the only branch input for getUpdatePlatform / fromVersion.
// We mutate the same exported object across tests so each case can pin
// the platform without re-importing.
jest.mock('@onekeyhq/shared/src/platformEnv', () => {
  const env = {
    isNativeIOS: false,
    isNativeAndroid: false,
    isDesktop: false,
    isExtension: false,
    version: '1.2.3',
    bundleVersion: '42',
  };
  (globalThis as any).__mockPlatformEnv = env;
  return { __esModule: true, default: env };
});

import {
  EUpdateFileType,
  EUpdateStrategy,
} from '@onekeyhq/shared/src/appUpdate';

import {
  __resetUpdateAttemptIdForTests,
  asOptionalString,
  asString,
  buildSoftwareUpdateParams,
  ensureUpdateAttemptId,
  getUpdateAttemptId,
  getUpdatePlatform,
  rotateUpdateAttemptId,
} from './updateAnalytics';

const platformEnv = (globalThis as any).__mockPlatformEnv as {
  isNativeIOS: boolean;
  isNativeAndroid: boolean;
  isDesktop: boolean;
  isExtension: boolean;
  version: string;
  bundleVersion: string;
};

const resetPlatformEnv = () => {
  platformEnv.isNativeIOS = false;
  platformEnv.isNativeAndroid = false;
  platformEnv.isDesktop = false;
  platformEnv.isExtension = false;
  platformEnv.version = '1.2.3';
  platformEnv.bundleVersion = '42';
};

beforeEach(() => {
  uuidCounter = 0;
  __resetUpdateAttemptIdForTests();
  resetPlatformEnv();
});

// ---------------------------------------------------------------------------
// asOptionalString / asString
// ---------------------------------------------------------------------------

describe('asOptionalString', () => {
  test('null and undefined become undefined', () => {
    expect(asOptionalString(null)).toBeUndefined();
    expect(asOptionalString(undefined)).toBeUndefined();
  });

  test('numbers, booleans, strings stringify', () => {
    expect(asOptionalString(0)).toBe('0');
    expect(asOptionalString(42)).toBe('42');
    expect(asOptionalString(false)).toBe('false');
    expect(asOptionalString('')).toBe('');
    expect(asOptionalString('abc')).toBe('abc');
  });

  test('preserves "0" / "false" instead of collapsing to undefined', () => {
    // Guards against the common bug of using `value || undefined` which
    // would lose these falsy-but-meaningful values.
    expect(asOptionalString(0)).toBe('0');
    expect(asOptionalString(false)).toBe('false');
  });
});

describe('asString', () => {
  test('null/undefined become empty string', () => {
    expect(asString(null)).toBe('');
    expect(asString(undefined)).toBe('');
  });

  test('non-nullish values are stringified', () => {
    expect(asString(0)).toBe('0');
    expect(asString('hello')).toBe('hello');
  });
});

// ---------------------------------------------------------------------------
// getUpdatePlatform — exhaustive branch table
// ---------------------------------------------------------------------------

describe('getUpdatePlatform', () => {
  test('isNativeIOS → "ios"', () => {
    platformEnv.isNativeIOS = true;
    expect(getUpdatePlatform()).toBe('ios');
  });

  test('isNativeAndroid → "android"', () => {
    platformEnv.isNativeAndroid = true;
    expect(getUpdatePlatform()).toBe('android');
  });

  test('isDesktop → "desktop"', () => {
    platformEnv.isDesktop = true;
    expect(getUpdatePlatform()).toBe('desktop');
  });

  test('isExtension → "extension"', () => {
    platformEnv.isExtension = true;
    expect(getUpdatePlatform()).toBe('extension');
  });

  test('no flags set → "web" fallback', () => {
    expect(getUpdatePlatform()).toBe('web');
  });

  test('priority: iOS wins over android (mutually exclusive in prod, but assert anyway)', () => {
    platformEnv.isNativeIOS = true;
    platformEnv.isNativeAndroid = true;
    expect(getUpdatePlatform()).toBe('ios');
  });
});

// ---------------------------------------------------------------------------
// buildSoftwareUpdateParams
// ---------------------------------------------------------------------------

describe('buildSoftwareUpdateParams', () => {
  const baseInfo = {
    latestVersion: '2.0.0',
    jsBundleVersion: '99',
    updateStrategy: EUpdateStrategy.manual,
  } as any;

  test('appShell uses platformEnv.version as fromVersion + appUpdateInfo.latestVersion as toVersion', () => {
    platformEnv.isDesktop = true;
    const params = buildSoftwareUpdateParams(
      EUpdateFileType.appShell,
      baseInfo,
    );
    expect(params.updateType).toBe('app');
    expect(params.fromVersion).toBe('1.2.3');
    expect(params.toVersion).toBe('2.0.0');
    expect(params.platform).toBe('desktop');
  });

  test('jsBundle uses platformEnv.bundleVersion as fromVersion + appUpdateInfo.jsBundleVersion as toVersion', () => {
    platformEnv.isNativeIOS = true;
    const params = buildSoftwareUpdateParams(
      EUpdateFileType.jsBundle,
      baseInfo,
    );
    expect(params.updateType).toBe('bundle');
    expect(params.fromVersion).toBe('42');
    expect(params.toVersion).toBe('99');
    expect(params.platform).toBe('ios');
  });

  test('uses provided attemptId verbatim instead of generating one', () => {
    const params = buildSoftwareUpdateParams(
      EUpdateFileType.appShell,
      baseInfo,
      'caller-supplied-id',
    );
    expect(params.attemptId).toBe('caller-supplied-id');
  });

  test('generates a UUID when attemptId is omitted', () => {
    const params = buildSoftwareUpdateParams(
      EUpdateFileType.appShell,
      baseInfo,
    );
    expect(params.attemptId).toBe('uuid-1');
  });

  test.each([
    [EUpdateStrategy.silent, 'silent'],
    [EUpdateStrategy.force, 'force'],
    [EUpdateStrategy.manual, 'manual'],
    [EUpdateStrategy.seamless, 'seamless'],
  ])('maps EUpdateStrategy.%s → "%s"', (strategy, label) => {
    const params = buildSoftwareUpdateParams(EUpdateFileType.appShell, {
      ...baseInfo,
      updateStrategy: strategy,
    });
    expect(params.updateStrategy).toBe(label);
  });

  test('unknown updateStrategy enum value falls back to "unknown"', () => {
    const params = buildSoftwareUpdateParams(EUpdateFileType.appShell, {
      ...baseInfo,
      updateStrategy: 999 as EUpdateStrategy,
    });
    expect(params.updateStrategy).toBe('unknown');
  });

  test('null/undefined version fields stringify to empty (no "undefined" leakage)', () => {
    platformEnv.version = undefined as unknown as string;
    platformEnv.bundleVersion = null as unknown as string;
    const params = buildSoftwareUpdateParams(EUpdateFileType.appShell, {
      ...baseInfo,
      latestVersion: undefined,
    });
    expect(params.fromVersion).toBe('');
    expect(params.toVersion).toBe('');
  });
});

// ---------------------------------------------------------------------------
// Attempt-id lifecycle
// ---------------------------------------------------------------------------

describe('attempt-id lifecycle', () => {
  test('getUpdateAttemptId returns undefined before any ensure/rotate', () => {
    expect(getUpdateAttemptId()).toBeUndefined();
  });

  test('ensureUpdateAttemptId lazy-inits and is idempotent', () => {
    const first = ensureUpdateAttemptId();
    const second = ensureUpdateAttemptId();
    expect(first).toBe('uuid-1');
    expect(second).toBe('uuid-1');
    expect(getUpdateAttemptId()).toBe('uuid-1');
  });

  test('rotateUpdateAttemptId always mints a new id (no carry-over)', () => {
    const a = rotateUpdateAttemptId();
    const b = rotateUpdateAttemptId();
    expect(a).toBe('uuid-1');
    expect(b).toBe('uuid-2');
    expect(a).not.toBe(b);
    expect(getUpdateAttemptId()).toBe('uuid-2');
  });

  test('ensureUpdateAttemptId after rotate does NOT rotate again', () => {
    rotateUpdateAttemptId(); // uuid-1
    expect(ensureUpdateAttemptId()).toBe('uuid-1');
    expect(getUpdateAttemptId()).toBe('uuid-1');
  });

  test('__resetUpdateAttemptIdForTests clears module state', () => {
    ensureUpdateAttemptId();
    expect(getUpdateAttemptId()).toBeDefined();
    __resetUpdateAttemptIdForTests();
    expect(getUpdateAttemptId()).toBeUndefined();
  });

  test('rotation simulates downloadPackage() starting a fresh attempt', () => {
    // Boot: ensure() (cold-launch resume path lazy-inits)
    const cold = ensureUpdateAttemptId();
    // Later: user manually triggers a fresh download → rotate()
    const fresh = rotateUpdateAttemptId();
    expect(fresh).not.toBe(cold);
    // Mid-flow verify step lazily reads the rotated id, not a third one
    expect(ensureUpdateAttemptId()).toBe(fresh);
  });
});
