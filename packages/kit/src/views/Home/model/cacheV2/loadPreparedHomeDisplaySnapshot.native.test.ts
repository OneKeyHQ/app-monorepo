import {
  loadHomeDisplaySnapshotCritical,
  loadHomeDisplaySnapshotManifest,
  loadHomeDisplaySnapshotSourceRecords,
} from './homeDisplaySnapshotRepository.native';
import { loadPreparedHomeDisplaySnapshot } from './loadPreparedHomeDisplaySnapshot.native';

import type {
  IHomeDisplaySnapshotCritical,
  ILoadedHomeDisplaySnapshotManifest,
} from './homeDisplaySnapshotTypes';
import type { IHomeCachedSourceRecord } from '../store/homeStoreTypes';

jest.mock('./homeDisplaySnapshotRepository.native', () => ({
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
  mockLoadManifest.mockReturnValue(context);
  mockLoadSourceRecords.mockReturnValue([]);
});

describe('loadPreparedHomeDisplaySnapshot native', () => {
  it('synchronously restores a complete shell from a portfolio record', () => {
    const portfolioRecord = {
      confirmedAt: 1,
      coverageFingerprint: 'portfolio-a',
      dataSchemaVersion: 1,
      expiresAt: 2,
      payload: {
        payload: {
          accountTokensValue: '21.14',
          accountTokensWorthCurrency: 'USD',
        },
        section: {
          kind: 'ready',
          rowIds: ['eth'],
        },
      },
      quoteBasis: { currency: 'USD' },
      sourceId: 'portfolio',
      sourceKeyIdentity: 'portfolio-key',
    } satisfies IHomeCachedSourceRecord;
    const bannerRecord = {
      confirmedAt: 1,
      coverageFingerprint: 'banner-a',
      dataSchemaVersion: 1,
      expiresAt: 2,
      payload: {
        banners: [
          {
            _id: 'banner-a',
            button: '',
            closeForever: false,
            closeable: false,
            description: '',
            href: null,
            hrefType: null,
            icon: null,
            id: 'banner-a',
            mode: null,
            networkId: null,
            networkIds: [],
            payload: null,
            position: 'home',
            rank: 0,
            src: '',
            theme: 'light',
            title: '',
            useSystemBrowser: false,
          },
        ],
        isBotWalletReceiveBlocked: false,
        referralEligibility: null,
        tronResource: null,
      },
      quoteBasis: null,
      sourceId: 'banner',
      sourceKeyIdentity: 'banner-key',
    } satisfies IHomeCachedSourceRecord;
    mockLoadCritical.mockReturnValue({
      createdAt: 1,
      ownerScopeKey: 'owner-a',
      schemaVersion: 1,
      navigation: {
        kind: 'ready',
        selectedTabId: 'portfolio',
        tabs: ['portfolio'],
      },
    } satisfies IHomeDisplaySnapshotCritical);
    mockLoadSourceRecords.mockReturnValue([bannerRecord, portfolioRecord]);

    expect(
      loadPreparedHomeDisplaySnapshot({ ownerScopeKey: 'owner-a' }),
    ).toEqual({
      navigation: {
        kind: 'ready',
        selectedTabId: 'portfolio',
        tabs: ['portfolio'],
      },
      records: [bannerRecord, portfolioRecord],
      shell: {
        kind: 'portfolio',
        presentation: {
          actions: {
            items: ['send', 'receive', 'buySell', 'swap'],
            kind: 'funded',
          },
          banner: { kind: 'positive' },
          freshness: 'confirmedCache',
          header: {
            authority: 'confirmedCache',
            balance: { amount: '21.14', currency: 'USD' },
            kind: 'funded',
          },
          kind: 'funded',
          refresh: 'refreshing',
        },
      },
    });
  });

  it('rejects a navigation-only snapshot without portfolio data', () => {
    mockLoadCritical.mockReturnValue({
      createdAt: 1,
      ownerScopeKey: 'owner-a',
      schemaVersion: 1,
      navigation: {
        kind: 'ready',
        selectedTabId: 'portfolio',
        tabs: ['portfolio'],
      },
    } satisfies IHomeDisplaySnapshotCritical);

    expect(
      loadPreparedHomeDisplaySnapshot({ ownerScopeKey: 'owner-a' }),
    ).toBeUndefined();
  });
});
