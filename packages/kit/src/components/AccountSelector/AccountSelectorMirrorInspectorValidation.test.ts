import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { validateAccountSelectorMirror } from './AccountSelectorMirrorInspectorValidation';

import type {
  IAccountSelectorMirrorStateSnapshot,
  IAccountSelectorMirrorValidationInput,
} from './AccountSelectorMirrorInspectorValidation';

function buildState({
  address = '0x1234567890abcdef',
  deriveType = 'default',
  networkId = 'evm--1',
}: {
  address?: string;
  deriveType?: string;
  networkId?: string;
} = {}): IAccountSelectorMirrorStateSnapshot {
  const selected = {
    deriveType,
    indexedAccountId: 'indexed-1',
    networkId,
    othersWalletAccountId: undefined,
    walletId: 'wallet-1',
  };
  return {
    active: {
      ...selected,
      accountName: 'Account 1',
      address,
      ready: true,
    },
    selected,
  };
}

function buildInput(
  overrides: Partial<IAccountSelectorMirrorValidationInput> = {},
): IAccountSelectorMirrorValidationInput {
  const state = buildState();
  return {
    actual: state,
    actualConfig: { sceneName: EAccountSelectorSceneName.home },
    consumer: { status: 'pass' },
    enabledNum: [0],
    expected: state,
    expectedConfig: { sceneName: EAccountSelectorSceneName.home },
    instanceId: 1,
    isSameStore: true,
    num: 0,
    observedAt: 10_000,
    perfDebugName: 'home-page',
    persistence: { status: 'pass' },
    probeName: 'home-page',
    stableForMs: 2000,
    storageReady: true,
    syncLoading: false,
    transition: {
      activeReloadId: 1,
      activeScheduleId: 1,
      activeTrigger: 'selectedAccountChanged',
      selectedReason: 'userSelectAccount',
      transitionId: 1,
      updatedAt: 1,
    },
    ...overrides,
  };
}

describe('validateAccountSelectorMirror', () => {
  it('reports pass when Context, persistence and consumer all agree', () => {
    const report = validateAccountSelectorMirror(buildInput());
    expect(report.overallStatus).toBe('pass');
    expect(report.contextStatus).toBe('pass');
    expect(report.findings).toEqual([]);
  });

  it('reports a stable selected/active account mismatch as fail', () => {
    const state = buildState();
    const report = validateAccountSelectorMirror(
      buildInput({
        actual: {
          ...state,
          active: {
            ...state.active!,
            indexedAccountId: 'indexed-2',
          },
        },
        expected: {
          ...state,
          active: {
            ...state.active!,
            indexedAccountId: 'indexed-2',
          },
        },
      }),
    );
    expect(report.contextStatus).toBe('fail');
    expect(report.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: 'selectedActive.indexedAccountId',
          status: 'fail',
        }),
      ]),
    );
  });

  it('returns field-level network, derive type and address findings', () => {
    const report = validateAccountSelectorMirror(
      buildInput({
        actual: buildState({
          address: '0xactual',
          deriveType: 'ledgerLive',
          networkId: 'evm--137',
        }),
        expected: buildState({
          address: '0xexpected',
          deriveType: 'default',
          networkId: 'evm--1',
        }),
      }),
    );
    expect(report.contextStatus).toBe('fail');
    expect(report.findings.map((finding) => finding.field)).toEqual(
      expect.arrayContaining([
        'selected.networkId',
        'selected.deriveType',
        'active.networkId',
        'active.deriveType',
        'active.address',
      ]),
    );
  });

  it('keeps a transition mismatch pending during the settle window', () => {
    const report = validateAccountSelectorMirror(
      buildInput({
        actual: buildState({ networkId: 'evm--137' }),
        expected: buildState({ networkId: 'evm--1' }),
        stableForMs: 200,
      }),
    );
    expect(report.contextStatus).toBe('pending');
    expect(report.findings).toEqual(
      expect.arrayContaining([expect.objectContaining({ status: 'pending' })]),
    );
  });

  it('marks an older transition as superseded instead of failed', () => {
    const report = validateAccountSelectorMirror(
      buildInput({
        actual: buildState({ networkId: 'evm--137' }),
        expected: buildState({ networkId: 'evm--1' }),
        expectedTransition: {
          activeReloadId: 2,
          activeScheduleId: 2,
          activeTrigger: 'selectedAccountChanged',
          selectedReason: 'userSelectNetwork',
          transitionId: 2,
          updatedAt: 2,
        },
        transition: {
          activeReloadId: 1,
          activeScheduleId: 1,
          activeTrigger: 'selectedAccountChanged',
          selectedReason: 'userSelectNetwork',
          transitionId: 1,
          updatedAt: 1,
        },
      }),
    );
    expect(report.contextStatus).toBe('superseded');
    expect(report.overallStatus).toBe('superseded');
  });

  it('accepts an empty AddressInput selection', () => {
    const emptyState: IAccountSelectorMirrorStateSnapshot = {
      active: undefined,
      selected: undefined,
    };
    const report = validateAccountSelectorMirror(
      buildInput({
        actual: emptyState,
        actualConfig: { sceneName: EAccountSelectorSceneName.addressInput },
        consumer: undefined,
        expected: emptyState,
        expectedConfig: {
          sceneName: EAccountSelectorSceneName.addressInput,
        },
        persistence: undefined,
      }),
    );
    expect(report.contextStatus).toBe('pass');
    expect(report.persistenceStatus).toBe('notApplicable');
    expect(report.findings).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ status: 'fail' })]),
    );
  });

  it('validates Swap slots independently', () => {
    const fromState = buildState({ networkId: 'evm--1' });
    const toState = buildState({ networkId: 'evm--137' });
    const fromReport = validateAccountSelectorMirror(
      buildInput({
        actual: fromState,
        actualConfig: { sceneName: EAccountSelectorSceneName.swap },
        enabledNum: [0, 1],
        expected: fromState,
        expectedConfig: { sceneName: EAccountSelectorSceneName.swap },
        num: 0,
      }),
    );
    const toReport = validateAccountSelectorMirror(
      buildInput({
        actual: toState,
        actualConfig: { sceneName: EAccountSelectorSceneName.swap },
        enabledNum: [0, 1],
        expected: toState,
        expectedConfig: { sceneName: EAccountSelectorSceneName.swap },
        num: 1,
      }),
    );
    expect([fromReport.contextStatus, toReport.contextStatus]).toEqual([
      'pass',
      'pass',
    ]);
    expect(fromReport.actual.selected?.networkId).toBe('evm--1');
    expect(toReport.actual.selected?.networkId).toBe('evm--137');
  });

  it('does not apply a single-chain derive rule to All Networks', () => {
    const state = buildState({ networkId: 'onekeyall--0' });
    state.active = {
      ...state.active!,
      address: 'AllNetworkMockAddress',
      deriveType: undefined,
    };
    const report = validateAccountSelectorMirror(
      buildInput({ actual: state, expected: state }),
    );
    expect(report.contextStatus).toBe('pass');
    expect(report.findings.map((finding) => finding.field)).not.toContain(
      'selectedActive.deriveType',
    );
  });

  it('does not claim full verification without a Consumer Adapter', () => {
    const report = validateAccountSelectorMirror(
      buildInput({ consumer: undefined, persistence: undefined }),
    );
    expect(report.contextStatus).toBe('pass');
    expect(report.consumerStatus).toBe('notObserved');
    expect(report.overallStatus).toBe('notObserved');
  });
});
