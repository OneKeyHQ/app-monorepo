import {
  type IFirmwareManifestCacheRecord,
  type ISimpleDbFirmwareManifestCacheData,
  SimpleDbEntityFirmwareManifestCache,
} from './SimpleDbEntityFirmwareManifestCache';

const DIGEST = 'a'.repeat(64);

const createRecord = (
  overrides: Partial<IFirmwareManifestCacheRecord> = {},
): IFirmwareManifestCacheRecord => ({
  key: 'stable:classic1s:firmware-v8:universal',
  catalogLineage: 'onekey-app-firmware-catalog-v1',
  channel: 'stable',
  catalogEpoch: 2,
  projectionDigest: DIGEST,
  sourceSelectionDigest: DIGEST,
  snapshotDigest: DIGEST,
  snapshotJson: '{"schemaVersion":1}',
  acceptedAt: 200,
  ...overrides,
});

const setupEntity = (initial?: ISimpleDbFirmwareManifestCacheData) => {
  const entity = new SimpleDbEntityFirmwareManifestCache();
  let store = initial;
  jest.spyOn(entity, 'getRawData').mockImplementation(async () => store);
  jest.spyOn(entity, 'setRawData').mockImplementation(async (builder) => {
    store =
      typeof builder === 'function'
        ? await builder(store)
        : (builder as ISimpleDbFirmwareManifestCacheData);
    return store;
  });
  return { entity, getStore: () => store };
};

describe('SimpleDbEntityFirmwareManifestCache', () => {
  it('records a monotonic rollback anchor per lineage and channel', async () => {
    const { entity } = setupEntity();
    const scope = {
      catalogLineage: 'onekey-app-firmware-catalog-v1',
      channel: 'stable' as const,
    };

    await expect(
      entity.observeCatalogEpoch({ ...scope, catalogEpoch: 2, acceptedAt: 20 }),
    ).resolves.toBe('accepted');
    await expect(
      entity.observeCatalogEpoch({ ...scope, catalogEpoch: 1, acceptedAt: 30 }),
    ).resolves.toBe('catalog_downgrade');
    await expect(entity.getHighestAccepted(scope)).resolves.toEqual({
      catalogEpoch: 2,
      acceptedAt: 20,
    });

    await expect(
      entity.observeCatalogEpoch({
        catalogLineage: scope.catalogLineage,
        channel: 'pre-release',
        catalogEpoch: 1,
      }),
    ).resolves.toBe('accepted');
  });

  it('rejects a last-good write below the observed epoch', async () => {
    const { entity } = setupEntity();
    await entity.observeCatalogEpoch({
      catalogLineage: 'onekey-app-firmware-catalog-v1',
      channel: 'stable',
      catalogEpoch: 3,
    });

    await expect(entity.saveLastGood(createRecord())).rejects.toThrow(
      'catalog epoch regression',
    );
    await expect(
      entity.getLastGood(createRecord().key),
    ).resolves.toBeUndefined();
  });

  it('stores last-good data and clears it without clearing rollback anchors', async () => {
    const { entity, getStore } = setupEntity();
    const record = createRecord();

    await entity.saveLastGood(record);
    await expect(entity.getLastGood(record.key)).resolves.toEqual(record);
    expect(getStore()?.highestAcceptedByScope).toEqual({
      [`${record.catalogLineage}\u0000${record.channel}`]: {
        catalogEpoch: record.catalogEpoch,
        acceptedAt: record.acceptedAt,
      },
    });

    await entity.clearLastGoodPreservingRollbackAnchors();
    await expect(entity.getLastGood(record.key)).resolves.toBeUndefined();
    expect(getStore()?.highestAcceptedByScope).toEqual({
      [`${record.catalogLineage}\u0000${record.channel}`]: {
        catalogEpoch: record.catalogEpoch,
        acceptedAt: record.acceptedAt,
      },
    });
  });

  it('does not enable an in-memory entity cache', () => {
    const { entity } = setupEntity();
    expect(entity.enableCache).toBe(false);
  });
});
