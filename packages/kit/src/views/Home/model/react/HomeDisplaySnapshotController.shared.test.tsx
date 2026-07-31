import { type ReactTestRenderer, act, create } from 'react-test-renderer';

import {
  loadHomeDisplaySnapshotManifest,
  loadHomeDisplaySnapshotSourceRecords,
} from '../cache/homeDisplaySnapshotRepository';
import {
  HOME_DISPLAY_SNAPSHOT_SCHEMA_VERSION,
  type IHomeDisplaySnapshotChunkDescriptor,
  type IHomeDisplaySnapshotChunkId,
  type ILoadedHomeDisplaySnapshotManifest,
} from '../cache/homeDisplaySnapshotTypes';
import { prepareHomeDisplaySnapshot } from '../cache/homeStartupPreparedDisplaySnapshot';

import { HomeDisplaySnapshotControllerShared } from './HomeDisplaySnapshotController.shared';

const mockOwnerToken = {
  scopeKey: 'owner-a',
  sessionId: 'session-a',
};
let mockLoadState:
  | { status: 'idle' }
  | {
      ownerScopeKey: string;
      sessionId: string;
      status: 'hit' | 'loading' | 'miss';
    } = { status: 'idle' };
const mockHydrateHomeDisplaySnapshot = jest.fn();
const mockUnsubscribe = jest.fn();
const mockFlushNow = jest.fn(() => Promise.resolve());
const mockFlushAndCompact = jest.fn(() => Promise.resolve());
const mockStore = {
  get: jest.fn((atom: string) =>
    atom === 'home-display-load-state' ? mockLoadState : {},
  ),
  set: jest.fn((atom: string, value: typeof mockLoadState) => {
    if (atom === 'home-display-load-state') {
      mockLoadState = value;
    }
  }),
  sub: jest.fn(() => mockUnsubscribe),
};
const mockTestGlobal = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};

jest.mock('@onekeyhq/kit/src/states/jotai/contexts/home', () => ({
  useHomeContextStore: () => mockStore,
  useHomeSessionState: () => ({ ownerToken: mockOwnerToken }),
}));

jest.mock('@onekeyhq/kit/src/states/jotai/contexts/home/actions', () => ({
  readHomeStoreState: () => ({
    interaction: {},
    session: { ownerToken: mockOwnerToken },
  }),
}));

jest.mock('@onekeyhq/kit/src/states/jotai/contexts/home/atoms', () => ({
  homeCommitIdentityState: {
    atom: () => 'home-commit-identity',
  },
  homeDisplaySnapshotLoadState: {
    atom: () => 'home-display-load-state',
  },
}));

jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    wallet: {
      homeUi: {
        homeDisplaySnapshotCache: jest.fn(),
      },
    },
  },
}));

jest.mock('@onekeyhq/shared/src/performance/mark', () => ({
  perfMark: jest.fn(),
}));

jest.mock('@onekeyhq/shared/src/storage/coldStartFlushTrigger', () => ({
  registerColdStartFlushTrigger: jest.fn(() => jest.fn()),
}));

jest.mock('../cache/homeDisplaySnapshotKeys', () => ({
  getHomeDisplaySnapshotPartitionTag: () => 'partition-a',
}));

jest.mock('../cache/homeDisplaySnapshotPersistQueueLoader', () => ({
  enqueueHomeDisplaySnapshotPersistJob: jest.fn(),
  flushAndCompactHomeDisplaySnapshotPersistQueue: () => mockFlushAndCompact(),
  flushHomeDisplaySnapshotPersistQueue: () => mockFlushNow(),
}));

jest.mock('../cache/homeDisplaySnapshotRepository', () => ({
  loadHomeDisplaySnapshotManifest: jest.fn(),
  loadHomeDisplaySnapshotSourceRecords: jest.fn(),
}));

