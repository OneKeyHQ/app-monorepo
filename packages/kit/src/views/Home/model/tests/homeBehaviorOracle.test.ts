import {
  buildHomeWalletCapabilityTabModel,
  resolveHomeWalletSelectedTab,
} from '../../homeWalletCapabilityTabModel';
import { isNativeHomePortfolioRequestCurrent } from '../../nativeHomePortfolioRequestLifecycle';
import { resolveHomeWalletPageSurface } from '../../pages/homeWalletPageSurface';
import {
  type IPerpsHomePortfolioResult,
  selectCurrentPerpsHomePortfolioResult,
} from '../../pages/perpsHomePortfolioAuthority';
import { createHomeHistoryStoreResult } from '../sections/history/homeHistoryControllerUtils';
import { createHomeHistoryStorePayload } from '../sections/history/homeHistoryStoreModel';

import {
  type IHomeBehaviorOracleProbe,
  REQUIRED_HOME_BEHAVIOR_ORACLE_VECTOR_IDS,
  homeBehaviorOracleFixtures,
  homeUICoverageManifest,
} from './fixtures/homeBehaviorOracleFixtures';
import {
  type IHomeLegacyAmountSourceAuthority,
  resolveHomeLegacyBalanceAmountPresentation,
  resolveHomeLegacyBalanceState,
  resolveHomeLegacyHeaderActionPresentation,
  resolveHomeLegacyScopeCachedBalanceState,
} from './fixtures/homeLegacyBalanceOracle';

const authoritativeRequiredHomeUICoverageIds = [
  'account8ToAccount1',
  'account1ToAccount8',
  'scopeAllNetworks',
  'scopeBitcoin',
  'scopeEthereum',
  'scopeSolana',
  'scopePolygon',
  'scopeTon',
  'scopeTron',
  'tabSpot',
  'tabPerps',
  'tabDefi',
  'tabNft',
  'tabHistory',
  'marketFavorites',
  'marketTrending',
  'marketStocks',
  'marketPerps',
  'marketStarToggle',
  'marketAdd4Tokens',
  'pressedState',
  'hoverState',
  'focusState',
  'historyNonEmpty',
  'historyFooter',
  'historyIncomingValue',
  'nftToHistoryTransition',
  'scrollBidirectionalInertia',
  'scrollBottomReachability',
  'themeDark',
  'themeLight',
  'dynamicTypeLargeAndXxxl',
  'imageCandidatesSuccess',
  'imageCandidatesAllFailed',
  'pageFooterWarning',
  'freshOnboarding',
  'noWalletFirstLaunch',
  'firstCreatedEmptyWallet',
  'genuineSingleNetworkFunded',
  'positiveUnbackedWallet',
  'otherWalletTypes',
  'androidDebug',
  'iosBelow17_4',
] as const;

const scopeA = 'wallet-fixture-a__account-fixture-a__network-fixture-all';
const scopeB = 'wallet-fixture-a__account-fixture-b__network-fixture-all';

function source(
  scopeKey: string | undefined,
  status: IHomeLegacyAmountSourceAuthority['status'],
  included = true,
): IHomeLegacyAmountSourceAuthority {
  return { included, scopeKey, status };
}

