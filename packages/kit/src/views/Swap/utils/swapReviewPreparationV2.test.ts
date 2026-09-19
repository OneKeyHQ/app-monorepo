import type {
  ISwapReviewPreparationDeclaration,
  ISwapReviewSessionIdentityFields,
} from '@onekeyhq/shared/types/swap/types';
import { SWAP_REVIEW_PREPARATION_CAPABILITY_VERSION } from '@onekeyhq/shared/types/swap/types';

import {
  advanceSwapReviewSession,
  buildSwapReviewPreparationFreshnessFingerprint,
  canRebuildSwapReviewBeforeConfirm,
  canReuseSwapReviewPreparationArtifact,
  canReuseSwapReviewPreparedBuild,
  createSwapReviewPreparationArtifact,
  createSwapReviewSession,
  isSwapReviewPreparationArtifactCurrent,
  resolveSwapReviewPreparationCapability,
} from './swapReviewPreparationV2';

const identity: ISwapReviewSessionIdentityFields = {
  entrySource: 'swap',
  accountId: 'account-1',
  receivingAccountId: 'account-2',
  fromNetworkId: 'evm--1',
  toNetworkId: 'evm--1',
  fromTokenId: '0xfrom',
  toTokenId: '0xto',
  fromAmount: '1',
  toAmount: '100',
  receiver: '0xreceiver',
  provider: 'onekey',
  quoteId: 'quote-1',
  eventId: 'event-1',
  quoteGeneration: 1,
  protocol: 'swap',
  outputKind: 'rawTx',
  slippage: 1,
  approvalMode: 'approve',
  feeMode: 'review-network-fee',
  walletType: 'hd',
  customRpcFingerprint: 'default',
  gasAccountMode: 'default',
  tradeSource: 'swap',
  quoteContextFingerprint: 'quote-context-1',
  routeFingerprint: 'route-1',
};

function createDeclaration(
  overrides: Partial<ISwapReviewPreparationDeclaration> = {},
): ISwapReviewPreparationDeclaration {
  return {
    version: SWAP_REVIEW_PREPARATION_CAPABILITY_VERSION,
    mode: 'readOnlyPrebuild',
    outputKind: 'rawTx',
    safeBeforeReview: true,
    sideEffectFree: true,
    canReuseEncodedTx: true,
    requiresFreshBuildAtConfirm: false,
    requiresFreshFeeAtConfirm: false,
    ...overrides,
  };
}

