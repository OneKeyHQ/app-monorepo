import fs from 'fs';
import path from 'path';

import {
  HOME_CONTAINER_PROTOCOL_VERSION,
  HOME_CONTAINER_SCHEMA_VERSION,
  type IHomeContainerPatchEnvelope,
  type IHomeContainerSnapshotEnvelope,
  isHomeContainerSnapshotInvariantValid,
  isHomeContainerTransportResultForSubmission,
} from './HomeContainer.types';

function readFixture<T>(name: string): T {
  return JSON.parse(
    fs.readFileSync(path.join(__dirname, '../tests/fixtures', name), 'utf8'),
  ) as T;
}

describe('HomeContainer protocol v2 fixtures', () => {
  it('keeps protocol and business schema versions independent', () => {
    const snapshot = readFixture<IHomeContainerSnapshotEnvelope>(
      'home-container-v2.snapshot.json',
    );

    expect(snapshot.protocolVersion).toBe(HOME_CONTAINER_PROTOCOL_VERSION);
    expect(snapshot.schemaVersion).toBe(HOME_CONTAINER_SCHEMA_VERSION);
    expect(snapshot.payload.tabs).toHaveLength(3);
    expect(snapshot.payload.selectedTabId).toBe('portfolio');
    expect(isHomeContainerSnapshotInvariantValid(snapshot.payload)).toBe(true);
    expect(snapshot.payload.tabs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'perps',
          destination: 'handoff',
          handoffCommandId: 'home.perps.openWeb',
          sections: [],
        }),
      ]),
    );
  });

  it('uses owner-scoped transactional patches with section-free navigation', () => {
    const patch = readFixture<IHomeContainerPatchEnvelope>(
      'home-container-v2.patch.json',
    );
    const navigation = patch.changes.find(
      (change) => change.kind === 'replaceNavigation',
    );

    expect(patch.baseRevision).toBe(7);
    expect(patch.revision).toBe(8);
    expect(patch.owner.sessionId).toBe('session-1');
    expect(navigation?.kind).toBe('replaceNavigation');
    if (navigation?.kind === 'replaceNavigation') {
      expect(navigation.value.tabs.every((tab) => !('sections' in tab))).toBe(
        true,
      );
      expect(navigation.value.tabs).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: 'perps',
            destination: 'handoff',
            handoffCommandId: 'home.perps.openWeb',
          }),
        ]),
      );
    }
  });

  it('does not let stale results change wrapper transport identity', () => {
    const submission = {
      owner: { scopeKey: 'scope-current', sessionId: 'session-current' },
      revision: 9,
    };
    expect(
      isHomeContainerTransportResultForSubmission(
        { kind: 'applied', owner: submission.owner, revision: 9 },
        submission,
      ),
    ).toBe(true);
    expect(
      isHomeContainerTransportResultForSubmission(
        {
          kind: 'applied',
          owner: { ...submission.owner, sessionId: 'session-stale' },
          revision: 9,
        },
        submission,
      ),
    ).toBe(false);
    expect(
      isHomeContainerTransportResultForSubmission(
        {
          kind: 'needSnapshot',
          owner: { ...submission.owner, sessionId: 'session-stale' },
          reason: 'ownerMismatch',
        },
        submission,
      ),
    ).toBe(false);
  });
});