jest.mock('../cache/homeStartupPreparedDisplaySnapshot', () => ({
  prepareHomeDisplaySnapshot: jest.fn(),
}));

jest.mock('./useHomeStoreControllerActions', () => ({
  useHomeStoreControllerActions: () => ({
    hydrateHomeDisplaySnapshot: mockHydrateHomeDisplaySnapshot,
  }),
}));

const mockLoadHomeDisplaySnapshotManifest = jest.mocked(
  loadHomeDisplaySnapshotManifest,
);
const mockLoadHomeDisplaySnapshotSourceRecords = jest.mocked(
  loadHomeDisplaySnapshotSourceRecords,
);
const mockPrepareHomeDisplaySnapshot = jest.mocked(prepareHomeDisplaySnapshot);

function createChunkDescriptor(
  chunkId: IHomeDisplaySnapshotChunkId,
): IHomeDisplaySnapshotChunkDescriptor {
  return {
    byteLength: 1,
    chunkId,
    contentSignature: `signature-${chunkId}`,
    key: `chunk-${chunkId}`,
    updatedAt: 1,
  };
}

function createManifestContext(): ILoadedHomeDisplaySnapshotManifest {
  return {
    manifest: {
      chunks: {
        banner: createChunkDescriptor('banner'),
        defi: createChunkDescriptor('defi'),
        history: createChunkDescriptor('history'),
        nft: createChunkDescriptor('nft'),
        perps: createChunkDescriptor('perps'),
        portfolio: createChunkDescriptor('portfolio'),
      },
      createdAt: 1,
      generation: 1,
      ownerScopeKey: mockOwnerToken.scopeKey,
      partitionId: 'partition-a',
      schemaVersion: HOME_DISPLAY_SNAPSHOT_SCHEMA_VERSION,
    },
    route: {
      currentGeneration: 1,
      ownerScopeKey: mockOwnerToken.scopeKey,
      partitionId: 'partition-a',
      schemaVersion: HOME_DISPLAY_SNAPSHOT_SCHEMA_VERSION,
      updatedAt: 1,
    },
    routeRaw: 'route-a',
  };
}

beforeAll(() => {
  mockTestGlobal.IS_REACT_ACT_ENVIRONMENT = true;
});

afterAll(() => {
  delete mockTestGlobal.IS_REACT_ACT_ENVIRONMENT;
});

describe('HomeDisplaySnapshotController cache warming', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLoadState = { status: 'idle' };
    mockPrepareHomeDisplaySnapshot.mockReturnValue({
      kind: 'ready',
      result: {
        displaySnapshot: {
          records: [],
        },
        ownerScopeKey: mockOwnerToken.scopeKey,
      },
    });
    mockLoadHomeDisplaySnapshotManifest.mockResolvedValue(
      createManifestContext(),
    );
    mockLoadHomeDisplaySnapshotSourceRecords.mockResolvedValue([]);
  });

  it('hydrates the prepared display before warming background source chunks', async () => {
    let view!: ReactTestRenderer;
    await act(async () => {
      view = create(<HomeDisplaySnapshotControllerShared />);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockHydrateHomeDisplaySnapshot).toHaveBeenCalledWith({
      ownerScopeKey: mockOwnerToken.scopeKey,
      records: [],
      sessionId: mockOwnerToken.sessionId,
    });
    expect(
      mockHydrateHomeDisplaySnapshot.mock.invocationCallOrder[0],
    ).toBeLessThan(
      mockLoadHomeDisplaySnapshotManifest.mock.invocationCallOrder[0],
    );

    const warmedSourceIds = mockLoadHomeDisplaySnapshotSourceRecords.mock.calls
      .flatMap(([params]) => params.sourceIds)
      .toSorted();
    expect(warmedSourceIds).toEqual(['defi', 'history', 'nft', 'perps']);

    act(() => view.unmount());
    expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
    expect(mockFlushNow).toHaveBeenCalledTimes(1);
  });
});
