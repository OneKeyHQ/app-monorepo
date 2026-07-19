export const REQUIRED_HOME_BEHAVIOR_ORACLE_VECTOR_IDS = [
  'newUnbackedWallet',
  'backedZeroWallet',
  'fundedAllNetworks',
  'fundedBitcoin',
  'scopeSwitchWithExactCache',
  'scopeSwitchWithoutCache',
  'backgroundNotReady',
  'partialPortfolioResponse',
  'staleDefiResponse',
  'stalePerpsResponse',
  'historyEmpty',
  'nftError',
  'marketLoading',
  'capabilityChanged',
  'sameScopeRequestTwoFinishesBeforeOne',
  'producerRestartWithOldResponse',
  'partialPositiveWithExactZeroCache',
  'aggregationRequiredSetChanged',
  'nativeRevisionGap',
  'snapshotSlotOwnerMismatch',
  'staleNativeIntent',
] as const;

export type IHomeBehaviorOracleVectorId =
  (typeof REQUIRED_HOME_BEHAVIOR_ORACLE_VECTOR_IDS)[number];

export type IHomeBehaviorOracleSurface =
  | 'web'
  | 'desktop'
  | 'extension'
  | 'mobileReactNative'
  | 'iosNative'
  | 'androidNative';

export type IHomeBehaviorOracleRuntimeTopology = 'single' | 'split';

export type IHomeBehaviorOracleClassification =
  | 'intentional'
  | 'historicalDrift'
  | 'defect'
  | 'openDecision';

export type IHomeBehaviorOracleProvenance =
  | 'historicalUI'
  | 'executableTest'
  | 'codeInspection';

export type IHomeBehaviorOracleEvidencePlatform =
  | IHomeBehaviorOracleSurface
  | 'shared'
  | 'iosLegacyReact';

export type IHomeBehaviorOracleProbe =
  | 'homeSurfaceUnbacked'
  | 'backedZeroBalance'
  | 'fundedAllNetworksAmount'
  | 'fundedBitcoinCapability'
  | 'scopeSwitchExactCache'
  | 'scopeSwitchNoCache'
  | 'backgroundNotReady'
  | 'partialPortfolioResponse'
  | 'staleDefiResponse'
  | 'stalePerpsResponse'
  | 'historyEmptySlot'
  | 'capabilityChanged'
  | 'sameScopeRequestOutOfOrder'
  | 'partialPositiveExactZero'
  | 'aggregationRequiredSetChanged';

type IHomeBehaviorOracleJsonValue =
  | string
  | number
  | boolean
  | null
  | readonly IHomeBehaviorOracleJsonValue[]
  | { readonly [key: string]: IHomeBehaviorOracleJsonValue };

export type IHomeBehaviorOracleObservation = {
  status: 'observed' | 'notObserved';
  summary: string;
  provenance: IHomeBehaviorOracleProvenance;
  platform: IHomeBehaviorOracleEvidencePlatform;
  fixture?: string;
  date?: string;
  currentRun: 'notRun';
};

type IHomeBehaviorOracleProductExpectation =
  | { status: 'defined'; summary: string }
  | { status: 'open'; question: string };

type IHomeBehaviorOracleVerification =
  | {
      kind: 'executable';
      probe: IHomeBehaviorOracleProbe;
      resolverNames: readonly string[];
    }
  | {
      kind: 'observationOnly';
      reason: string;
    };

export interface IHomeBehaviorOracleFixture {
  id: IHomeBehaviorOracleVectorId;
  displayName?: string;
  description?: string;
  surfaces: readonly IHomeBehaviorOracleSurface[];
  runtimeTopologies: readonly IHomeBehaviorOracleRuntimeTopology[];
  currentRun: 'notRun';
  normalizedInputs: Readonly<Record<string, IHomeBehaviorOracleJsonValue>>;
  eventSequence: readonly string[];
  observed: {
    legacy: IHomeBehaviorOracleObservation;
    native: IHomeBehaviorOracleObservation;
  };
  classification: IHomeBehaviorOracleClassification;
  evidence: readonly IHomeBehaviorOracleEvidence[];
  productExpectation: IHomeBehaviorOracleProductExpectation;
  verification: IHomeBehaviorOracleVerification;
}

export interface IHomeBehaviorOracleEvidence {
  kind: 'test' | 'ui' | 'code';
  provenance: IHomeBehaviorOracleProvenance;
  platform: IHomeBehaviorOracleEvidencePlatform;
  fixture?: string;
  date?: string;
  currentRun: 'notRun';
  reference: string;
  limitation?: string;
}

type IRawHomeBehaviorOracleObservation = Pick<
  IHomeBehaviorOracleObservation,
  'status' | 'summary' | 'provenance'
> &
  Partial<
    Pick<
      IHomeBehaviorOracleObservation,
      'provenance' | 'platform' | 'fixture' | 'date'
    >
  >;

type IRawHomeBehaviorOracleEvidence = Pick<
  IHomeBehaviorOracleEvidence,
  'kind' | 'reference'
> &
  Partial<
    Pick<
      IHomeBehaviorOracleEvidence,
      'platform' | 'fixture' | 'date' | 'limitation'
    >
  >;

type IRawHomeBehaviorOracleFixture = Omit<
  IHomeBehaviorOracleFixture,
  'currentRun' | 'observed' | 'evidence'
> & {
  observed: {
    legacy: IRawHomeBehaviorOracleObservation;
    native: IRawHomeBehaviorOracleObservation;
  };
  evidence: readonly IRawHomeBehaviorOracleEvidence[];
};

const allSurfaces: readonly IHomeBehaviorOracleSurface[] = [
  'web',
  'desktop',
  'extension',
  'mobileReactNative',
  'iosNative',
  'androidNative',
];

const mobileSurfaces: readonly IHomeBehaviorOracleSurface[] = [
  'mobileReactNative',
  'iosNative',
  'androidNative',
];

const nativeSurfaces: readonly IHomeBehaviorOracleSurface[] = [
  'iosNative',
  'androidNative',
];

const splitTopology: readonly IHomeBehaviorOracleRuntimeTopology[] = ['split'];
const allTopologies: readonly IHomeBehaviorOracleRuntimeTopology[] = [
  'single',
  'split',
];

