import {
  loadHomeDisplaySnapshotCritical,
  loadHomeDisplaySnapshotManifest,
  loadHomeDisplaySnapshotSourceRecords,
} from './homeDisplaySnapshotRepository';
import { loadPreparedHomeDisplaySnapshot } from './loadPreparedHomeDisplaySnapshot';

import type {
  IHomeDisplaySnapshotCritical,
  ILoadedHomeDisplaySnapshotManifest,
} from './homeDisplaySnapshotTypes';
import type { IHomeCachedSourceRecord } from '../store/homeStoreTypes';

jest.mock('./homeDisplaySnapshotRepository', () => ({
  loadHomeDisplaySnapshotCritical: jest.fn(),
  loadHomeDisplaySnapshotManifest: jest.fn(),
  loadHomeDisplaySnapshotSourceRecords: jest.fn(),
}));

const mockLoadManifest = jest.mocked(loadHomeDisplaySnapshotManifest);
const mockLoadCritical = jest.mocked(loadHomeDisplaySnapshotCritical);
const mockLoadSourceRecords = jest.mocked(loadHomeDisplaySnapshotSourceRecords);

const context = {} as ILoadedHomeDisplaySnapshotManifest;

beforeEach(() => {
  jest.clearAllMocks();
  mockLoadManifest.mockResolvedValue(context);
  mockLoadSourceRecords.mockResolvedValue([]);
});

describe('loadPreparedHomeDisplaySnapshot', () => {
  it('treats a missing or loading critical shell as a cache miss', async () => {
    mockLoadCritical.mockResolvedValueOnce(undefined);
    await expect(
      loadPreparedHomeDisplaySnapshot({ ownerScopeKey: 'owner-a' }),
    ).resolves.toBeUndefined();

    mockLoadCritical.mockResolvedValueOnce({
      createdAt: 1,
      ownerScopeKey: 'owner-a',
      schemaVersion: 1,
      shell: { kind: 'loading' },
    } satisfies IHomeDisplaySnapshotCritical);
    await expect(
      loadPreparedHomeDisplaySnapshot({ ownerScopeKey: 'owner-a' }),
    ).resolves.toBeUndefined();
    expect(mockLoadSourceRecords).not.toHaveBeenCalled();
  });

  it('loads the visible owner records only after a renderable shell hit', async () => {
    const critical = {
      createdAt: 1,
      ownerScopeKey: 'owner-b',
      schemaVersion: 1,
      shell: { kind: 'backupRequired', commandId: 'backupWallet' },
    } satisfies IHomeDisplaySnapshotCritical;
    mockLoadCritical.mockResolvedValue(critical);

    await expect(
      loadPreparedHomeDisplaySnapshot({ ownerScopeKey: 'owner-b' }),
    ).resolves.toEqual({
      navigation: undefined,
      records: [],
      shell: critical.shell,
    });
    expect(mockLoadSourceRecords).toHaveBeenCalledWith({
      context,
      sourceIds: ['banner', 'portfolio'],
    });
  });

  it('requires the selected portfolio section before accepting a cache hit', async () => {
    const critical = {
      createdAt: 1,
      ownerScopeKey: 'owner-c',
      schemaVersion: 1,
      shell: {
        kind: 'portfolio',
        presentation: {
          kind: 'zero',
          header: {
            kind: 'zero',
            balance: { amount: '0', currency: 'USD' },
          },
          actions: { kind: 'zero', items: [] },
          banner: { kind: 'none' },
        },
      },
    } satisfies IHomeDisplaySnapshotCritical;
    mockLoadCritical.mockResolvedValue(critical);

    await expect(
      loadPreparedHomeDisplaySnapshot({ ownerScopeKey: 'owner-c' }),
    ).resolves.toBeUndefined();

    const portfolioRecord = {
      sourceId: 'portfolio',
    } as IHomeCachedSourceRecord;
    mockLoadSourceRecords.mockResolvedValue([portfolioRecord]);
    await expect(
      loadPreparedHomeDisplaySnapshot({ ownerScopeKey: 'owner-c' }),
    ).resolves.toMatchObject({
      records: [portfolioRecord],
      shell: critical.shell,
    });
  });
});
