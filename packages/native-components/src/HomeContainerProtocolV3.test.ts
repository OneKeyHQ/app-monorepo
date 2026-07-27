import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import {
  HOME_CONTAINER_PROTOCOL_V3_VERSION,
  applyHomeContainerDomainsV3,
  applyHomeContainerSnapshotV3,
} from './HomeContainerProtocolV3';

import type {
  IHomeContainerDomainBatchV3,
  IHomeContainerSnapshotEnvelopeV3,
} from './HomeContainerProtocolV3';

const tabRevisions = {
  portfolio: 1,
  perps: 1,
  defi: 1,
  nft: 1,
  history: 1,
} as const;

const sectionRevisions = {
  ...tabRevisions,
  market: 1,
} as const;

function snapshot(sessionId = 'session-1'): IHomeContainerSnapshotEnvelopeV3 {
  return {
    kind: 'snapshot',
    protocolVersion: HOME_CONTAINER_PROTOCOL_V3_VERSION,
    identity: {
      scopeKey: 'wallet:account:all',
      sessionId,
      storeCommitId: 1,
    },
    presentationRevisions: {
      shell: 1,
      navigation: 1,
      surface: 1,
      sections: tabRevisions,
    },
    authorityRevisions: {
      shellCommands: 1,
      tabApplicability: 1,
      sectionCommands: sectionRevisions,
    },
    payload: {
      selectedTabId: 'portfolio',
      header: {
        accountName: 'Account 1',
        balance: '$1',
        actions: [],
        banners: [],
      },
      tabs: [
        {
          id: 'portfolio',
          title: 'Spot',
          destination: 'inline',
          sections: [],
        },
        {
          id: 'perps',
          title: 'Perps',
          destination: 'inline',
          sections: [],
        },
      ],
      theme: {
        backgroundColor: '#fff',
        cardColor: '#eee',
        dividerColor: '#ddd',
        primaryTextColor: '#111',
        secondaryTextColor: '#666',
        accentColor: '#55f',
        positiveColor: '#080',
        negativeColor: '#f00',
      },
    },
  };
}

function state() {
  const result = applyHomeContainerSnapshotV3(snapshot());
  if (result.kind !== 'applied') {
    throw new OneKeyLocalError('Expected valid snapshot');
  }
  return result.state;
}

function batch(
  updates: IHomeContainerDomainBatchV3['updates'],
  sessionId = 'session-1',
): IHomeContainerDomainBatchV3 {
  return {
    kind: 'domains',
    protocolVersion: HOME_CONTAINER_PROTOCOL_V3_VERSION,
    identity: {
      scopeKey: 'wallet:account:all',
      sessionId,
      storeCommitId: 10,
    },
    updates,
  };
}

describe('HomeContainer protocol v3 domain transport', () => {
  it('accepts skipped generations and applies only the addressed domain', () => {
    const current = state();
    const result = applyHomeContainerDomainsV3(
      batch([
        {
          kind: 'section',
          tabId: 'perps',
          presentationRevision: 20,
          commandRevisions: {
            ...sectionRevisions,
            perps: 8,
          },
          value: [
            {
              id: 'positions',
              items: [],
            },
          ],
        },
      ]),
      current,
    );

    expect(result.kind).toBe('applied');
    if (result.kind !== 'applied') return;
    expect(result.appliedDomains).toEqual(['section:perps']);
    expect(result.state.payload.header).toBe(current.payload.header);
    expect(
      result.state.payload.tabs.find((tab) => tab.id === 'perps')?.sections,
    ).toEqual([{ id: 'positions', items: [] }]);
  });

  it('ignores stale domains without blocking a newer independent domain', () => {
    const current = state();
    const result = applyHomeContainerDomainsV3(
      batch([
        {
          kind: 'shell',
          presentationRevision: 1,
          commandRevision: 1,
          value: {
            accountName: 'Stale',
            balance: '$0',
            actions: [],
            banners: [],
          },
        },
        {
          kind: 'surface',
          presentationRevision: 9,
          value: {
            ...current.payload.theme,
            backgroundColor: '#000',
          },
        },
      ]),
      current,
    );

    expect(result.kind).toBe('applied');
    if (result.kind !== 'applied') return;
    expect(result.appliedDomains).toEqual(['surface']);
    expect(result.state.payload.header.accountName).toBe('Account 1');
    expect(result.state.payload.theme.backgroundColor).toBe('#000');
  });

  it('does not let unrelated authority revisions block a fresh domain', () => {
    const current = state();
    const currentWithNewPortfolioAuthority = {
      ...current,
      authorityRevisions: {
        ...current.authorityRevisions,
        sectionCommands: {
          ...current.authorityRevisions.sectionCommands,
          portfolio: 10,
        },
      },
    };
    const result = applyHomeContainerDomainsV3(
      batch([
        {
          kind: 'section',
          tabId: 'perps',
          presentationRevision: 2,
          commandRevisions: {
            ...sectionRevisions,
            perps: 2,
          },
          value: [{ id: 'positions', items: [] }],
        },
      ]),
      currentWithNewPortfolioAuthority,
    );

    expect(result.kind).toBe('applied');
    if (result.kind !== 'applied') return;
    expect(result.state.authorityRevisions.sectionCommands).toMatchObject({
      portfolio: 10,
      perps: 2,
    });
    expect(result.appliedDomains).toEqual(['section:perps']);
  });

  it('drops late updates from an old owner session', () => {
    expect(
      applyHomeContainerDomainsV3(
        batch(
          [
            {
              kind: 'surface',
              presentationRevision: 2,
              value: state().payload.theme,
            },
          ],
          'old-session',
        ),
        state(),
      ),
    ).toEqual({ kind: 'ignored', reason: 'ownerMismatch' });
  });

  it('merges a delayed same-owner snapshot by domain generation', () => {
    const currentResult = applyHomeContainerDomainsV3(
      batch([
        {
          kind: 'shell',
          presentationRevision: 5,
          commandRevision: 5,
          value: {
            accountName: 'Fresh',
            balance: '$5',
            actions: [],
            banners: [],
          },
        },
      ]),
      state(),
    );
    if (currentResult.kind !== 'applied') {
      throw new OneKeyLocalError('Expected current state');
    }

    const result = applyHomeContainerSnapshotV3(
      snapshot(),
      currentResult.state,
    );
    expect(result).toEqual({ kind: 'ignored', reason: 'stale' });
  });
});
