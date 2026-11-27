import { EPrimeCloudSyncDataType } from '@onekeyhq/shared/src/consts/primeConsts';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import { RealmSchemaCloudSyncItem } from '../../dbs/local/realm/schemas/RealmSchemaCloudSyncItem';

import {
  isEqualNullableValue,
  matchesRecordFields,
} from './hardwareCloudSyncSession';

jest.mock('../../dbs/local/realm/base/RealmObjectBase', () => ({
  RealmObjectBase: jest.fn(),
}));

describe('hardwareCloudSyncRecordMatch', () => {
  test.each([
    [null, undefined, true],
    [undefined, null, true],
    [null, null, true],
    [undefined, undefined, true],
    ['', undefined, false],
    ['', null, false],
    [0, undefined, false],
    [0, null, false],
    [false, undefined, false],
    [false, null, false],
    ['same', 'same', true],
    [42, 42, true],
    ['a', 'b', false],
  ] as const)('isEqualNullableValue(%p, %p) === %s', (a, b, expected) => {
    expect(isEqualNullableValue(a, b)).toBe(expected);
  });

  test('matches all fields including future optional fields when null vs undefined', () => {
    const live: {
      id: string;
      data?: string | null;
      futureOptionalField?: string | null;
    } = {
      id: 'item-1',
      data: null,
      futureOptionalField: null,
    };
    const snapshot: {
      id: string;
      data?: string;
      futureOptionalField?: string;
    } = {
      id: 'item-1',
      data: undefined,
    };
    expect(matchesRecordFields(live, snapshot)).toBe(true);

    live.futureOptionalField = 'updated';
    expect(matchesRecordFields(live, snapshot)).toBe(false);
  });

  test('matches live RealmSchemaCloudSyncItem against its read projection', () => {
    const live: unknown = Reflect.construct(RealmSchemaCloudSyncItem, []);
    if (!(live instanceof RealmSchemaCloudSyncItem))
      throw new OneKeyLocalError('Missing Realm fixture');
    Object.assign(live, {
      id: 'realm-1',
      rawKey: 'raw-1',
      rawData: null,
      dataType: EPrimeCloudSyncDataType.Wallet,
      data: null,
      dataTime: null,
      isDeleted: false,
      pwdHash: 'hash-1',
      localSceneUpdated: true,
      serverUploaded: false,
      pendingPublicAccountDeletionAt: null,
      pendingPublicAccountDeletionHash: null,
    });
    const snapshot = live.record;
    expect(matchesRecordFields(live, snapshot)).toBe(true);
    expect(
      matchesRecordFields(live, snapshot, [
        'pwdHash',
        'data',
        'rawData',
        'dataTime',
      ]),
    ).toBe(true);

    Object.assign(live, { serverUploaded: true });
    expect(matchesRecordFields(live, snapshot)).toBe(false);
    expect(
      matchesRecordFields(live, snapshot, [
        'pwdHash',
        'data',
        'rawData',
        'dataTime',
      ]),
    ).toBe(true);
  });
});