const rawHomeBehaviorOracleFixtures: readonly IRawHomeBehaviorOracleFixture[] =
  [
    {
      id: 'newUnbackedWallet',
      displayName: 'Existing unbacked HD wallet safety surface',
      description:
        'This required Section 20.2 vector starts after an existing HD wallet is known to be unbacked; it is not fresh onboarding or a no-wallet first launch.',
      surfaces: mobileSurfaces,
      runtimeTopologies: splitTopology,
      normalizedInputs: {
        owner: {
          walletId: 'wallet-fixture-unbacked',
          accountId: 'account-fixture-new',
          network: { kind: 'allNetworks' },
        },
        wallet: { accountType: 'hd', backupStatus: 'required' },
        launch: { decision: 'main', walletContentReadiness: 'wallet' },
      },
      eventSequence: [
        'resolve authoritative wallet and backup verdict',
        'enter the Home surface',
      ],
      observed: {
        legacy: {
          status: 'observed',
          provenance: 'executableTest',
          summary: 'The RN safety surface owns the unbacked HD wallet flow.',
        },
        native: {
          status: 'observed',
          provenance: 'executableTest',
          summary:
            'Native Home is not mounted while the RN safety surface owns the flow.',
        },
      },
      classification: 'historicalDrift',
      evidence: [
        {
          kind: 'test',
          reference:
            'packages/kit/src/views/Home/pages/homeWalletPageSurface.test.ts :: routes a matching unbacked HD wallet to the lightweight RN page',
        },
      ],
      productExpectation: {
        status: 'defined',
        summary:
          'Expose backupRequired as shared Home shell semantics with a shared CTA command.',
      },
      verification: {
        kind: 'executable',
        probe: 'homeSurfaceUnbacked',
        resolverNames: ['resolveHomeWalletPageSurface'],
      },
    },
    {
      id: 'backedZeroWallet',
      surfaces: ['mobileReactNative', 'iosNative'],
      runtimeTopologies: splitTopology,
      normalizedInputs: {
        owner: {
          walletId: 'wallet-fixture-backed',
          accountId: 'account-fixture-zero',
          network: { kind: 'allNetworks' },
        },
        wallet: { backupStatus: 'complete' },
        balance: { confirmedUsd: '0', coverage: 'complete', liveUsd: '0' },
      },
      eventSequence: [
        'activate exact owner',
        'complete every required balance contributor',
      ],
      observed: {
        legacy: {
          status: 'observed',
          provenance: 'historicalUI',
          summary:
            'Legacy shows an authoritative zero state with zero-wallet actions.',
        },
        native: {
          status: 'observed',
          provenance: 'historicalUI',
          summary: 'Native shows zeroBalance geometry with Add money and More.',
        },
      },
      classification: 'intentional',
      evidence: [
        {
          kind: 'test',
          reference:
            'packages/kit/src/views/Home/nativeHomeBalanceAuthority.test.ts :: allows an exact-owner cached zero while current sources reload',
        },
        {
          kind: 'ui',
          platform: 'iosNative',
          fixture: 'existing-backed-hd-account8-zero',
          date: '2026-07-19',
          reference:
            '.tmp/ui/native-home-new-account-loading-final-20260719/22-account8-loading-zero-ab-402.png',
        },
        {
          kind: 'ui',
          platform: 'iosLegacyReact',
          fixture: 'existing-backed-hd-account8-zero',
          date: '2026-07-19',
          reference:
            '.tmp/ui/native-home-new-account-loading-final-20260719/22-account8-legacy-zero-ab-402.png',
        },
      ],
      productExpectation: {
        status: 'defined',
        summary:
          'Complete zero coverage produces a zero header, zero actions, and no positive banner.',
      },
      verification: {
        kind: 'executable',
        probe: 'backedZeroBalance',
        resolverNames: [
          'resolveNativeHomeBalanceState',
          'resolveNativeHomeHeaderActionPresentation',
          'resolveNativeHomeBalanceAmountPresentation',
        ],
      },
    },
    {
      id: 'fundedAllNetworks',
      surfaces: allSurfaces,
      runtimeTopologies: allTopologies,
      normalizedInputs: {
        owner: {
          walletId: 'wallet-fixture-funded',
          accountId: 'account-fixture-funded',
          network: { kind: 'allNetworks' },
        },
        balance: {
          confirmedUsd: '120',
          liveUsd: '125',
          requiredSources: ['portfolio', 'defi', 'perps'],
        },
      },
      eventSequence: [
        'activate funded owner',
        'complete all contributors for one aggregation run',
      ],
      observed: {
        legacy: {
          status: 'notObserved',
          provenance: 'codeInspection',
          summary:
            'The Native-only aggregation test and recording do not establish Legacy same-run aggregation behavior.',
        },
        native: {
          status: 'observed',
          provenance: 'executableTest',
          summary:
            'Native holds the confirmed amount until one final complete amount is available.',
        },
      },
      classification: 'openDecision',
      evidence: [
        {
          kind: 'test',
          platform: 'iosNative',
          reference:
            'packages/kit/src/views/Home/useNativeHomeBalanceAmountPresentation.test.ts :: commits one final value only after every included source is current and successful',
        },
        {
          kind: 'ui',
          platform: 'iosNative',
          fixture: 'existing-funded-multichain-account1',
          date: '2026-07-20',
          reference:
            '.tmp/ui/native-home-authority-final-20260720/account8-to-account1-funded.mp4',
        },
      ],
      productExpectation: {
        status: 'defined',
        summary:
          'All renderers consume one funded shell semantic after complete same-run aggregation.',
      },
      verification: {
        kind: 'executable',
        probe: 'fundedAllNetworksAmount',
        resolverNames: ['resolveNativeHomeBalanceAmountPresentation'],
      },
    },
    {
      id: 'fundedBitcoin',
      surfaces: allSurfaces,
      runtimeTopologies: allTopologies,
      normalizedInputs: {
        owner: {
          walletId: 'wallet-fixture-bitcoin',
          accountId: 'account-fixture-bitcoin',
          network: {
            kind: 'singleNetwork',
            networkId: 'network-fixture-bitcoin',
          },
        },
        balance: { liveUsd: '25', coverage: 'complete' },
        capability: { defi: false, nft: false, perps: false },
      },
      eventSequence: [
        'activate funded Bitcoin scope',
        'confirm balance and capability sources',
      ],
      observed: {
        legacy: {
          status: 'notObserved',
          provenance: 'codeInspection',
          summary:
            'A genuinely single-network funded-wallet fixture was not available.',
        },
        native: {
          status: 'notObserved',
          provenance: 'codeInspection',
          summary:
            'Only a funded multichain account viewed through the Bitcoin scope was recorded.',
        },
      },
      classification: 'openDecision',
      evidence: [
        {
          kind: 'ui',
          platform: 'iosNative',
          fixture: 'existing-funded-multichain-account1-bitcoin-scope',
          date: '2026-07-20',
          limitation:
            'This is a multichain account viewed through Bitcoin, not a genuinely single-network funded wallet.',
          reference:
            '.tmp/ui/native-home-authority-final-20260720/20-scope-bitcoin.png',
        },
        {
          kind: 'test',
          reference:
            'packages/kit/src/views/Home/homeWalletCapabilityTabModel.test.ts :: commits hidden capability tabs only after unsupported BTC is confirmed',
        },
      ],
      productExpectation: {
        status: 'defined',
        summary:
          'Complete positive Bitcoin coverage is funded and exposes only applicable Bitcoin tabs.',
      },
      verification: {
        kind: 'executable',
        probe: 'fundedBitcoinCapability',
        resolverNames: [
          'resolveNativeHomeBalanceState',
          'buildHomeWalletCapabilityTabModel',
        ],
      },
    },
    {
      id: 'scopeSwitchWithExactCache',
      surfaces: allSurfaces,
      runtimeTopologies: allTopologies,
      normalizedInputs: {
        fromOwner: 'wallet-fixture-a__account-fixture-a__network-fixture-all',
        toOwner: 'wallet-fixture-a__account-fixture-b__network-fixture-all',
        cache: { exactToOwnerState: 'positive' },
      },
      eventSequence: [
        'activate owner A',
        'activate owner B',
        'read exact owner B cache',
      ],
      observed: {
        legacy: {
          status: 'notObserved',
          provenance: 'codeInspection',
          summary:
            'The Native exact-scope cache test and recording do not establish Legacy cache behavior.',
        },
        native: {
          status: 'observed',
          provenance: 'executableTest',
          summary:
            'Native reuses only the exact Home scope cache and does not flash owner A.',
        },
      },
      classification: 'openDecision',
      evidence: [
        {
          kind: 'test',
          platform: 'iosNative',
          reference:
            'packages/kit/src/views/Home/nativeHomeBalanceAuthority.test.ts :: reuses known state only for the exact home balance scope',
        },
        {
          kind: 'ui',
          platform: 'iosNative',
          fixture: 'existing-funded-and-zero-accounts',
          date: '2026-07-20',
          reference:
            '.tmp/ui/native-home-authority-final-20260720/account8-to-account1-funded.mp4',
        },
      ],
      productExpectation: {
        status: 'defined',
        summary:
          'Use only exact SourceKey confirmed data with confirmed provenance while refreshing.',
      },
      verification: {
        kind: 'executable',
        probe: 'scopeSwitchExactCache',
        resolverNames: ['resolveNativeHomeScopeCachedBalanceState'],
      },
    },
    {
      id: 'scopeSwitchWithoutCache',
      surfaces: allSurfaces,
      runtimeTopologies: allTopologies,
      normalizedInputs: {
        fromOwner:
          'wallet-fixture-a__account-fixture-funded__network-fixture-all',
        toOwner: 'wallet-fixture-a__account-fixture-new__network-fixture-all',
        cache: { exactToOwnerState: null },
      },
      eventSequence: [
        'activate funded owner',
        'activate uncached owner',
        'wait for complete zero coverage',
      ],
      observed: {
        legacy: {
          status: 'observed',
          provenance: 'codeInspection',
          summary:
            'Legacy returns its wallet-scoped sticky state when the new account or network computes unknown, so it can borrow the previous scope state inside one wallet.',
        },
        native: {
          status: 'observed',
          provenance: 'historicalUI',
          summary:
            'Native shows neutral loading and then zero without old funded actions or rows.',
        },
      },
      classification: 'historicalDrift',
      evidence: [
        {
          kind: 'code',
          reference:
            'packages/kit/src/hooks/useHomeBalanceState.ts :: wallet-scoped stickyRef returns the previous non-unknown state during same-wallet account/network switches',
        },
        {
          kind: 'test',
          reference:
            'packages/kit/src/hooks/useHomeBalanceState.test.ts :: does not guess zero before the balance owner is ready',
        },
        {
          kind: 'test',
          reference:
            'packages/kit/src/views/Home/nativeHomeBalanceAuthority.test.ts :: keeps error or retry unknown when the exact scope has no cache',
        },
        {
          kind: 'ui',
          platform: 'iosNative',
          fixture: 'existing-backed-hd-account8-first-activation',
          date: '2026-07-19',
          reference:
            '.tmp/ui/native-home-new-account-loading-final-20260719/account8-full-create.mp4',
        },
      ],
      productExpectation: {
        status: 'defined',
        summary:
          'An uncached owner starts as loading and never borrows another owner state.',
      },
      verification: {
        kind: 'executable',
        probe: 'scopeSwitchNoCache',
        resolverNames: [
          'resolveNativeHomeScopeCachedBalanceState',
          'resolveNativeHomeHeaderActionPresentation',
        ],
      },
    },
    {
      id: 'backgroundNotReady',
      surfaces: ['extension', ...mobileSurfaces],
      runtimeTopologies: splitTopology,
      normalizedInputs: {
        owner: {
          walletId: 'wallet-fixture-bg',
          accountId: 'account-fixture-bg',
          network: { kind: 'allNetworks' },
        },
        runtime: {
          connection: 'waiting',
          producerInstanceId: 'producer-fixture-old',
        },
        cache: { exactOwner: null },
      },
      eventSequence: [
        'main becomes visible',
        'background handshake remains pending',
      ],
      observed: {
        legacy: {
          status: 'notObserved',
          provenance: 'codeInspection',
          summary:
            'No isolated Legacy screenshot was captured with bg deliberately held unready.',
        },
        native: {
          status: 'observed',
          provenance: 'executableTest',
          summary:
            'The current authority helper keeps an uncached unresolved owner in neutral loading.',
        },
      },
      classification: 'openDecision',
      evidence: [
        {
          kind: 'test',
          platform: 'iosNative',
          reference:
            'packages/kit/src/views/Home/nativeHomeBalanceAuthority.test.ts :: keeps an old-scope or failed portfolio unknown without a cache',
        },
      ],
      productExpectation: {
        status: 'defined',
        summary:
          'Show loading or exact confirmed degraded data; never claim live or fabricate zero.',
      },
      verification: {
        kind: 'executable',
        probe: 'backgroundNotReady',
        resolverNames: [
          'resolveNativeHomeBalanceState',
          'resolveNativeHomeHeaderActionPresentation',
        ],
      },
    },
    {
      id: 'partialPortfolioResponse',
      surfaces: allSurfaces,
      runtimeTopologies: allTopologies,
      normalizedInputs: {
        owner: {
          walletId: 'wallet-fixture-partial',
          accountId: 'account-fixture-partial',
          network: { kind: 'allNetworks' },
        },
        balance: {
          confirmedUsd: '80',
          partialLiveUsd: '30',
          coverage: 'partial',
        },
      },
      eventSequence: [
        'start aggregation run',
        'receive only a partial portfolio contribution',
      ],
      observed: {
        legacy: {
          status: 'notObserved',
          provenance: 'codeInspection',
          summary:
            'The Native amount-presentation test does not establish Legacy progressive-loading behavior.',
        },
        native: {
          status: 'observed',
          provenance: 'executableTest',
          summary:
            'Native holds the exact confirmed amount and does not commit the partial sum.',
        },
      },
      classification: 'openDecision',
      evidence: [
        {
          kind: 'test',
          platform: 'iosNative',
          reference:
            'packages/kit/src/views/Home/useNativeHomeBalanceAmountPresentation.test.ts :: holds an exact confirmed amount instead of a partial live sum',
        },
      ],
      productExpectation: {
        status: 'defined',
        summary:
          'Partial data is loading or fundedPendingTotal and never an exact total or cache write.',
      },
      verification: {
        kind: 'executable',
        probe: 'partialPortfolioResponse',
        resolverNames: ['resolveNativeHomeBalanceAmountPresentation'],
      },
    },
    {
      id: 'staleDefiResponse',
      surfaces: allSurfaces,
      runtimeTopologies: allTopologies,
      normalizedInputs: {
        currentOwner:
          'wallet-fixture-a__account-fixture-b__network-fixture-all',
        responseOwner:
          'wallet-fixture-a__account-fixture-a__network-fixture-all',
        exactConfirmedUsd: '70',
      },
      eventSequence: [
        'activate owner B',
        'receive late DeFi completion from owner A',
      ],
      observed: {
        legacy: {
          status: 'notObserved',
          provenance: 'codeInspection',
          summary: 'No delayed-response Legacy UI injection was captured.',
        },
        native: {
          status: 'observed',
          provenance: 'executableTest',
          summary:
            'The amount resolver rejects stale DeFi scope authority and retains exact confirmed data.',
        },
      },
      classification: 'openDecision',
      evidence: [
        {
          kind: 'test',
          platform: 'iosNative',
          reference:
            'packages/kit/src/views/Home/useNativeHomeBalanceAmountPresentation.test.ts :: rejects stale DeFi or included Perps authority while allowing excluded Perps',
        },
      ],
      productExpectation: {
        status: 'defined',
        summary:
          'Reject every stale source token without changing current semantics or confirmed cache.',
      },
      verification: {
        kind: 'executable',
        probe: 'staleDefiResponse',
        resolverNames: ['resolveNativeHomeBalanceAmountPresentation'],
      },
    },
    {
      id: 'stalePerpsResponse',
      surfaces: allSurfaces,
      runtimeTopologies: allTopologies,
      normalizedInputs: {
        currentScope: 'account-fixture-b',
        staleScope: 'account-fixture-a',
        addressAlias: 'address-fixture-shared',
      },
      eventSequence: [
        'owner B Perps request succeeds',
        'same-address owner A request resolves late',
      ],
      observed: {
        legacy: {
          status: 'observed',
          provenance: 'executableTest',
          summary: 'The shared Perps hook retains the current scope result.',
        },
        native: {
          status: 'observed',
          provenance: 'executableTest',
          summary:
            'The shared Perps selector rejects the stale result before Native consumes the current scope result.',
        },
      },
      classification: 'intentional',
      evidence: [
        {
          kind: 'test',
          reference:
            'packages/kit/src/views/Home/pages/usePerpsHomePortfolio.test.ts :: keeps B success when a same-address A main request resolves late',
        },
      ],
      productExpectation: {
        status: 'defined',
        summary:
          'A stale Perps completion cannot replace the current owner result.',
      },
      verification: {
        kind: 'executable',
        probe: 'stalePerpsResponse',
        resolverNames: ['selectCurrentPerpsHomePortfolioResult'],
      },
    },
    {
      id: 'historyEmpty',
      surfaces: allSurfaces,
      runtimeTopologies: allTopologies,
      normalizedInputs: {
        owner: {
          walletId: 'wallet-fixture-history',
          accountId: 'account-fixture-history',
          network: { kind: 'allNetworks' },
        },
        history: { state: 'completeEmpty', rowCount: 0, displayHeight: 320 },
      },
      eventSequence: [
        'select History',
        'complete the current History request with no rows',
      ],
      observed: {
        legacy: {
          status: 'notObserved',
          provenance: 'codeInspection',
          summary:
            'No same-fixture Legacy empty-History UI evidence was captured for this oracle.',
        },
        native: {
          status: 'observed',
          provenance: 'historicalUI',
          summary:
            'Native uses one stable empty state row and the owner-matched RN slot.',
        },
      },
      classification: 'openDecision',
      evidence: [
        {
          kind: 'test',
          reference:
            'packages/kit/src/views/Home/nativeHomeSlotLifecycle.test.ts :: parks the History loading and terminal empty content under one key',
        },
        {
          kind: 'ui',
          platform: 'iosNative',
          fixture: 'existing-backed-hd-empty-history',
          date: '2026-07-19',
          reference:
            '.tmp/ui/native-home-four-issues-after-20260719/03-history-r1-from-nft-3s.png',
        },
      ],
      productExpectation: {
        status: 'defined',
        summary:
          'Complete empty History maps to an empty section with a stable placeholder contract.',
      },
      verification: {
        kind: 'executable',
        probe: 'historyEmptySlot',
        resolverNames: ['resolveNativeHomeListStateSlot'],
      },
    },
    {
      id: 'nftError',
      surfaces: allSurfaces,
      runtimeTopologies: allTopologies,
      normalizedInputs: {
        owner: {
          walletId: 'wallet-fixture-nft',
          accountId: 'account-fixture-nft',
          network: { kind: 'allNetworks' },
        },
        nft: { state: 'error', exactConfirmedRows: null },
      },
      eventSequence: [
        'select NFT',
        'finish the current NFT request with an error',
      ],
      observed: {
        legacy: {
          status: 'notObserved',
          provenance: 'codeInspection',
          summary: 'No controlled NFT error screenshot was captured.',
        },
        native: {
          status: 'notObserved',
          provenance: 'codeInspection',
          summary:
            'Current adapter tests cover loading and empty, not an explicit error semantic.',
        },
      },
      classification: 'openDecision',
      evidence: [
        {
          kind: 'test',
          reference:
            'packages/kit/src/views/Home/nativeHomeDataAdapters.test.ts :: preserves loading and empty on one stable native state row',
        },
      ],
      productExpectation: {
        status: 'open',
        question:
          'Confirm the product-specific NFT error state and exact-cache fallback presentation.',
      },
      verification: {
        kind: 'observationOnly',
        reason:
          'No exported pure resolver currently represents an NFT error semantic.',
      },
    },
    {
      id: 'marketLoading',
      surfaces: allSurfaces,
      runtimeTopologies: allTopologies,
      normalizedInputs: {
        owner: {
          walletId: 'wallet-fixture-market',
          accountId: 'account-fixture-market',
          network: { kind: 'allNetworks' },
        },
        market: {
          category: 'trending',
          state: 'loading',
          exactConfirmedRows: null,
        },
      },
      eventSequence: [
        'select a Market category',
        'wait for the current category response',
      ],
      observed: {
        legacy: {
          status: 'notObserved',
          provenance: 'codeInspection',
          summary:
            'The settled Trending screenshot does not observe a Legacy loading state without exact confirmed rows.',
        },
        native: {
          status: 'notObserved',
          provenance: 'codeInspection',
          summary:
            'The settled Trending screenshot does not observe Native loading with exactConfirmedRows absent.',
        },
      },
      classification: 'openDecision',
      evidence: [
        {
          kind: 'ui',
          platform: 'iosNative',
          fixture: 'existing-market-trending-settled',
          date: '2026-07-18',
          limitation:
            'Settled Trending UI is contextual evidence only and does not prove the normalized loading-without-cache input.',
          reference: '.tmp/ui/handoff-ui-market-trending-after-debug.png',
        },
        {
          kind: 'test',
          reference:
            'packages/native-components/src/HomeContainerController.test.ts :: preserves the selected market category in an atomic tab patch',
        },
      ],
      productExpectation: {
        status: 'open',
        question:
          'Confirm category cache TTL, loading placeholder, and error fallback semantics for shared Home Core.',
      },
      verification: {
        kind: 'observationOnly',
        reason:
          'No exported pure resolver currently produces the complete Market loading semantic.',
      },
    },
    {
      id: 'capabilityChanged',
      surfaces: allSurfaces,
      runtimeTopologies: allTopologies,
      normalizedInputs: {
        owner: {
          walletId: 'wallet-fixture-capability',
          accountId: 'account-fixture-capability',
          network: { kind: 'singleNetwork', networkId: 'network-fixture-evm' },
        },
        before: { tabs: ['portfolio', 'defi', 'history'], selected: 'defi' },
        after: { tabs: ['portfolio', 'history'], selected: 'defi' },
      },
      eventSequence: [
        'confirm initial capability',
        'remove DeFi capability',
        'resolve selected fallback',
      ],
      observed: {
        legacy: {
          status: 'notObserved',
          provenance: 'codeInspection',
          summary:
            'No Legacy runtime UI capture removed the selected capability while the page remained mounted.',
        },
        native: {
          status: 'notObserved',
          provenance: 'codeInspection',
          summary:
            'The pure helper is executable, but no Native runtime UI capture removed the selected capability in place.',
        },
      },
      classification: 'openDecision',
      evidence: [
        {
          kind: 'test',
          reference:
            'packages/kit/src/views/Home/homeWalletCapabilityTabModel.test.ts :: keeps a legal selected tab and falls back only after it is removed',
        },
        {
          kind: 'ui',
          platform: 'iosNative',
          fixture: 'existing-funded-multichain-all-networks-restored',
          date: '2026-07-20',
          limitation:
            'This settled All Networks restoration does not prove runtime capability removal or selected-tab fallback.',
          reference:
            '.tmp/ui/native-home-authority-final-20260720/32-all-networks-restored.png',
        },
      ],
      productExpectation: {
        status: 'defined',
        summary:
          'Capability tabs and selected fallback update as one navigation transaction.',
      },
      verification: {
        kind: 'executable',
        probe: 'capabilityChanged',
        resolverNames: [
          'buildHomeWalletCapabilityTabModel',
          'resolveHomeWalletSelectedTab',
        ],
      },
    },
    {
      id: 'sameScopeRequestTwoFinishesBeforeOne',
      surfaces: allSurfaces,
      runtimeTopologies: allTopologies,
      normalizedInputs: {
        owner: {
          sessionId: 'session-fixture-1',
          scopeKey: 'scope-fixture-same',
        },
        requests: [{ sequence: 1 }, { sequence: 2 }],
      },
      eventSequence: [
        'start request 1',
        'start request 2',
        'finish request 2',
        'finish request 1',
      ],
      observed: {
        legacy: {
          status: 'notObserved',
          provenance: 'codeInspection',
          summary: 'No UI injection run captured this exact ordering.',
        },
        native: {
          status: 'observed',
          provenance: 'executableTest',
          summary:
            'The current portfolio request gate accepts generation 2 and rejects generation 1.',
        },
      },
      classification: 'openDecision',
      evidence: [
        {
          kind: 'test',
          platform: 'iosNative',
          reference:
            'packages/kit/src/views/Home/nativeHomePortfolioRequestLifecycle.test.ts :: advances a monotonic owner epoch when the render scope changes',
        },
      ],
      productExpectation: {
        status: 'defined',
        summary:
          'Only the latest request sequence for the active source/session may commit.',
      },
      verification: {
        kind: 'executable',
        probe: 'sameScopeRequestOutOfOrder',
        resolverNames: ['isNativeHomePortfolioRequestCurrent'],
      },
    },
    {
      id: 'producerRestartWithOldResponse',
      surfaces: ['extension', ...mobileSurfaces],
      runtimeTopologies: splitTopology,
      normalizedInputs: {
        owner: {
          sessionId: 'session-fixture-1',
          scopeKey: 'scope-fixture-producer',
        },
        oldProducer: 'producer-fixture-1',
        currentProducer: 'producer-fixture-2',
      },
      eventSequence: [
        'start request on producer 1',
        'restart bg as producer 2',
        'receive producer 1 response',
      ],
      observed: {
        legacy: {
          status: 'notObserved',
          provenance: 'codeInspection',
          summary: 'No controlled producer-restart UI trace was captured.',
        },
        native: {
          status: 'notObserved',
          provenance: 'codeInspection',
          summary:
            'Current owner/generation tests do not include producer instance identity.',
        },
      },
      classification: 'defect',
      evidence: [
        {
          kind: 'test',
          reference:
            'packages/kit/src/views/Home/nativeHomePortfolioRequestLifecycle.test.ts :: advances a monotonic owner epoch when the render scope changes',
        },
      ],
      productExpectation: {
        status: 'defined',
        summary:
          'A new producer invalidates all prior producer tokens before any response can commit.',
      },
      verification: {
        kind: 'observationOnly',
        reason:
          'No exported request resolver currently accepts producerInstanceId.',
      },
    },
    {
      id: 'partialPositiveWithExactZeroCache',
      surfaces: allSurfaces,
      runtimeTopologies: allTopologies,
      normalizedInputs: {
        owner: {
          walletId: 'wallet-fixture-positive',
          accountId: 'account-fixture-positive',
          network: { kind: 'allNetworks' },
        },
        cache: { exactConfirmedUsd: '0' },
        balance: {
          positiveHoldingsEvidence: true,
          partialLiveUsd: '15',
          coverage: 'partial',
        },
      },
      eventSequence: [
        'read exact zero cache',
        'receive reliable positive partial evidence',
      ],
      observed: {
        legacy: {
          status: 'notObserved',
          provenance: 'codeInspection',
          summary: 'This conflict was not injected into Legacy UI.',
        },
        native: {
          status: 'observed',
          provenance: 'executableTest',
          summary:
            'Current helpers produce funded actions while the amount helper retains confirmed zero.',
        },
      },
      classification: 'defect',
      evidence: [
        {
          kind: 'test',
          platform: 'iosNative',
          reference:
            'packages/kit/src/views/Home/useNativeHomeBalanceAmountPresentation.test.ts :: keeps positive actions independent while holding progressive amount until one final commit',
        },
      ],
      productExpectation: {
        status: 'defined',
        summary:
          'Use fundedPendingTotal: funded-safe actions with a balance Skeleton, never a confirmed zero amount.',
      },
      verification: {
        kind: 'executable',
        probe: 'partialPositiveExactZero',
        resolverNames: [
          'resolveNativeHomeBalanceState',
          'resolveNativeHomeHeaderActionPresentation',
          'resolveNativeHomeBalanceAmountPresentation',
        ],
      },
    },
    {
      id: 'aggregationRequiredSetChanged',
      surfaces: allSurfaces,
      runtimeTopologies: allTopologies,
      normalizedInputs: {
        owner: {
          sessionId: 'session-fixture-aggregation',
          scopeKey: 'scope-fixture-aggregation',
        },
        before: {
          requiredContributors: ['portfolio'],
          revision: 'required-fixture-1',
        },
        after: {
          requiredContributors: ['portfolio', 'defi'],
          revision: 'required-fixture-2',
        },
      },
      eventSequence: [
        'complete the old required set',
        'enable DeFi contributor',
        'start a new aggregation run',
      ],
      observed: {
        legacy: {
          status: 'notObserved',
          provenance: 'codeInspection',
          summary:
            'Legacy does not expose an explicit aggregation required-set revision.',
        },
        native: {
          status: 'observed',
          provenance: 'executableTest',
          summary:
            'Current amount readiness reacts to included flags but has no run or required-set identity.',
        },
      },
      classification: 'defect',
      evidence: [
        {
          kind: 'test',
          platform: 'iosNative',
          reference:
            'packages/kit/src/views/Home/useNativeHomeBalanceAmountPresentation.test.ts :: commits one final value only after every included source is current and successful',
        },
      ],
      productExpectation: {
        status: 'defined',
        summary:
          'A changed required set starts a new run and never combines completions across revisions.',
      },
      verification: {
        kind: 'executable',
        probe: 'aggregationRequiredSetChanged',
        resolverNames: ['resolveNativeHomeBalanceAmountPresentation'],
      },
    },
    {
      id: 'nativeRevisionGap',
      surfaces: nativeSurfaces,
      runtimeTopologies: splitTopology,
      normalizedInputs: {
        owner: {
          sessionId: 'session-fixture-native',
          scopeKey: 'scope-fixture-native',
        },
        native: {
          currentRevision: 4,
          incomingBaseRevision: 5,
          incomingRevision: 6,
        },
      },
      eventSequence: [
        'apply revision 4',
        'lose revision 5',
        'receive revision 6 patch',
      ],
      observed: {
        legacy: {
          status: 'notObserved',
          provenance: 'codeInspection',
          summary:
            'The React renderer does not consume the Native DTO patch protocol.',
        },
        native: {
          status: 'observed',
          provenance: 'codeInspection',
          summary:
            'Protocol v1 has revision but no baseRevision/resync identity for a gap.',
        },
      },
      classification: 'defect',
      evidence: [
        {
          kind: 'code',
          platform: 'shared',
          reference:
            'packages/native-components/src/HomeContainer.types.ts :: IHomeContainerSnapshot and IHomeContainerPatch expose revision but no baseRevision or resync identity',
        },
        {
          kind: 'code',
          platform: 'iosNative',
          reference:
            'packages/native-components/ios/HomeContainerView.swift :: applySnapshot/applyPatch reject only lower revisions and do not detect a missing intermediate revision',
        },
        {
          kind: 'code',
          platform: 'androidNative',
          reference:
            'packages/native-components/android/src/main/java/com/margelo/nitro/onekeynativecomponents/HomeContainerView.kt :: applySnapshot/applyPatch accept any non-decreasing revision without a gap check',
        },
        {
          kind: 'test',
          reference:
            'packages/native-components/src/HomeContainerController.test.ts :: coalesces same-turn tab updates into one patch',
        },
      ],
      productExpectation: {
        status: 'defined',
        summary:
          'Reject a revision gap and request one validated full snapshot.',
      },
      verification: {
        kind: 'observationOnly',
        reason:
          'No exported pure protocol-v2 patch acceptance resolver exists yet.',
      },
    },
    {
      id: 'snapshotSlotOwnerMismatch',
      surfaces: nativeSurfaces,
      runtimeTopologies: splitTopology,
      normalizedInputs: {
        snapshotOwner: {
          sessionId: 'session-fixture-b',
          scopeKey: 'scope-fixture-b',
        },
        slotOwner: {
          sessionId: 'session-fixture-a',
          scopeKey: 'scope-fixture-a',
        },
      },
      eventSequence: [
        'replace snapshot with owner B',
        'receive or retain owner A slot content',
      ],
      observed: {
        legacy: {
          status: 'notObserved',
          provenance: 'codeInspection',
          summary:
            'Legacy React does not use the separate Native snapshot and RN slot channels.',
        },
        native: {
          status: 'observed',
          provenance: 'codeInspection',
          summary:
            'Current slot lifecycle stabilizes rows, but the public slot bundle has no owner identity.',
        },
      },
      classification: 'defect',
      evidence: [
        {
          kind: 'code',
          platform: 'shared',
          reference:
            'packages/native-components/src/HomeContainer.types.ts :: IHomeContainerSlots carries keyed content, height, and interaction but no owner, session, or scope identity',
        },
        {
          kind: 'code',
          platform: 'shared',
          reference:
            'packages/native-components/src/HomeContainer.native.tsx :: slotViews materializes slot hosts solely from slot keys without validating them against a snapshot owner',
        },
        {
          kind: 'code',
          platform: 'iosNative',
          reference:
            'packages/native-components/ios/HomeContainerView.swift :: slotHostView(forKey:) and mountedSlotKeys bind Native slot hosts by key without an owner identity',
        },
        {
          kind: 'test',
          reference:
            'packages/kit/src/views/Home/nativeHomeSlotLifecycle.test.ts :: keeps loading and empty on the same diffable row and slot-host cell',
        },
        {
          kind: 'test',
          reference:
            'packages/native-components/src/HomeContainerBackground.test.ts :: keeps the snapshot authoritative over a fallback slot color',
        },
      ],
      productExpectation: {
        status: 'defined',
        summary:
          'Reject owner-mismatched slot content and render the current owner placeholder or resync.',
      },
      verification: {
        kind: 'observationOnly',
        reason:
          'No exported pure resolver currently validates snapshot and slot owner identity.',
      },
    },
    {
      id: 'staleNativeIntent',
      surfaces: nativeSurfaces,
      runtimeTopologies: splitTopology,
      normalizedInputs: {
        renderedOwner: {
          sessionId: 'session-fixture-a',
          scopeKey: 'scope-fixture-a',
        },
        currentOwner: {
          sessionId: 'session-fixture-b',
          scopeKey: 'scope-fixture-b',
        },
        intent: { commandId: 'command-fixture-send', renderedRevision: 8 },
      },
      eventSequence: [
        'render owner A command',
        'activate owner B',
        'deliver the owner A tap callback',
      ],
      observed: {
        legacy: {
          status: 'notObserved',
          provenance: 'codeInspection',
          summary:
            'Legacy callbacks are not transported through the Native intent envelope.',
        },
        native: {
          status: 'observed',
          provenance: 'codeInspection',
          summary:
            'Current callbacks do not carry owner and rendered revision for dispatcher validation.',
        },
      },
      classification: 'defect',
      evidence: [
        {
          kind: 'code',
          platform: 'shared',
          reference:
            'packages/native-components/src/HomeContainer.types.ts :: IHomeContainerProps.onAction carries only actionId, itemId, and tabId, with no owner or rendered revision',
        },
        {
          kind: 'code',
          platform: 'shared',
          reference:
            'packages/native-components/src/HomeContainer.native.tsx :: stableOnAction forwards the three callback strings without stale-owner or rendered-revision validation',
        },
        {
          kind: 'code',
          platform: 'iosNative',
          reference:
            'packages/native-components/ios/HomeContainerView.swift :: Native action handlers emit actionId, itemId, and selectedTabId without owner or rendered revision',
        },
        {
          kind: 'code',
          platform: 'androidNative',
          reference:
            'packages/native-components/android/src/main/java/com/margelo/nitro/onekeynativecomponents/HomeContainerView.kt :: onAction emits three strings and performs no stale intent identity check',
        },
        {
          kind: 'test',
          reference:
            'packages/native-components/src/HomeContainerController.test.ts :: records native paging without issuing a second native command',
        },
      ],
      productExpectation: {
        status: 'defined',
        summary:
          'Reject an intent whose owner, capability, command registration, or sensitive revision is stale.',
      },
      verification: {
        kind: 'observationOnly',
        reason: 'No exported pure stale-intent dispatcher contract exists yet.',
      },
    },
  ];