function runExecutableProbe(probe: IHomeBehaviorOracleProbe) {
  switch (probe) {
    case 'homeSurfaceUnbacked': {
      const wallet = {
        id: 'wallet-fixture-unbacked',
        type: 'hd',
        backuped: false,
      };
      expect(
        resolveHomeWalletPageSurface({
          activeWallet: wallet,
          launchDecision: 'main',
          nativeHomeEnabled: true,
          walletContentReadiness: 'wallet',
          walletListWallet: wallet,
        }),
      ).toEqual({
        surface: 'native',
        walletId: 'wallet-fixture-unbacked',
      });
      return;
    }
    case 'backedZeroBalance': {
      const state = resolveHomeLegacyBalanceState({
        currentScopeKey: scopeB,
        hasCurrentPositiveBalance: false,
        hasHoldings: false,
        hasWallet: true,
        lastConfirmedBalanceIsPositive: undefined,
        portfolioAuthority: {
          generation: 2,
          scopeKey: scopeB,
          status: 'success',
        },
      });
      expect(state).toBe('zero');
      expect(resolveHomeLegacyHeaderActionPresentation(state)).toEqual({
        actionLayout: 'zeroBalance',
        rowHeight: 82,
        slotKind: 'zero',
      });
      expect(
        resolveHomeLegacyBalanceAmountPresentation({
          confirmedValueUsd: '0',
          deFi: source(scopeB, 'success'),
          liveValueUsd: '0',
          ownerKey: 'account-fixture-b__network-fixture-all',
          perps: source(scopeB, 'success'),
          portfolio: source(scopeB, 'success'),
          scopeKey: scopeB,
        }),
      ).toEqual({
        commit: {
          ownerKey: 'account-fixture-b__network-fixture-all',
          scopeKey: scopeB,
          valueUsd: '0',
        },
        presentation: { status: 'final', valueUsd: '0' },
      });
      return;
    }
    case 'fundedAllNetworksAmount': {
      expect(
        resolveHomeLegacyBalanceAmountPresentation({
          confirmedValueUsd: '120',
          deFi: source(scopeB, 'success'),
          liveValueUsd: '125',
          ownerKey: 'account-fixture-b__network-fixture-all',
          perps: source(scopeB, 'success'),
          portfolio: source(scopeB, 'success'),
          scopeKey: scopeB,
        }),
      ).toEqual({
        commit: {
          ownerKey: 'account-fixture-b__network-fixture-all',
          scopeKey: scopeB,
          valueUsd: '125',
        },
        presentation: { status: 'final', valueUsd: '125' },
      });
      return;
    }
    case 'fundedBitcoinCapability': {
      expect(
        resolveHomeLegacyBalanceState({
          currentScopeKey: scopeB,
          hasCurrentPositiveBalance: true,
          hasHoldings: true,
          hasWallet: true,
          lastConfirmedBalanceIsPositive: undefined,
          portfolioAuthority: {
            generation: 1,
            scopeKey: scopeB,
            status: 'success',
          },
        }),
      ).toBe('positive');
      expect(
        buildHomeWalletCapabilityTabModel({
          isDeFiSupported: false,
          isPerpsSupported: false,
          isReady: true,
        }),
      ).toEqual({
        isDeFiVisible: false,
        isPerpsVisible: false,
        shouldCommitTabs: true,
        status: 'confirmed',
      });
      return;
    }
    case 'scopeSwitchExactCache': {
      const remembered = resolveHomeLegacyScopeCachedBalanceState({
        computed: 'positive',
        previous: { entries: [] },
        scopeKey: scopeB,
      });
      expect(
        resolveHomeLegacyScopeCachedBalanceState({
          computed: 'unknown',
          previous: remembered.cache,
          scopeKey: scopeB,
        }).state,
      ).toBe('positive');
      return;
    }
    case 'scopeSwitchNoCache': {
      const state = resolveHomeLegacyScopeCachedBalanceState({
        computed: 'unknown',
        previous: {
          entries: [{ scopeKey: scopeA, state: 'positive' }],
        },
        scopeKey: scopeB,
      }).state;
      expect(state).toBe('unknown');
      expect(resolveHomeLegacyHeaderActionPresentation(state)).toEqual({
        actionLayout: 'loading',
        rowHeight: 82,
        slotKind: 'loading',
      });
      return;
    }
    case 'backgroundNotReady': {
      const state = resolveHomeLegacyBalanceState({
        currentScopeKey: scopeB,
        hasCurrentPositiveBalance: false,
        hasHoldings: false,
        hasWallet: true,
        lastConfirmedBalanceIsPositive: undefined,
        portfolioAuthority: {
          generation: 1,
          scopeKey: scopeB,
          status: 'loading',
        },
      });
      expect(state).toBe('unknown');
      expect(resolveHomeLegacyHeaderActionPresentation(state).slotKind).toBe(
        'loading',
      );
      return;
    }
    case 'partialPortfolioResponse': {
      expect(
        resolveHomeLegacyBalanceAmountPresentation({
          confirmedValueUsd: '80',
          deFi: source(scopeB, 'success'),
          liveValueUsd: '30',
          ownerKey: 'account-fixture-b__network-fixture-all',
          perps: source(scopeB, 'success', false),
          portfolio: source(scopeB, 'loading'),
          scopeKey: scopeB,
        }),
      ).toEqual({
        commit: undefined,
        presentation: { status: 'confirmed', valueUsd: '80' },
      });
      return;
    }
    case 'staleDefiResponse': {
      expect(
        resolveHomeLegacyBalanceAmountPresentation({
          confirmedValueUsd: '70',
          deFi: source(scopeA, 'success'),
          liveValueUsd: '90',
          ownerKey: 'account-fixture-b__network-fixture-all',
          perps: source(scopeB, 'success', false),
          portfolio: source(scopeB, 'success'),
          scopeKey: scopeB,
        }),
      ).toEqual({
        commit: undefined,
        presentation: { status: 'confirmed', valueUsd: '70' },
      });
      return;
    }
    case 'stalePerpsResponse': {
      const current: IPerpsHomePortfolioResult<string> = {
        address: 'address-fixture-shared',
        requestResolved: true,
        scopeKey: scopeB,
        view: 'owner-b-view',
      };
      const stale: IPerpsHomePortfolioResult<string> = {
        address: 'address-fixture-shared',
        requestResolved: true,
        scopeKey: scopeA,
        view: 'owner-a-view',
      };
      expect(
        selectCurrentPerpsHomePortfolioResult({
          currentScopeKey: scopeB,
          incoming: stale,
          previous: current,
        }),
      ).toBe(current);
      return;
    }
    case 'historyEmptyStore': {
      expect(
        createHomeHistoryStoreResult(
          createHomeHistoryStorePayload({
            addressMap: {},
            data: [],
            tokenMap: {},
          }),
        ),
      ).toMatchObject({
        kind: 'ready',
        rowIds: [],
        data: { addressMap: {}, data: [], tokenMap: {} },
      });
      return;
    }
    case 'capabilityChanged': {
      expect(
        buildHomeWalletCapabilityTabModel({
          isDeFiSupported: false,
          isPerpsSupported: false,
          isReady: true,
        }).shouldCommitTabs,
      ).toBe(true);
      expect(
        resolveHomeWalletSelectedTab({
          fallbackTabId: 'portfolio',
          selectedTabId: 'defi',
          visibleTabIds: ['portfolio', 'history'],
        }),
      ).toBe('portfolio');
      return;
    }
    case 'sameScopeRequestOutOfOrder': {
      const owner = { epoch: 3, scopeKey: 'scope-fixture-same' };
      expect(
        isNativeHomePortfolioRequestCurrent({
          currentGeneration: 2,
          currentOwner: owner,
          request: { ...owner, generation: 2 },
        }),
      ).toBe(true);
      expect(
        isNativeHomePortfolioRequestCurrent({
          currentGeneration: 2,
          currentOwner: owner,
          request: { ...owner, generation: 1 },
        }),
      ).toBe(false);
      return;
    }
    case 'partialPositiveExactZero': {
      const state = resolveHomeLegacyBalanceState({
        currentScopeKey: scopeB,
        hasCurrentPositiveBalance: true,
        hasHoldings: true,
        hasWallet: true,
        lastConfirmedBalanceIsPositive: false,
        portfolioAuthority: {
          generation: 1,
          scopeKey: scopeB,
          status: 'loading',
        },
      });
      expect(resolveHomeLegacyHeaderActionPresentation(state).slotKind).toBe(
        'positive',
      );
      expect(
        resolveHomeLegacyBalanceAmountPresentation({
          confirmedValueUsd: '0',
          deFi: source(scopeB, 'loading'),
          liveValueUsd: '15',
          ownerKey: 'account-fixture-b__network-fixture-all',
          perps: source(scopeB, 'success', false),
          portfolio: source(scopeB, 'success'),
          scopeKey: scopeB,
        }).presentation,
      ).toEqual({ status: 'confirmed', valueUsd: '0' });
      return;
    }
    case 'aggregationRequiredSetChanged': {
      const oldRequiredSet = resolveHomeLegacyBalanceAmountPresentation({
        confirmedValueUsd: '10',
        deFi: source(scopeB, 'loading', false),
        liveValueUsd: '10',
        ownerKey: 'account-fixture-b__network-fixture-all',
        perps: source(scopeB, 'success', false),
        portfolio: source(scopeB, 'success'),
        scopeKey: scopeB,
      });
      const newRequiredSet = resolveHomeLegacyBalanceAmountPresentation({
        confirmedValueUsd: '10',
        deFi: source(scopeB, 'loading', true),
        liveValueUsd: '10',
        ownerKey: 'account-fixture-b__network-fixture-all',
        perps: source(scopeB, 'success', false),
        portfolio: source(scopeB, 'success'),
        scopeKey: scopeB,
      });
      expect(oldRequiredSet.presentation.status).toBe('final');
      expect(oldRequiredSet.commit).toBeDefined();
      expect(newRequiredSet).toEqual({
        commit: undefined,
        presentation: { status: 'confirmed', valueUsd: '10' },
      });
      return;
    }
    default: {
      const exhaustive: never = probe;
      return exhaustive;
    }
  }
}

