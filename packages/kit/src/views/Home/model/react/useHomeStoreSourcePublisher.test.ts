import { getHomeSourceKeyIdentity } from '../core/homeIdentity';
import { createInitialHomeStoreState } from '../store/homeStoreInitialState';
import {
  applyHomeStorePatchToState,
  reduceHomeStore,
} from '../store/homeStoreReducer';

import {
  createHomeStoreSectionSourceGateway,
  createHomeStoreSourceGateway,
} from './useHomeStoreSourcePublisher';

import type { IHomeStoreEvent, IHomeStoreState } from '../store/homeStoreTypes';

const ownerToken = { scopeKey: 'owner-a', sessionId: 'session-a' };

function applyEvent(state: IHomeStoreState, event: IHomeStoreEvent) {
  return applyHomeStorePatchToState(
    state,
    reduceHomeStore(state, event).patch.mutations,
  );
}

function createGatewayHarness({
  harnessOwnerToken = ownerToken,
  producerInstanceId = 'producer-a',
}: {
  harnessOwnerToken?: typeof ownerToken;
  producerInstanceId?: string;
} = {}) {
  let state = applyEvent(createInitialHomeStoreState(), {
    type: 'ownerChanged',
    owner: {
      walletId: 'wallet-a',
      accountId: 'account-a',
      network: { kind: 'allNetworks' },
    },
    ownerToken: harnessOwnerToken,
    topology: 'single',
  });
  state = applyEvent(state, {
    type: 'runtimeChanged',
    runtime: {
      topology: 'single',
      connection: 'ready',
      producerInstanceId,
      protocolVersion: 1,
    },
  });
  const events: IHomeStoreEvent[] = [];
  const gatewayOptions = {
    dispatchHomeEvent: (event: IHomeStoreEvent) => {
      events.push(event);
      state = applyEvent(state, event);
    },
    readHomeStoreSnapshot: () => state,
  };
  return {
    events,
    gateway: createHomeStoreSectionSourceGateway({
      ...gatewayOptions,
      clientInstanceId: 'section-client-a',
      fallbackProducerInstanceId: 'fallback-producer',
    }),
    sourceGateway: createHomeStoreSourceGateway({
      ...gatewayOptions,
      clientInstanceId: 'resource-client-a',
      fallbackProducerInstanceId: 'fallback-producer',
    }),
    getState: () => state,
  };
}

describe('Home Store production source gateways', () => {
  it('tokenizes a typed banner request before completion', () => {
    const harness = createGatewayHarness();
    const handle = harness.sourceGateway.begin({
      ownerToken,
      sourceId: 'banner',
    });
    const payload = {
      banners: [],
      referralEligibility: null,
      tronResource: null,
      isBotWalletReceiveBlocked: false,
    } as const;

    expect(harness.events[0]).toMatchObject({
      type: 'sourceRequested',
      token: handle.token,
    });
    harness.sourceGateway.complete(handle, {
      kind: 'success',
      data: payload,
      coverageFingerprint: 'banner-empty',
    });
    expect(harness.getState().resources.banner).toMatchObject({
      kind: 'ready',
      data: payload,
      token: handle.token,
    });
  });

  it('rejects a stale typed response after a newer request', () => {
    const harness = createGatewayHarness();
    const first = harness.sourceGateway.begin({
      ownerToken,
      sourceId: 'banner',
    });
    const second = harness.sourceGateway.begin({
      ownerToken,
      sourceId: 'banner',
    });
    harness.sourceGateway.complete(first, {
      kind: 'success',
      data: {
        banners: [],
        referralEligibility: null,
        tronResource: null,
        isBotWalletReceiveBlocked: false,
      },
      coverageFingerprint: 'stale',
    });

    expect(harness.getState().resources.banner).toMatchObject({
      kind: 'loading',
      token: second.token,
    });
    expect(harness.getState().diagnostics.lastRejectReason).toBe(
      'requestSequenceStale',
    );
  });

  it('opens a section request before source work and completes the same token', () => {
    const harness = createGatewayHarness();
    const handle = harness.gateway.begin({ ownerToken, sectionId: 'nft' });

    expect(harness.events).toEqual([
      expect.objectContaining({
        type: 'sourceRequested',
        token: handle.token,
      }),
    ]);
    harness.gateway.complete(handle, {
      kind: 'ready',
      rowIds: ['nft-a'],
      data: { data: [{ id: 'nft-a' }] },
      freshness: 'live',
      refresh: 'idle',
    });

    expect(harness.events[1]).toMatchObject({
      type: 'sourceResponded',
      envelope: { token: handle.token },
    });
    expect(harness.getState().resources.nft).toMatchObject({
      kind: 'ready',
      token: handle.token,
    });
  });

  it('keeps a stable source identity across runtime session restarts', () => {
    const firstOwnerToken = {
      scopeKey: ownerToken.scopeKey,
      sessionId: 'session-a',
    };
    const secondOwnerToken = {
      scopeKey: ownerToken.scopeKey,
      sessionId: 'session-b',
    };
    const first = createGatewayHarness({
      harnessOwnerToken: firstOwnerToken,
      producerInstanceId: 'producer-a',
    }).gateway.begin({
      ownerToken: firstOwnerToken,
      sectionId: 'portfolio',
      paramsFingerprint: 'stable-portfolio-business-identity',
      quoteBasis: { currency: 'usd' },
    });
    const second = createGatewayHarness({
      harnessOwnerToken: secondOwnerToken,
      producerInstanceId: 'producer-b',
    }).gateway.begin({
      ownerToken: secondOwnerToken,
      sectionId: 'portfolio',
      paramsFingerprint: 'stable-portfolio-business-identity',
      quoteBasis: { currency: 'usd' },
    });

    expect(first.token.sessionId).not.toBe(second.token.sessionId);
    expect(first.token.producerInstanceId).not.toBe(
      second.token.producerInstanceId,
    );
    expect(getHomeSourceKeyIdentity(first.token.sourceKey)).toBe(
      getHomeSourceKeyIdentity(second.token.sourceKey),
    );
  });

  it('keeps ready rows visible while an explicit refresh request is pending', () => {
    const harness = createGatewayHarness();
    const readyHandle = harness.gateway.begin({
      ownerToken,
      sectionId: 'defi',
    });
    harness.gateway.complete(readyHandle, {
      kind: 'ready',
      rowIds: ['protocol-a'],
      data: { protocols: [{ id: 'protocol-a' }] },
      freshness: 'live',
      refresh: 'idle',
    });

    const refreshHandle = harness.gateway.begin({
      ownerToken,
      sectionId: 'defi',
    });
    expect(harness.getState().resources.defi).toMatchObject({
      kind: 'ready',
      refresh: 'refreshing',
      token: refreshHandle.token,
    });
    expect(harness.getState().sections.defi.value).toMatchObject({
      kind: 'ready',
      rowIds: ['protocol-a'],
      refresh: 'refreshing',
    });
  });

  it('rejects an explicitly completed stale section request', () => {
    const harness = createGatewayHarness();
    const first = harness.gateway.begin({ ownerToken, sectionId: 'history' });
    const second = harness.gateway.begin({ ownerToken, sectionId: 'history' });

    harness.gateway.complete(first, {
      kind: 'ready',
      rowIds: ['stale'],
      data: { data: [{ id: 'stale' }] },
      freshness: 'live',
      refresh: 'idle',
    });

    expect(harness.getState().resources.history).toMatchObject({
      kind: 'loading',
      token: second.token,
    });
    expect(harness.getState().diagnostics.lastRejectReason).toBe(
      'requestSequenceStale',
    );
  });
});