function resolveEvidenceProvenance(
  kind: IRawHomeBehaviorOracleEvidence['kind'],
): IHomeBehaviorOracleProvenance {
  if (kind === 'ui') {
    return 'historicalUI';
  }
  if (kind === 'test') {
    return 'executableTest';
  }
  return 'codeInspection';
}

function materializeEvidence(
  evidence: IRawHomeBehaviorOracleEvidence,
): IHomeBehaviorOracleEvidence {
  return {
    ...evidence,
    provenance: resolveEvidenceProvenance(evidence.kind),
    platform:
      evidence.platform ?? (evidence.kind === 'ui' ? 'iosNative' : 'shared'),
    currentRun: 'notRun',
  };
}

function materializeObservation({
  evidence,
  observation,
  platform,
}: {
  evidence: readonly IHomeBehaviorOracleEvidence[];
  observation: IRawHomeBehaviorOracleObservation;
  platform: IHomeBehaviorOracleEvidencePlatform;
}): IHomeBehaviorOracleObservation {
  const observationPlatform = observation.platform ?? platform;
  const historicalEvidence = evidence.find(
    (item) =>
      item.provenance === 'historicalUI' &&
      item.platform === observationPlatform,
  );
  return {
    ...observation,
    platform: observationPlatform,
    fixture: observation.fixture ?? historicalEvidence?.fixture,
    date: observation.date ?? historicalEvidence?.date,
    currentRun: 'notRun',
  };
}