describe('swapReviewPreparationV2', () => {
  it('keeps the same session for an unchanged identity and increments revision on change', () => {
    const session = createSwapReviewSession({
      sessionId: 'session-1',
      identity,
    });

    expect(advanceSwapReviewSession({ current: session, identity })).toBe(
      session,
    );

    const changed = advanceSwapReviewSession({
      current: session,
      identity: { ...identity, provider: 'jupiter' },
    });

    expect(changed.sessionId).toBe(session.sessionId);
    expect(changed.revision).toBe(session.revision + 1);
    expect(changed.provider).toBe('jupiter');
  });

  it.each([
    {
      name: 'missing declaration',
      declaration: undefined,
      reason: 'missing-contract' as const,
    },
    {
      name: 'provider order output',
      declaration: createDeclaration({ outputKind: 'signedOrder' }),
      reason: 'unsafe-output' as const,
    },
    {
      name: 'deposit output',
      declaration: createDeclaration({ outputKind: 'depositChannel' }),
      reason: 'unsafe-output' as const,
    },
    {
      name: 'declared side effect',
      declaration: createDeclaration({ createsThirdPartyOrder: true }),
      reason: 'side-effectful-contract' as const,
    },
    {
      name: 'server prepare without a prepare/adopt owner',
      declaration: createDeclaration({ mode: 'serverPrepare' }),
      reason: 'missing-prepare-contract' as const,
    },
  ])('fails closed for $name', ({ declaration, reason }) => {
    const capability = resolveSwapReviewPreparationCapability({
      declaration,
      implementation: 'vault-test',
      provider: 'provider-test',
    });

    expect(capability.preparationMode).toBe('confirmOnly');
    expect(capability.canPrepareBeforeReview).toBe(false);
    expect(capability.canReuseEncodedTx).toBe(false);
    expect(capability.requiresFreshBuildAtConfirm).toBe(true);
    expect(capability.requiresFreshFeeAtConfirm).toBe(true);
    expect(capability.reason).toBe(reason);
  });

  it('fails closed when the Vault implementation is unavailable', () => {
    const capability = resolveSwapReviewPreparationCapability({
      declaration: createDeclaration(),
      implementation: 'unknown',
      provider: 'provider-test',
    });

    expect(capability.preparationMode).toBe('confirmOnly');
    expect(capability.canPrepareBeforeReview).toBe(false);
    expect(capability.canReuseEncodedTx).toBe(false);
    expect(capability.reason).toBe('missing-implementation');
  });

  it('fails closed for malformed runtime implementation values', () => {
    expect(() =>
      resolveSwapReviewPreparationCapability({
        declaration: createDeclaration(),
        implementation: {} as unknown as string,
      }),
    ).not.toThrow();

    expect(
      resolveSwapReviewPreparationCapability({
        declaration: createDeclaration(),
        implementation: {} as unknown as string,
      }),
    ).toMatchObject({
      implementation: 'unknown',
      preparationMode: 'confirmOnly',
      reason: 'missing-implementation',
    });
  });

  it('only permits confirm-time review rebuild for reusable read-only preparation', () => {
    const safeCapability = resolveSwapReviewPreparationCapability({
      declaration: createDeclaration(),
      implementation: 'vault-test',
    });
    const confirmOnlyCapability = resolveSwapReviewPreparationCapability({
      declaration: undefined,
      implementation: 'vault-test',
    });

    expect(
      canRebuildSwapReviewBeforeConfirm({
        requiresSlippageRebuildOnConfirm: true,
        capability: safeCapability,
      }),
    ).toBe(true);
    expect(
      canRebuildSwapReviewBeforeConfirm({
        requiresSlippageRebuildOnConfirm: true,
        capability: confirmOnlyCapability,
      }),
    ).toBe(false);
    expect(
      canRebuildSwapReviewBeforeConfirm({
        requiresSlippageRebuildOnConfirm: false,
        capability: safeCapability,
      }),
    ).toBe(false);
  });

  it('does not permit encoded transaction reuse when chain freshness is required', () => {
    const capability = resolveSwapReviewPreparationCapability({
      declaration: createDeclaration({ requiresFreshNonceOrSequence: true }),
      implementation: 'vault-test',
    });

    expect(capability.canPrepareBeforeReview).toBe(true);
    expect(capability.canReuseEncodedTx).toBe(false);
    expect(capability.requiresFreshNonceOrSequence).toBe(true);
  });

  it('fails closed when capability freshness flags disagree with the artifact', () => {
    const session = createSwapReviewSession({
      sessionId: 'session-1',
      identity,
    });
    const capability = resolveSwapReviewPreparationCapability({
      declaration: createDeclaration(),
      implementation: 'vault-test',
    });
    const encodedTx = { nonce: 1 };
    const freshnessFingerprint = buildSwapReviewPreparationFreshnessFingerprint(
      {
        encodedTx,
        transferInfo: [{ amount: '1' }],
      },
    );
    const artifact = createSwapReviewPreparationArtifact({
      identity: session,
      capability,
      artifactId: 'artifact-1',
      createdAt: 1000,
      freshnessFingerprint,
    });

    expect(
      canReuseSwapReviewPreparedBuild({
        artifact,
        capability: {
          ...capability,
          requiresFreshBuildAtConfirm: true,
        },
        identity: session,
        now: 1001,
        freshnessFingerprint,
        encodedTx,
        sideEffectsCommitted: false,
      }),
    ).toBe(false);
  });

  it.each([
    {
      name: 'non-object declaration',
      declaration: 'malformed',
    },
    {
      name: 'non-boolean safety flag',
      declaration: { ...createDeclaration(), safeBeforeReview: 'yes' },
    },
    {
      name: 'negative expiry',
      declaration: { ...createDeclaration(), expiresInMs: -1 },
    },
    {
      name: 'unknown output kind',
      declaration: { ...createDeclaration(), outputKind: 'futureOutput' },
    },
  ])('rejects malformed declarations: $name', ({ declaration }) => {
    const capability = resolveSwapReviewPreparationCapability({
      declaration: declaration as unknown as ISwapReviewPreparationDeclaration,
      implementation: 'vault-test',
    });

    expect(capability.preparationMode).toBe('confirmOnly');
    expect(capability.canPrepareBeforeReview).toBe(false);
    expect(capability.reason).toBe('invalid-contract');
  });

  it('fails closed when freshness evidence is missing', () => {
    const session = createSwapReviewSession({
      sessionId: 'session-1',
      identity,
    });
    const capability = resolveSwapReviewPreparationCapability({
      declaration: createDeclaration({ reusableUntilMs: 200 }),
      implementation: 'vault-test',
    });
    const artifact = createSwapReviewPreparationArtifact({
      identity: session,
      capability,
      artifactId: 'artifact-1',
      createdAt: 1000,
    });

    expect(
      isSwapReviewPreparationArtifactCurrent({
        artifact,
        identity: session,
        now: 1001,
      }),
    ).toBe(false);
    expect(
      canReuseSwapReviewPreparedBuild({
        artifact,
        capability,
        identity: session,
        now: 1001,
        encodedTx: { nonce: 1 },
        sideEffectsCommitted: false,
      }),
    ).toBe(false);
  });

  it('creates an artifact with independent expiry and reusable-until boundaries', () => {
    const session = createSwapReviewSession({
      sessionId: 'session-1',
      identity,
    });
    const capability = resolveSwapReviewPreparationCapability({
      declaration: createDeclaration({
        expiresInMs: 100,
        reusableUntilMs: 200,
      }),
      implementation: 'vault-test',
    });
    const freshnessFingerprint = buildSwapReviewPreparationFreshnessFingerprint(
      {
        encodedTx: { nonce: 1 },
        transferInfo: [{ amount: '1' }],
      },
    );
    const artifact = createSwapReviewPreparationArtifact({
      identity: session,
      capability,
      artifactId: 'artifact-1',
      createdAt: 1000,
      freshnessFingerprint,
    });

    expect(artifact).toBeDefined();
    expect(artifact?.expiresAt).toBe(1100);
    expect(artifact?.reusableUntil).toBe(1200);
    expect(
      isSwapReviewPreparationArtifactCurrent({
        artifact,
        identity: session,
        now: 1099,
        freshnessFingerprint,
      }),
    ).toBe(true);
    expect(
      isSwapReviewPreparationArtifactCurrent({
        artifact,
        identity: session,
        now: 1100,
        freshnessFingerprint,
      }),
    ).toBe(false);
  });

  it('rejects reuse for stale identity, freshness, expiry, or side effects', () => {
    const session = createSwapReviewSession({
      sessionId: 'session-1',
      identity,
    });
    const capability = resolveSwapReviewPreparationCapability({
      declaration: createDeclaration({ reusableUntilMs: 200 }),
      implementation: 'vault-test',
    });
    const encodedTx = { nonce: 1 };
    const freshnessFingerprint = buildSwapReviewPreparationFreshnessFingerprint(
      {
        encodedTx,
        transferInfo: [{ amount: '1' }],
      },
    );
    const artifact = createSwapReviewPreparationArtifact({
      identity: session,
      capability,
      artifactId: 'artifact-1',
      createdAt: 1000,
      freshnessFingerprint,
    });

    expect(
      canReuseSwapReviewPreparedBuild({
        artifact,
        capability,
        identity: session,
        now: 1199,
        freshnessFingerprint,
        encodedTx,
        sideEffectsCommitted: false,
      }),
    ).toBe(true);
    expect(
      canReuseSwapReviewPreparedBuild({
        artifact,
        capability,
        identity: { ...session, revision: session.revision + 1 },
        now: 1199,
        freshnessFingerprint,
        encodedTx,
        sideEffectsCommitted: false,
      }),
    ).toBe(false);
    expect(
      canReuseSwapReviewPreparedBuild({
        artifact,
        capability,
        identity: session,
        now: 1199,
        freshnessFingerprint: `${freshnessFingerprint}-stale`,
        encodedTx,
        sideEffectsCommitted: false,
      }),
    ).toBe(false);
    expect(
      canReuseSwapReviewPreparedBuild({
        artifact,
        capability,
        identity: session,
        now: 1199,
        freshnessFingerprint,
        encodedTx,
        sideEffectsCommitted: true,
      }),
    ).toBe(false);
    expect(
      canReuseSwapReviewPreparationArtifact({
        artifact,
        identity: session,
        now: 1200,
        freshnessFingerprint,
      }),
    ).toBe(false);
  });
});
