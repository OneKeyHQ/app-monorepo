import {
  loadHomeDisplaySnapshotCritical,
  loadHomeDisplaySnapshotManifest,
  loadHomeDisplaySnapshotSourceRecords,
} from './homeDisplaySnapshotRepository.native';
import { loadPreparedHomeDisplaySnapshot } from './loadPreparedHomeDisplaySnapshot.native';
import { clearPreparedHomeDisplaySnapshotCache } from './preparedHomeDisplaySnapshotCache';

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
  clearPreparedHomeDisplaySnapshotCache();
  jest.clearAllMocks();
  mockLoadManifest.mockReturnValue(context);
  mockLoadSourceRecords.mockReturnValue([]);
});

describe('loadPreparedHomeDisplaySnapshot native', () => {
  it('reuses a decoded owner snapshot without reading storage again', () => {
    mockLoadCritical.mockReturnValue({
      createdAt: 1,
      ownerScopeKey: 'owner-hot',
      schemaVersion: 1,
      shell: { kind: 'backupRequired', commandId: 'backupWallet' },
    } satisfies IHomeDisplaySnapshotCritical);

    const first = loadPreparedHomeDisplaySnapshot({
      ownerScopeKey: 'owner-hot',
    });
    const second = loadPreparedHomeDisplaySnapshot({
      ownerScopeKey: 'owner-hot',
    });

    expect(second).toBe(first);
    expect(mockLoadManifest).toHaveBeenCalledTimes(1);
    expect(mockLoadCritical).toHaveBeenCalledTimes(1);
    expect(mockLoadSourceRecords).toHaveBeenCalledTimes(1);
  });

  it('synchronously restores a complete shell from a portfolio record', () => {
    const portfolioRecord = {
      confirmedAt: 1,
      coverageFingerprint: 'portfolio-a',
      dataSchemaVersion: 1,
      expiresAt: 2,
      payload: {
        payload: {
          accountTokensValue: '21.14',
          accountTokensValueAvailable: true,
          accountTokensValueComplete: true,
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
      context,
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

  it('keeps a cached banner visible for an authoritatively zero account', () => {
    mockLoadCritical.mockReturnValue({
      createdAt: 1,
      ownerScopeKey: 'owner-a',
      schemaVersion: 1,
    } satisfies IHomeDisplaySnapshotCritical);
    mockLoadSourceRecords.mockReturnValue([
      {
        confirmedAt: 1,
        coverageFingerprint: 'banner-a',
        dataSchemaVersion: 1,
        expiresAt: 2,
        payload: {
          banners: [],
          isBotWalletReceiveBlocked: false,
          referralEligibility: null,
          tronResource: {
            accountId: 'account-a',
            networkId: 'network-a',
          },
        },
        quoteBasis: null,
        sourceId: 'banner',
        sourceKeyIdentity: 'banner-key',
      },
      {
        confirmedAt: 1,
        coverageFingerprint: 'portfolio-a',
        dataSchemaVersion: 1,
        expiresAt: 2,
        payload: {
          payload: {
            accountTokensValue: '0',
            accountTokensValueAvailable: true,
            accountTokensValueComplete: true,
            accountTokensWorthCurrency: 'USD',
          },
          section: {
            kind: 'empty',
          },
        },
        quoteBasis: { currency: 'USD' },
        sourceId: 'portfolio',
        sourceKeyIdentity: 'portfolio-key',
      },
    ] satisfies IHomeCachedSourceRecord[]);

    expect(
      loadPreparedHomeDisplaySnapshot({ ownerScopeKey: 'owner-a' })?.shell,
    ).toMatchObject({
      kind: 'portfolio',
      presentation: {
        kind: 'zero',
        banner: { kind: 'positive' },
      },
    });
  });

  it('does not restore an unavailable aggregate as an authoritative zero', () => {
    mockLoadCritical.mockReturnValue({
      createdAt: 1,
      ownerScopeKey: 'owner-a',
      schemaVersion: 1,
    } satisfies IHomeDisplaySnapshotCritical);
    mockLoadSourceRecords.mockReturnValue([
      {
        confirmedAt: 1,
        coverageFingerprint: 'portfolio-partial',
        dataSchemaVersion: 1,
        expiresAt: 2,
        payload: {
          payload: {
            accountTokensValue: '0',
            accountTokensValueComplete: false,
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
      },
    ] satisfies IHomeCachedSourceRecord[]);

    expect(
      loadPreparedHomeDisplaySnapshot({ ownerScopeKey: 'owner-a' }),
    ).toBeUndefined();
  });

  it('uses the complete portfolio record instead of an older critical verdict', () => {
    mockLoadCritical.mockReturnValue({
      createdAt: 1,
      ownerScopeKey: 'owner-a',
      schemaVersion: 1,
      shell: {
        kind: 'portfolio',
        presentation: {
          kind: 'zero',
          header: {
            kind: 'zero',
            balance: { amount: '0', currency: 'USD' },
          },
          actions: { kind: 'zero', items: ['addMoney', 'receive', 'more'] },
          banner: { kind: 'none' },
          freshness: 'live',
          refresh: 'idle',
        },
      },
    } satisfies IHomeDisplaySnapshotCritical);
    mockLoadSourceRecords.mockReturnValue([
      {
        confirmedAt: 2,
        coverageFingerprint: 'portfolio-funded',
        dataSchemaVersion: 1,
        expiresAt: 3,
        payload: {
          payload: {
            accountTokensValue: '27',
            accountTokensValueAvailable: true,
            accountTokensValueComplete: true,
            accountTokensWorthCurrency: 'USD',
          },
          section: {
            kind: 'ready',
            rowIds: ['usdc'],
          },
        },
        quoteBasis: { currency: 'USD' },
        sourceId: 'portfolio',
        sourceKeyIdentity: 'portfolio-key',
      },
    ] satisfies IHomeCachedSourceRecord[]);

    expect(
      loadPreparedHomeDisplaySnapshot({ ownerScopeKey: 'owner-a' })?.shell,
    ).toMatchObject({
      kind: 'portfolio',
      presentation: {
        kind: 'funded',
        header: { balance: { amount: '27' } },
      },
    });
  });

  it('rejects a portfolio record whose total quality is unspecified', () => {
    mockLoadCritical.mockReturnValue({
      createdAt: 1,
      ownerScopeKey: 'owner-a',
      schemaVersion: 1,
      shell: {
        kind: 'portfolio',
        presentation: {
          kind: 'zero',
          header: {
            kind: 'zero',
            balance: { amount: '0', currency: 'USD' },
          },
          actions: { kind: 'zero', items: ['addMoney', 'receive', 'more'] },
          banner: { kind: 'none' },
        },
      },
    } satisfies IHomeDisplaySnapshotCritical);
    mockLoadSourceRecords.mockReturnValue([
      {
        confirmedAt: 1,
        coverageFingerprint: 'portfolio-legacy',
        dataSchemaVersion: 1,
        expiresAt: 2,
        payload: {
          payload: {
            accountTokensValue: '0',
            accountTokensWorthCurrency: 'USD',
          },
          section: { kind: 'empty' },
        },
        quoteBasis: { currency: 'USD' },
        sourceId: 'portfolio',
        sourceKeyIdentity: 'portfolio-key',
      },
    ] satisfies IHomeCachedSourceRecord[]);

    expect(
      loadPreparedHomeDisplaySnapshot({ ownerScopeKey: 'owner-a' }),
    ).toBeUndefined();
  });
});