export const homeBehaviorOracleFixtures: readonly IHomeBehaviorOracleFixture[] =
  rawHomeBehaviorOracleFixtures.map((fixture) => {
    const evidence = fixture.evidence.map(materializeEvidence);
    return {
      ...fixture,
      currentRun: 'notRun',
      evidence,
      observed: {
        legacy: materializeObservation({
          evidence,
          observation: fixture.observed.legacy,
          platform: 'iosLegacyReact',
        }),
        native: materializeObservation({
          evidence,
          observation: fixture.observed.native,
          platform: 'iosNative',
        }),
      },
    };
  });

export const REQUIRED_HOME_UI_COVERAGE_IDS = [
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

export type IHomeUICoverageId = (typeof REQUIRED_HOME_UI_COVERAGE_IDS)[number];

export interface IHomeUICoverageManifestItem {
  id: IHomeUICoverageId;
  category:
    | 'account'
    | 'scope'
    | 'tab'
    | 'market'
    | 'interaction'
    | 'history'
    | 'scroll'
    | 'appearance'
    | 'image'
    | 'warning'
    | 'blockedFixture';
  status: 'historical' | 'notObserved' | 'open' | 'blocked';
  platforms: readonly IHomeBehaviorOracleEvidencePlatform[];
  fixture: string;
  evidence: readonly IHomeBehaviorOracleEvidence[];
  currentRun: 'notRun';
  summary: string;
}

function historicalUiEvidence({
  date,
  fixture,
  limitation,
  platform = 'iosNative',
  reference,
}: {
  date: string;
  fixture: string;
  limitation?: string;
  platform?: IHomeBehaviorOracleEvidencePlatform;
  reference: string;
}): IHomeBehaviorOracleEvidence {
  return materializeEvidence({
    kind: 'ui',
    date,
    fixture,
    limitation,
    platform,
    reference,
  });
}

function historicalCoverage({
  additionalReferences = [],
  category,
  date,
  fixture,
  id,
  limitation,
  platform = 'iosNative',
  reference,
  summary,
}: {
  additionalReferences?: readonly {
    limitation?: string;
    reference: string;
  }[];
  category: IHomeUICoverageManifestItem['category'];
  date: string;
  fixture: string;
  id: IHomeUICoverageId;
  limitation?: string;
  platform?: IHomeBehaviorOracleEvidencePlatform;
  reference: string;
  summary: string;
}): IHomeUICoverageManifestItem {
  return {
    id,
    category,
    status: 'historical',
    platforms: [platform],
    fixture,
    evidence: [
      historicalUiEvidence({
        date,
        fixture,
        limitation,
        platform,
        reference,
      }),
      ...additionalReferences.map((additional) =>
        historicalUiEvidence({
          date,
          fixture,
          limitation: additional.limitation,
          platform,
          reference: additional.reference,
        }),
      ),
    ],
    currentRun: 'notRun',
    summary,
  };
}

function unverifiedCoverage({
  category,
  fixture,
  id,
  platform = 'iosNative',
  status,
  summary,
}: {
  category: IHomeUICoverageManifestItem['category'];
  fixture: string;
  id: IHomeUICoverageId;
  platform?: IHomeBehaviorOracleEvidencePlatform;
  status: 'notObserved' | 'open' | 'blocked';
  summary: string;
}): IHomeUICoverageManifestItem {
  return {
    id,
    category,
    status,
    platforms: [platform],
    fixture,
    evidence: [],
    currentRun: 'notRun',
    summary,
  };
}

const latestAccountFixture = 'existing-backed-hd-account1-account8';
const latestScopeFixture = 'existing-funded-multichain-account1';
const latestZeroFixture = 'existing-backed-hd-account8-zero';

export const homeUICoverageManifest: readonly IHomeUICoverageManifestItem[] = [
  historicalCoverage({
    id: 'account8ToAccount1',
    category: 'account',
    date: '2026-07-20',
    fixture: latestAccountFixture,
    reference:
      '.tmp/ui/native-home-authority-final-20260720/account8-to-account1-funded.mp4',
    summary:
      'Historical Debug recording covers zero Account #8 to funded Account #1.',
  }),
  historicalCoverage({
    id: 'account1ToAccount8',
    category: 'account',
    date: '2026-07-20',
    fixture: latestAccountFixture,
    reference:
      '.tmp/ui/native-home-authority-final-20260720/account1-to-account8-zero.mp4',
    summary:
      'Historical Debug recording covers funded Account #1 to zero Account #8.',
  }),
  historicalCoverage({
    id: 'scopeAllNetworks',
    category: 'scope',
    date: '2026-07-20',
    fixture: latestScopeFixture,
    reference:
      '.tmp/ui/native-home-authority-final-20260720/32-all-networks-restored.png',
    summary:
      'Historical settled All Networks scope with five applicable top-level tabs.',
  }),
  historicalCoverage({
    id: 'scopeBitcoin',
    category: 'scope',
    date: '2026-07-20',
    fixture: latestScopeFixture,
    reference:
      '.tmp/ui/native-home-authority-final-20260720/20-scope-bitcoin.png',
    summary:
      'Historical Bitcoin scope on the existing multichain funded account.',
  }),
  historicalCoverage({
    id: 'scopeEthereum',
    category: 'scope',
    date: '2026-07-20',
    fixture: latestScopeFixture,
    reference:
      '.tmp/ui/native-home-authority-final-20260720/22-scope-ethereum.png',
    summary: 'Historical Ethereum scope and its applicable top-level tabs.',
  }),
  historicalCoverage({
    id: 'scopeSolana',
    category: 'scope',
    date: '2026-07-20',
    fixture: latestScopeFixture,
    reference:
      '.tmp/ui/native-home-authority-final-20260720/23-scope-solana.png',
    summary: 'Historical Solana scope and its applicable top-level tabs.',
  }),
  historicalCoverage({
    id: 'scopePolygon',
    category: 'scope',
    date: '2026-07-20',
    fixture: latestScopeFixture,
    reference:
      '.tmp/ui/native-home-authority-final-20260720/26-scope-polygon-confirmed.png',
    summary: 'Historical confirmed Polygon scope and rows.',
  }),
  historicalCoverage({
    id: 'scopeTon',
    category: 'scope',
    date: '2026-07-20',
    fixture: 'existing-multichain-account1-without-ton-address',
    reference: '.tmp/ui/native-home-authority-final-20260720/28-scope-ton.png',
    limitation:
      'This proves only the no-address terminal, not ordinary TON rows or tabs.',
    summary:
      'Historical TON no-address terminal for the available account fixture.',
  }),
  historicalCoverage({
    id: 'scopeTron',
    category: 'scope',
    date: '2026-07-20',
    fixture: latestScopeFixture,
    reference: '.tmp/ui/native-home-authority-final-20260720/30-scope-tron.png',
    summary: 'Historical TRON scope and rows.',
  }),
  ...(
    [
      ['tabSpot', 'Spot'],
      ['tabPerps', 'Perps'],
      ['tabDefi', 'DeFi'],
      ['tabNft', 'NFT'],
      ['tabHistory', 'History'],
    ] as const
  ).map(([id, title]) =>
    historicalCoverage({
      id,
      category: 'tab',
      date: '2026-07-19',
      fixture: latestZeroFixture,
      reference:
        '.tmp/ui/native-home-four-issues-after-20260719/native-final-verification.mp4',
      summary: `Historical Debug recording includes the ${title} top-level tab.`,
    }),
  ),
  historicalCoverage({
    id: 'marketFavorites',
    category: 'market',
    date: '2026-07-18',
    fixture: 'existing-market-favorites',
    reference: '.tmp/ui/handoff-ui-market-favorites-after-debug.png',
    summary: 'Historical settled Market Favorites category.',
  }),
  historicalCoverage({
    id: 'marketTrending',
    category: 'market',
    date: '2026-07-18',
    fixture: 'existing-market-trending',
    reference: '.tmp/ui/handoff-ui-market-trending-after-debug.png',
    summary:
      'Historical settled Market Trending category; not a loading-state proof.',
  }),
  historicalCoverage({
    id: 'marketStocks',
    category: 'market',
    date: '2026-07-18',
    fixture: 'existing-market-stocks',
    reference: '.tmp/ui/handoff-ui-market-stocks-after-debug.png',
    summary:
      'Historical settled Market Stocks category with successful image candidates.',
  }),
  historicalCoverage({
    id: 'marketPerps',
    category: 'market',
    date: '2026-07-16',
    fixture: 'historical-server-config-with-market-perps',
    reference: '.tmp/ui/ab-audit-native-market-perps.png',
    limitation:
      'Market Perps remains server-config dependent and is not present in every run.',
    summary:
      'Historical Market Perps category under a compatible server configuration.',
  }),
  historicalCoverage({
    id: 'marketStarToggle',
    category: 'market',
    date: '2026-07-18',
    fixture: 'existing-market-favorite-row',
    reference:
      '.tmp/ui/native-home-final-20260718/market-star-toggle-final.mp4',
    summary:
      'Historical real interaction proves smooth Star add/remove, stable rows and Market height, and no row-navigation bubbling.',
  }),
  historicalCoverage({
    id: 'marketAdd4Tokens',
    category: 'market',
    date: '2026-07-16',
    fixture: 'existing-empty-market-favorites',
    additionalReferences: [
      {
        reference: '.tmp/ui/native-home-market-add4-refresh-contact-sheet.png',
      },
    ],
    reference: '.tmp/ui/native-home-market-add4-refresh-after-fix.mov',
    summary:
      'Historical real interaction proves immediate Add 4 tokens refresh without rows-empty-rows.',
  }),
  unverifiedCoverage({
    id: 'pressedState',
    category: 'interaction',
    fixture: 'fixture-not-run-dedicated-pressed-state-matrix',
    status: 'open',
    summary:
      'A dedicated real multi-control pressed-state matrix has not been rerun in Phase 0A.',
  }),
  unverifiedCoverage({
    id: 'hoverState',
    category: 'interaction',
    fixture: 'fixture-unavailable-iphone-simulator-pointer-hover',
    status: 'blocked',
    summary:
      'Real pointer hover is blocked on the iPhone Simulator and cannot be inferred from source inspection.',
  }),
  unverifiedCoverage({
    id: 'focusState',
    category: 'interaction',
    fixture: 'fixture-not-run-dedicated-focus-state-matrix',
    status: 'open',
    summary:
      'A dedicated keyboard or assistive focus-state run has not been captured in Phase 0A.',
  }),
  historicalCoverage({
    id: 'historyNonEmpty',
    category: 'history',
    date: '2026-07-17',
    fixture: 'historical-account-with-history-rows',
    reference:
      '.tmp/ui/home-tabs-recompare-20260717/native-history-01-body.png',
    limitation:
      'This predates the latest authority/PageFooter build and requires a fresh rerun.',
    summary:
      'Historical non-empty History rows exist, but are not current-run evidence.',
  }),
  historicalCoverage({
    id: 'historyFooter',
    category: 'history',
    date: '2026-07-17',
    fixture: 'historical-all-networks-account-with-history-footer',
    additionalReferences: [
      {
        reference:
          '.tmp/ui/native-home-nine-regressions-20260717/final/history-explorer-network-selection.png',
      },
    ],
    reference:
      '.tmp/ui/native-home-nine-regressions-20260717/final/history-footer-bottom.png',
    limitation:
      'Historical iOS Debug evidence only; it does not establish that the same fixture is available today.',
    summary:
      'Historical evidence shows the complete footer above the tab bar and the real network-selection result after tapping Block explorer.',
  }),
  historicalCoverage({
    id: 'historyIncomingValue',
    category: 'history',
    date: '2026-07-17',
    fixture: 'historical-account-with-incoming-history-values',
    additionalReferences: [
      {
        reference:
          '.tmp/ui/native-home-nine-regressions-20260717/final/history-settled.png',
      },
    ],
    reference:
      '.tmp/ui/native-home-nine-regressions-20260717/final/history-first-frame.png',
    limitation:
      'Historical iOS Debug evidence only; it does not establish that the same incoming transactions are available today.',
    summary:
      'Historical first and settled frames show incoming History values using the positive green accent.',
  }),
  historicalCoverage({
    id: 'nftToHistoryTransition',
    category: 'history',
    date: '2026-07-19',
    fixture: latestZeroFixture,
    reference:
      '.tmp/ui/native-home-four-issues-after-20260719/03-history-r1-from-nft-first.png',
    summary: 'Historical first frame for an NFT to History transition.',
  }),
  historicalCoverage({
    id: 'scrollBidirectionalInertia',
    category: 'scroll',
    date: '2026-07-20',
    fixture: latestScopeFixture,
    reference:
      '.tmp/ui/native-home-authority-final-20260720/33-all-networks-bidirectional-fling.mp4',
    summary:
      'Historical bidirectional fling and post-release deceleration evidence.',
  }),
  historicalCoverage({
    id: 'scrollBottomReachability',
    category: 'scroll',
    date: '2026-07-20',
    fixture: latestScopeFixture,
    reference:
      '.tmp/ui/native-home-authority-final-20260720/38-all-networks-to-bottom.mp4',
    summary: 'Historical true-bottom reachability above the floating tab bar.',
  }),
  historicalCoverage({
    id: 'themeDark',
    category: 'appearance',
    date: '2026-07-18',
    fixture: 'existing-account-dark-large',
    reference:
      '.tmp/ui/native-home-final-20260718/market-dark-large-restored-final.png',
    summary: 'Historical Dark Mode evidence.',
  }),
  historicalCoverage({
    id: 'themeLight',
    category: 'appearance',
    date: '2026-07-18',
    fixture: 'existing-account-light-large',
    reference:
      '.tmp/ui/native-home-final-20260718/market-light-large-final.png',
    summary: 'Historical Light Mode evidence.',
  }),
  historicalCoverage({
    id: 'dynamicTypeLargeAndXxxl',
    category: 'appearance',
    date: '2026-07-18',
    fixture: 'existing-account-dynamic-type',
    additionalReferences: [
      {
        reference:
          '.tmp/ui/native-home-final-20260718/market-large-restored-final.png',
      },
    ],
    limitation:
      'The AXXXL frame has a bottom error toast reading "fail to format invalid number: Unlimited..."; it proves Market geometry and readability only, not an error-free or toast-free page, every page, language, or Dynamic Type combination.',
    reference: '.tmp/ui/native-home-final-20260718/market-AXXXL-final.png',
    summary:
      'Historical AXXXL evidence and the separately captured restored Large state.',
  }),
  historicalCoverage({
    id: 'imageCandidatesSuccess',
    category: 'image',
    date: '2026-07-18',
    fixture: 'existing-market-stocks-success-images',
    reference: '.tmp/ui/handoff-ui-market-stocks-after-debug.png',
    summary:
      'Historical successful server-image candidate evidence for Stocks.',
  }),
  historicalCoverage({
    id: 'imageCandidatesAllFailed',
    category: 'image',
    date: '2026-07-18',
    fixture: 'forced-image-all-candidates-failed',
    reference:
      '.tmp/ui/native-home-accessibility-fix-20260718/image-all-fail-market-stocks-settled-rebuilt.png',
    summary: 'Historical forced all-candidates-failed fallback evidence.',
  }),
  historicalCoverage({
    id: 'pageFooterWarning',
    category: 'warning',
    date: '2026-07-20',
    fixture: latestScopeFixture,
    reference:
      '.tmp/ui/native-home-pagefooter-final-20260720/10-three-valid-rounds-network-ab.mp4',
    summary:
      'Historical three-round Single/All selector recording shows no visible warning or error toast in the captured UI.',
  }),
  unverifiedCoverage({
    id: 'freshOnboarding',
    category: 'blockedFixture',
    fixture: 'fixture-not-available-fresh-onboarding',
    status: 'blocked',
    summary:
      'Fresh onboarding is distinct from newUnbackedWallet and has no safe fixture.',
  }),
  unverifiedCoverage({
    id: 'noWalletFirstLaunch',
    category: 'blockedFixture',
    fixture: 'fixture-not-available-no-wallet-first-launch',
    status: 'blocked',
    summary:
      'No-wallet first launch remains outside the observed account-switch evidence.',
  }),
  unverifiedCoverage({
    id: 'firstCreatedEmptyWallet',
    category: 'blockedFixture',
    fixture: 'fixture-not-available-first-created-empty-wallet',
    status: 'blocked',
    summary:
      'Account #8 is a new account inside an existing wallet, not the first created wallet.',
  }),
  unverifiedCoverage({
    id: 'genuineSingleNetworkFunded',
    category: 'blockedFixture',
    fixture: 'fixture-not-available-genuine-single-network-funded',
    status: 'blocked',
    summary:
      'Bitcoin scope evidence does not substitute for a genuinely single-network funded wallet.',
  }),
  unverifiedCoverage({
    id: 'positiveUnbackedWallet',
    category: 'blockedFixture',
    fixture: 'fixture-not-available-positive-unbacked-wallet',
    status: 'blocked',
    summary:
      'A positive-balance unbacked wallet has not completed a real backup transition run.',
  }),
  unverifiedCoverage({
    id: 'otherWalletTypes',
    category: 'blockedFixture',
    fixture: 'fixture-not-available-other-wallet-types',
    status: 'blocked',
    summary:
      'Keyless, imported, watching, external, hardware, and QR wallet fixtures remain blocked.',
  }),
  unverifiedCoverage({
    id: 'androidDebug',
    category: 'blockedFixture',
    fixture: 'fixture-not-available-android-debug',
    platform: 'androidNative',
    status: 'blocked',
    summary: 'Android Native Home requires an independent real Debug run.',
  }),
  unverifiedCoverage({
    id: 'iosBelow17_4',
    category: 'blockedFixture',
    fixture: 'fixture-not-available-ios-below-17-4',
    status: 'blocked',
    summary:
      'The iOS below-17.4 scroll fallback remains intentionally unverified.',
  }),
];
