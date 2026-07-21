import fs from 'fs';
import path from 'path';

import {
  HOME_CONTAINER_PROTOCOL_V3_VERSION,
  applyHomeContainerPatchV3,
  applyHomeContainerSnapshotV3,
  parseHomeContainerIntentV3,
  validateHomeContainerIntentV3,
} from './HomeContainerProtocolV3';

import type {
  IHomeContainerAuthorityRevisionVectorV3,
  IHomeContainerPatchEnvelopeV3,
  IHomeContainerPresentationRevisionVectorV3,
  IHomeContainerProtocolV3State,
  IHomeContainerSnapshotEnvelopeV3,
} from './HomeContainerProtocolV3';

const sectionRevisions = {
  portfolio: 1,
  perps: 1,
  defi: 1,
  nft: 1,
  history: 1,
  market: 1,
};
const presentationRevisions: IHomeContainerPresentationRevisionVectorV3 = {
  shell: 1,
  navigation: 1,
  sections: sectionRevisions,
};
const authorityRevisions: IHomeContainerAuthorityRevisionVectorV3 = {
  shellCommands: 1,
  tabApplicability: 4,
  sectionCommands: sectionRevisions,
};

function snapshotEnvelope(): IHomeContainerSnapshotEnvelopeV3 {
  return {
    kind: 'snapshot',
    protocolVersion: HOME_CONTAINER_PROTOCOL_V3_VERSION,
    identity: {
      scopeKey: 'owner-a',
      sessionId: 'session-a',
      storeCommitId: 10,
    },
    transportRevision: 1,
    presentationRevisions,
    authorityRevisions,
    slotRevisions: { 'header.balance': 2 },
    payload: {
      selectedTabId: 'portfolio',
      header: {
        accountName: 'Account A',
        balance: '$11.61',
        actions: [],
        banners: [],
      },
      tabs: [
        {
          id: 'portfolio',
          title: 'Portfolio',
          destination: 'inline',
          sections: [],
        },
        {
          id: 'defi',
          title: 'DeFi',
          destination: 'inline',
          sections: [],
        },
      ],
      theme: {
        backgroundColor: '#fff',
        cardColor: '#fff',
        dividerColor: '#ddd',
        primaryTextColor: '#000',
        secondaryTextColor: '#666',
        accentColor: '#00f',
        positiveColor: '#0a0',
        negativeColor: '#f00',
      },
    },
  };
}

function state(): IHomeContainerProtocolV3State {
  const result = applyHomeContainerSnapshotV3(snapshotEnvelope());
  expect(result.kind).toBe('applied');
  return result.kind === 'applied' ? result.state : (undefined as never);
}

function patch(
  current: IHomeContainerProtocolV3State,
  overrides: Partial<IHomeContainerPatchEnvelopeV3> = {},
): IHomeContainerPatchEnvelopeV3 {
  return {
    kind: 'patch',
    protocolVersion: HOME_CONTAINER_PROTOCOL_V3_VERSION,
    identity: { ...current.identity, storeCommitId: 11 },
    baseTransportRevision: current.transportRevision,
    transportRevision: current.transportRevision + 1,
    presentationRevisions: current.presentationRevisions,
    authorityRevisions: current.authorityRevisions,
    requiredSlotRevisions: {},
    changes: [],
    ...overrides,
  };
}

function fixture<T>(name: string): T {
  return JSON.parse(
    fs.readFileSync(path.join(__dirname, '../tests/fixtures', name), 'utf8'),
  ) as T;
}

