import type { IHomeStoreEvent } from '../../store/homeStoreTypes';

export const phase0HomeOwner = {
  walletId: 'wallet-home-phase0',
  accountId: 'account-home-phase0',
  network: { kind: 'allNetworks' as const },
};

export const phase0HomeOwnerToken = {
  scopeKey: 'wallet-home-phase0__account-home-phase0__allNetworks',
  sessionId: 'home-session-phase0-a',
};

const phase0AvailableCapability = {
  defi: 'available' as const,
  history: 'available' as const,
  market: 'available' as const,
  nft: 'available' as const,
  perps: 'available' as const,
};

const phase0CapabilityReadyEvent: IHomeStoreEvent = {
  type: 'capabilityChanged',
  facts: {
    ownerToken: phase0HomeOwnerToken,
    sourceKeyIdentity: 'phase0-capability-inline',
    resource: {
      kind: 'complete',
      coverageFingerprint: 'phase0-capability-coverage',
      context: {
        accountType: 'hd',
        allNetworks: true,
        networkFamily: 'allNetworks',
        perpsDestination: 'inline',
        productAvailability: phase0AvailableCapability,
        serverConfig: phase0AvailableCapability,
      },
    },
  },
};

export const phase0HomeEventScenarios: Readonly<
  Record<string, readonly IHomeStoreEvent[]>
> = {
  backgroundRuntimeNotReady: [
    {
      type: 'ownerChanged',
      owner: phase0HomeOwner,
      ownerToken: phase0HomeOwnerToken,
      topology: 'split',
    },
    {
      type: 'runtimeChanged',
      runtime: {
        topology: 'split',
        connection: 'waiting',
        protocolVersion: 0,
      },
    },
  ],
  nativeRevisionGap: [
    {
      type: 'ownerChanged',
      owner: phase0HomeOwner,
      ownerToken: phase0HomeOwnerToken,
      topology: 'split',
    },
    {
      type: 'runtimeChanged',
      runtime: {
        topology: 'split',
        connection: 'ready',
        producerInstanceId: 'phase0-producer-a',
        protocolVersion: 3,
      },
    },
  ],
  ownerReplacement: [
    {
      type: 'ownerChanged',
      owner: phase0HomeOwner,
      ownerToken: phase0HomeOwnerToken,
      topology: 'split',
    },
    {
      type: 'ownerChanged',
      owner: { ...phase0HomeOwner, accountId: 'account-home-phase0-b' },
      ownerToken: {
        scopeKey: 'wallet-home-phase0__account-home-phase0-b__allNetworks',
        sessionId: 'home-session-phase0-b',
      },
      topology: 'split',
    },
  ],
  rapidTabs: [
    {
      type: 'ownerChanged',
      owner: phase0HomeOwner,
      ownerToken: phase0HomeOwnerToken,
      topology: 'split',
    },
    phase0CapabilityReadyEvent,
    ...(['portfolio', 'perps', 'defi', 'portfolio', 'defi'] as const).map(
      (tabId, index): IHomeStoreEvent => ({
        type: 'intentReceived',
        intent: {
          type: 'tabSelected',
          intentId: `phase0-rapid-tab-${index}`,
          owner: phase0HomeOwner,
          sessionId: phase0HomeOwnerToken.sessionId,
          tabId,
          authority: { kind: 'tabApplicability', revision: 1 },
        },
      }),
    ),
  ],
};

export const phase0NativeRevisionGapOracle = {
  initialTransportRevision: 1,
  receivedBaseTransportRevision: 2,
  receivedTransportRevision: 3,
  expected: { kind: 'needSnapshot', reason: 'revisionGap' },
  contractTest:
    'packages/native-components/src/HomeContainerProtocolV3.test.ts',
} as const;

export const phase0HomeFailureBaseline = {
  capturedAt: '2026-07-21T18:41:25+08:00',
  captureKind: 'userSupplied' as const,
  source:
    '/Users/huhuanming/Downloads/ScreenRecording_07-21-2026 18-41-25_1.MP4',
  sha256: '7d92744e9e54d47560f3cc791d6eb2e2f7677a634816070ff1235187776ced13',
  provenance: {
    repository: 'unavailable' as const,
    metroBundle: 'unavailable' as const,
  },
  video: {
    codec: 'hevc',
    durationSeconds: 8.206_644,
    framesPerSecond: 60,
    width: 1206,
    height: 2622,
  },
  defects: [
    'Header amount alternates between 11.61 and 11.62 for fixed source data.',
    'Portfolio, Perps, and DeFi intents are delayed or dropped.',
    'DeFi repeatedly replaces ready content with loading frames.',
  ],
  expectedAfterMigration: [
    'A complete balance round promotes exactly one fixed Header amount.',
    'Every valid tab intent updates Store Navigation synchronously.',
    'A same-owner DeFi refresh retains ready rows until terminal replacement.',
  ],
  controlledOracle: {
    rapidTabInputCount: 5,
    rapidTabAcceptedCount: 5,
    rapidTabRejectedCount: 0,
    ownerReplacementEventCount: 2,
    nativeRevisionGapEventCount: 2,
    expectedNativeResyncCount: 1,
  },
} as const;
