import {
  HOME_CONTAINER_SCHEMA_VERSION,
  type IHomeContainerSnapshot,
} from '@onekeyhq/native-components';

import {
  createHomeNativePatchEnvelope,
  createHomeNativeSnapshotEnvelope,
  createReplaceNavigationChange,
} from '../native/homeNativeDTOAdapter';

function buildSnapshot(): IHomeContainerSnapshot {
  return {
    schemaVersion: HOME_CONTAINER_SCHEMA_VERSION,
    revision: 3,
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
        sections: [{ id: 'tokens', items: [] }],
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
      negativeColor: '#d00',
    },
  };
}

describe('homeNativeDTOAdapter', () => {
  const owner = { scopeKey: 'wallet:account:all', sessionId: 'session-1' };

  it('uses protocol v2 with business schema v2', () => {
    const envelope = createHomeNativeSnapshotEnvelope({
      owner,
      revision: 9,
      snapshot: buildSnapshot(),
    });

    expect(envelope).toMatchObject({
      kind: 'snapshot',
      protocolVersion: 2,
      schemaVersion: 2,
      owner,
      revision: 9,
    });
    expect(envelope.payload).not.toHaveProperty('revision');
  });

  it('does not embed sections in navigation changes', () => {
    const change = createReplaceNavigationChange(buildSnapshot());
    expect(change.kind).toBe('replaceNavigation');
    if (change.kind === 'replaceNavigation') {
      expect(change.value.tabs).toEqual([
        { id: 'portfolio', title: 'Spot', destination: 'inline' },
      ]);
    }
  });

  it('preserves a section-free typed handoff destination in navigation', () => {
    const snapshot = buildSnapshot();
    const change = createReplaceNavigationChange({
      ...snapshot,
      tabs: [
        ...snapshot.tabs,
        {
          id: 'perps',
          title: 'Perps',
          destination: 'handoff',
          handoffCommandId: 'home.perps.openWeb',
          sections: [],
        },
      ],
    });

    expect(change).toEqual(
      expect.objectContaining({
        kind: 'replaceNavigation',
        value: expect.objectContaining({
          tabs: expect.arrayContaining([
            {
              id: 'perps',
              title: 'Perps',
              destination: 'handoff',
              handoffCommandId: 'home.perps.openWeb',
            },
          ]),
        }),
      }),
    );
  });

  it('creates an owner-scoped patch transaction', () => {
    const envelope = createHomeNativePatchEnvelope({
      owner,
      baseRevision: 9,
      revision: 10,
      changes: [createReplaceNavigationChange(buildSnapshot())],
    });
    expect(envelope).toMatchObject({ owner, baseRevision: 9, revision: 10 });
  });
});