describe('HomeContainer protocol v3', () => {
  it('applies the canonical cross-language snapshot and patch fixtures', () => {
    const snapshotResult = applyHomeContainerSnapshotV3(
      fixture<IHomeContainerSnapshotEnvelopeV3>(
        'home-container-v3.snapshot.json',
      ),
    );
    expect(snapshotResult.kind).toBe('applied');
    if (snapshotResult.kind !== 'applied') {
      return;
    }
    const patchResult = applyHomeContainerPatchV3({
      current: snapshotResult.state,
      availableSlotRevisions: snapshotResult.state.slotRevisions,
      envelope: fixture<IHomeContainerPatchEnvelopeV3>(
        'home-container-v3.patch.json',
      ),
    });
    expect(patchResult).toMatchObject({
      kind: 'applied',
      state: {
        transportRevision: 12,
        identity: { storeCommitId: 8 },
        payload: {
          selectedTabId: 'history',
          header: { balance: '$101.00' },
        },
      },
    });
  });

  it('applies a Shell-only patch without requiring unchanged slots', () => {
    const current = state();
    const result = applyHomeContainerPatchV3({
      current,
      availableSlotRevisions: current.slotRevisions,
      envelope: patch(current, {
        presentationRevisions: {
          ...current.presentationRevisions,
          shell: 2,
        },
        changes: [
          {
            kind: 'replaceShell',
            value: { ...current.payload.header, balance: '$11.62' },
          },
        ],
      }),
    });
    expect(result).toMatchObject({
      kind: 'applied',
      state: {
        authorityRevisions: { tabApplicability: 4 },
        payload: { header: { balance: '$11.62' } },
      },
    });
  });

  it('waits only for explicitly required slot revisions', () => {
    const current = state();
    expect(
      applyHomeContainerPatchV3({
        current,
        availableSlotRevisions: current.slotRevisions,
        envelope: patch(current, {
          requiredSlotRevisions: { 'content.state.defi': 3 },
        }),
      }),
    ).toEqual({ kind: 'needSnapshot', reason: 'slotRevisionGap' });
  });

  it('accepts multiple tab intents from one applicability revision', () => {
    const current = state();
    for (const [intentId, tabId] of [
      ['tab-portfolio', 'portfolio'],
      ['tab-defi', 'defi'],
    ] as const) {
      const intent = parseHomeContainerIntentV3(
        JSON.stringify({
          protocolVersion: 3,
          intentId,
          owner: {
            scopeKey: current.identity.scopeKey,
            sessionId: current.identity.sessionId,
          },
          authority: { kind: 'tabApplicability', revision: 4 },
          intent: { kind: 'selectTab', tabId },
        }),
      );
      expect(intent).toBeDefined();
      expect(intent && validateHomeContainerIntentV3({ current, intent })).toBe(
        true,
      );
    }
  });

  it('rejects unknown authority and stale owner/session', () => {
    expect(
      parseHomeContainerIntentV3(
        JSON.stringify({
          protocolVersion: 3,
          intentId: 'unknown-authority',
          owner: { scopeKey: 'owner-a', sessionId: 'session-a' },
          authority: { kind: 'globalRevision', revision: 1 },
          intent: { kind: 'selectTab', tabId: 'portfolio' },
        }),
      ),
    ).toBeUndefined();
    const current = state();
    const intent = parseHomeContainerIntentV3(
      JSON.stringify({
        protocolVersion: 3,
        intentId: 'stale-owner',
        owner: { scopeKey: 'owner-b', sessionId: 'session-b' },
        authority: { kind: 'tabApplicability', revision: 4 },
        intent: { kind: 'selectTab', tabId: 'portfolio' },
      }),
    );
    expect(intent).toBeDefined();
    expect(intent && validateHomeContainerIntentV3({ current, intent })).toBe(
      false,
    );
  });

  it('requests resync for transport gaps and revision regression', () => {
    const current = state();
    expect(
      applyHomeContainerPatchV3({
        current,
        availableSlotRevisions: current.slotRevisions,
        envelope: patch(current, { baseTransportRevision: 0 }),
      }),
    ).toEqual({ kind: 'needSnapshot', reason: 'revisionGap' });
    expect(
      applyHomeContainerPatchV3({
        current,
        availableSlotRevisions: current.slotRevisions,
        envelope: patch(current, {
          authorityRevisions: {
            ...current.authorityRevisions,
            tabApplicability: 3,
          },
        }),
      }),
    ).toEqual({ kind: 'needSnapshot', reason: 'invalidInvariant' });
  });
});