describe('Home behavior oracle fixture contract', () => {
  it('contains every required golden vector exactly once in plan order', () => {
    const ids = homeBehaviorOracleFixtures.map((fixture) => fixture.id);
    expect(ids).toEqual(REQUIRED_HOME_BEHAVIOR_ORACLE_VECTOR_IDS);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each(homeBehaviorOracleFixtures)(
    '$id has complete topology, observation, evidence, and expectation metadata',
    (fixture) => {
      expect(fixture.surfaces.length).toBeGreaterThan(0);
      expect(fixture.runtimeTopologies.length).toBeGreaterThan(0);
      expect(fixture.currentRun).toBe('notRun');
      expect(Object.keys(fixture.normalizedInputs).length).toBeGreaterThan(0);
      expect(fixture.eventSequence.length).toBeGreaterThan(0);
      expect(
        fixture.eventSequence.every((event) => event.trim().length > 0),
      ).toBe(true);
      expect([
        'intentional',
        'historicalDrift',
        'defect',
        'openDecision',
      ]).toContain(fixture.classification);
      for (const observation of [
        fixture.observed.legacy,
        fixture.observed.native,
      ]) {
        expect(['observed', 'notObserved']).toContain(observation.status);
        expect(observation.summary.trim().length).toBeGreaterThan(0);
        expect(['historicalUI', 'executableTest', 'codeInspection']).toContain(
          observation.provenance,
        );
        expect(observation.platform.trim().length).toBeGreaterThan(0);
        expect(observation.currentRun).toBe('notRun');
        if (observation.provenance === 'historicalUI') {
          expect(observation.fixture?.trim().length).toBeGreaterThan(0);
          expect(observation.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        }
      }
      expect(fixture.evidence.length).toBeGreaterThan(0);
      expect(
        fixture.evidence.every(
          ({ currentRun, kind, platform, provenance, reference }) =>
            (kind === 'test' || kind === 'ui' || kind === 'code') &&
            ['historicalUI', 'executableTest', 'codeInspection'].includes(
              provenance,
            ) &&
            platform.trim().length > 0 &&
            currentRun === 'notRun' &&
            reference.trim().length > 0,
        ),
      ).toBe(true);
      for (const evidence of fixture.evidence) {
        expect(evidence.provenance).not.toBe('currentUI');
        if (evidence.provenance === 'historicalUI') {
          expect(evidence.kind).toBe('ui');
          expect(evidence.fixture?.trim().length).toBeGreaterThan(0);
          expect(evidence.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        }
      }
      for (const observation of [
        fixture.observed.legacy,
        fixture.observed.native,
      ]) {
        expect(observation.provenance).not.toBe('currentUI');
        if (observation.provenance === 'historicalUI') {
          expect(
            fixture.evidence.some(
              (evidence) =>
                evidence.provenance === 'historicalUI' &&
                evidence.platform === observation.platform &&
                evidence.fixture === observation.fixture &&
                evidence.date === observation.date,
            ),
          ).toBe(true);
        }
        if (observation.provenance === 'executableTest') {
          expect(
            fixture.evidence.some(
              (evidence) =>
                evidence.provenance === 'executableTest' &&
                (evidence.platform === observation.platform ||
                  evidence.platform === 'shared'),
            ),
          ).toBe(true);
        }
        if (
          observation.status === 'observed' &&
          observation.provenance === 'codeInspection'
        ) {
          expect(
            fixture.evidence.some(
              (evidence) =>
                evidence.provenance === 'codeInspection' &&
                (evidence.platform === observation.platform ||
                  evidence.platform === 'shared'),
            ),
          ).toBe(true);
        }
      }
      if (fixture.productExpectation.status === 'defined') {
        expect(
          fixture.productExpectation.summary.trim().length,
        ).toBeGreaterThan(0);
      } else {
        expect(
          fixture.productExpectation.question.trim().length,
        ).toBeGreaterThan(0);
      }
      if (fixture.classification === 'historicalDrift') {
        expect(fixture.observed.legacy.status).toBe('observed');
        expect(fixture.observed.native.status).toBe('observed');
      }
      if (fixture.verification.kind === 'executable') {
        expect(fixture.verification.resolverNames.length).toBeGreaterThan(0);
      } else {
        expect(fixture.verification.reason.trim().length).toBeGreaterThan(0);
      }
    },
  );

  it('keeps normalized fixture identities synthetic and JSON serializable', () => {
    for (const fixture of homeBehaviorOracleFixtures) {
      const serialized = JSON.stringify(fixture.normalizedInputs);
      expect(serialized).toContain('fixture');
      expect(serialized).not.toMatch(/Account #[18]/);
      expect(serialized).not.toMatch(/0x[a-fA-F0-9]{40}/);
      expect(serialized.toLowerCase()).not.toContain('mnemonic');
      expect(serialized.toLowerCase()).not.toContain('seed phrase');
    }
  });

  it('keeps every existing UI reference historical and explicitly not rerun', () => {
    const uiEvidence = homeBehaviorOracleFixtures.flatMap((fixture) =>
      fixture.evidence.filter((evidence) => evidence.kind === 'ui'),
    );
    expect(uiEvidence.length).toBeGreaterThanOrEqual(8);
    for (const evidence of uiEvidence) {
      expect(evidence.provenance).toBe('historicalUI');
      expect(evidence.currentRun).toBe('notRun');
      expect(evidence.fixture?.trim().length).toBeGreaterThan(0);
      expect(evidence.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it('locks reviewer-corrected observation boundaries without implying a current UI run', () => {
    const byId = new Map(
      homeBehaviorOracleFixtures.map((fixture) => [fixture.id, fixture]),
    );
    const unbacked = byId.get('newUnbackedWallet');
    expect(unbacked?.displayName).toContain('Existing unbacked HD wallet');
    expect(unbacked?.description).toContain('not fresh onboarding');

    expect(byId.get('backedZeroWallet')?.surfaces).toEqual([
      'mobileReactNative',
      'iosNative',
    ]);
    expect(
      byId
        .get('backedZeroWallet')
        ?.evidence.some(
          (evidence) =>
            evidence.platform === 'iosLegacyReact' &&
            evidence.reference.endsWith('22-account8-legacy-zero-ab-402.png'),
        ),
    ).toBe(true);

    const noCache = byId.get('scopeSwitchWithoutCache');
    expect(noCache?.classification).toBe('historicalDrift');
    expect(noCache?.observed.legacy.provenance).toBe('codeInspection');
    expect(noCache?.observed.legacy.summary).toContain('wallet-scoped sticky');

    expect(byId.get('marketLoading')?.observed).toMatchObject({
      legacy: { status: 'notObserved' },
      native: { status: 'notObserved' },
    });
    expect(byId.get('historyEmpty')?.observed.legacy.status).toBe(
      'notObserved',
    );
    expect(byId.get('capabilityChanged')?.observed).toMatchObject({
      legacy: { status: 'notObserved' },
      native: { status: 'notObserved' },
    });

    for (const id of [
      'fundedAllNetworks',
      'scopeSwitchWithExactCache',
      'partialPortfolioResponse',
    ] as const) {
      expect(byId.get(id)?.observed).toMatchObject({
        legacy: {
          provenance: 'codeInspection',
          status: 'notObserved',
        },
        native: {
          provenance: 'executableTest',
          status: 'observed',
        },
      });
    }

    expect(byId.get('backedZeroWallet')?.normalizedInputs.balance).toEqual({
      confirmedUsd: '0',
      coverage: 'complete',
      liveUsd: '0',
    });

    for (const id of [
      'fundedAllNetworks',
      'scopeSwitchWithExactCache',
      'partialPortfolioResponse',
      'staleDefiResponse',
      'historyEmpty',
      'capabilityChanged',
      'sameScopeRequestTwoFinishesBeforeOne',
    ] as const) {
      expect(byId.get(id)?.classification).toBe('openDecision');
    }
  });
});

describe('Home UI coverage manifest contract', () => {
  it('contains every required UI coverage item exactly once in declared order', () => {
    const ids = homeUICoverageManifest.map((item) => item.id);
    expect(ids).toEqual(authoritativeRequiredHomeUICoverageIds);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each(homeUICoverageManifest)(
    '$id has explicit historical/open/blocked provenance and no current run',
    (item) => {
      expect(['historical', 'notObserved', 'open', 'blocked']).toContain(
        item.status,
      );
      expect(item.platforms.length).toBeGreaterThan(0);
      expect(item.fixture.trim().length).toBeGreaterThan(0);
      expect(item.summary.trim().length).toBeGreaterThan(0);
      expect(item.currentRun).toBe('notRun');
      if (item.status === 'historical') {
        expect(item.evidence.length).toBeGreaterThan(0);
      }
      for (const evidence of item.evidence) {
        expect(evidence.provenance).toBe('historicalUI');
        expect(evidence.currentRun).toBe('notRun');
        expect(evidence.platform).toBe(item.platforms[0]);
        expect(evidence.fixture).toBe(item.fixture);
        expect(evidence.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      }
    },
  );

  it('keeps fresh, genuine single-network, platform, and old-iOS gaps blocked', () => {
    const blockedIds = homeUICoverageManifest
      .filter((item) => item.status === 'blocked')
      .map((item) => item.id);
    expect(blockedIds).toEqual([
      'hoverState',
      'freshOnboarding',
      'noWalletFirstLaunch',
      'firstCreatedEmptyWallet',
      'genuineSingleNetworkFunded',
      'positiveUnbackedWallet',
      'otherWalletTypes',
      'androidDebug',
      'iosBelow17_4',
    ]);
  });

  it('locks interaction and historical UI evidence to the state each artifact proves', () => {
    const byId = new Map(homeUICoverageManifest.map((item) => [item.id, item]));

    expect(byId.get('pressedState')?.status).toBe('open');
    expect(byId.get('hoverState')).toMatchObject({
      platforms: ['iosNative'],
      status: 'blocked',
    });
    expect(byId.get('focusState')?.status).toBe('open');

    expect(
      byId.get('historyFooter')?.evidence.map(({ reference }) => reference),
    ).toEqual([
      '.tmp/ui/native-home-nine-regressions-20260717/final/history-footer-bottom.png',
      '.tmp/ui/native-home-nine-regressions-20260717/final/history-explorer-network-selection.png',
    ]);
    expect(
      byId
        .get('historyIncomingValue')
        ?.evidence.map(({ reference }) => reference),
    ).toEqual([
      '.tmp/ui/native-home-nine-regressions-20260717/final/history-first-frame.png',
      '.tmp/ui/native-home-nine-regressions-20260717/final/history-settled.png',
    ]);
    expect(byId.get('themeDark')?.evidence[0]?.reference).toBe(
      '.tmp/ui/native-home-final-20260718/market-dark-large-restored-final.png',
    );
    expect(byId.get('themeLight')?.evidence[0]?.reference).toBe(
      '.tmp/ui/native-home-final-20260718/market-light-large-final.png',
    );
    expect(
      byId
        .get('dynamicTypeLargeAndXxxl')
        ?.evidence.map(({ reference }) => reference),
    ).toEqual([
      '.tmp/ui/native-home-final-20260718/market-AXXXL-final.png',
      '.tmp/ui/native-home-final-20260718/market-large-restored-final.png',
    ]);
    expect(
      byId.get('dynamicTypeLargeAndXxxl')?.evidence[0]?.limitation,
    ).toContain('fail to format invalid number: Unlimited...');
    expect(byId.get('marketStarToggle')?.evidence[0]).toMatchObject({
      date: '2026-07-18',
      reference:
        '.tmp/ui/native-home-final-20260718/market-star-toggle-final.mp4',
    });
    expect(byId.get('marketAdd4Tokens')?.evidence[0]).toMatchObject({
      date: '2026-07-16',
      reference: '.tmp/ui/native-home-market-add4-refresh-after-fix.mov',
    });
    expect(byId.get('marketPerps')?.evidence[0]).toMatchObject({
      date: '2026-07-16',
      reference: '.tmp/ui/ab-audit-native-market-perps.png',
    });
    expect(byId.get('pageFooterWarning')?.summary).toContain(
      'no visible warning or error toast',
    );
    expect(byId.get('pageFooterWarning')?.summary).not.toContain(
      'warning count',
    );
  });
});

describe('Home behavior oracle executable observations', () => {
  it.each(
    homeBehaviorOracleFixtures.filter(
      (fixture) => fixture.verification.kind === 'executable',
    ),
  )('$id matches the current exported pure resolver behavior', (fixture) => {
    expect(fixture.verification.kind).toBe('executable');
    if (fixture.verification.kind === 'executable') {
      runExecutableProbe(fixture.verification.probe);
    }
  });

  it('keeps unsupported contracts explicitly observation-only', () => {
    const observationOnly = homeBehaviorOracleFixtures.filter(
      (fixture) => fixture.verification.kind === 'observationOnly',
    );
    expect(observationOnly.map((fixture) => fixture.id)).toEqual([
      'nftError',
      'marketLoading',
      'producerRestartWithOldResponse',
      'nativeRevisionGap',
      'snapshotSlotOwnerMismatch',
      'staleNativeIntent',
    ]);
  });
});
