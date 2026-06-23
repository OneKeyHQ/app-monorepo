import { buildLegacyCredentialsForCloudBackup } from '.';

import { subHours, subMonths, subWeeks } from 'date-fns';

import {
  decryptImportedCredentialWithMetadata,
  decryptRevealableSeedWithMetadata,
  encodePasswordAsync,
  encryptImportedCredential,
  encryptRevealableSeed,
} from '@onekeyhq/core/src/secret';

import { filterWillRemoveBackupList } from './utils/BackupUtils';

import type { IMetaDataObject } from './types';

const baseTime = new Date().getTime();

const metaDataList = [
  {
    backupTime: subHours(baseTime, 2).getTime(),
  },
  {
    backupTime: subWeeks(subHours(baseTime, 1), 1).getTime(),
  },
  {
    backupTime: subWeeks(subHours(baseTime, 5), 3).getTime(),
  },
  {
    backupTime: subWeeks(subHours(baseTime, 1), 3).getTime(),
  },
  {
    backupTime: subWeeks(subHours(baseTime, 4), 3).getTime(),
  },
  {
    backupTime: subWeeks(subHours(baseTime, 5), 10).getTime(),
  },
  {
    backupTime: subWeeks(subHours(baseTime, 6), 10).getTime(),
  },
  {
    backupTime: subMonths(subHours(baseTime, 4), 12).getTime(),
  },
  {
    backupTime: subMonths(baseTime, 26).getTime(),
  },
  {
    isManualBackup: true,
    backupTime: subMonths(baseTime, 30).getTime(),
  },
].map((x, i) => ({
  ...x,
  filename: `${i}`,
}));

const willRemoveList = metaDataList.filter(
  (x) =>
    ['2', '4', '6', '8'].findIndex((filename) => x.filename === filename) !==
    -1,
);

describe('filterWillRemoveBackupList', () => {
  it('should calculate willRemoveBackupList correctly', async () => {
    expect(
      filterWillRemoveBackupList(metaDataList as IMetaDataObject[]),
    ).toEqual(willRemoveList);
  });
});

describe('ServiceCloudBackup portable credentials', () => {
  it('filters non-portable credentials before building portable backup payloads', async () => {
    await expect(
      buildLegacyCredentialsForCloudBackup({
        credentials: {
          'hd-1': '|LSE1|{"keyRef":"indexeddb:key"}',
        },
        password: 'test-password',
      }),
    ).resolves.toEqual({});
    await expect(
      buildLegacyCredentialsForCloudBackup({
        credentials: {
          'hyperliquid-agent--0x1--main':
            '|HLP|{"privateKey":"plain","userAddress":"0x1"}',
        },
        password: 'test-password',
      }),
    ).resolves.toEqual({});
  });

  it('builds legacy backup credentials from portable local credentials', async () => {
    const password = await encodePasswordAsync({ password: 'test-password' });
    const revealableSeed = {
      entropyWithLangPrefixed: 'english:00010203',
      seed: 'seed-hex',
    };
    const importedCredential = { privateKey: 'private-key-hex' };
    const credentials = {
      'hd-1': await encryptRevealableSeed({
        password,
        rs: revealableSeed,
      }),
      'imported--60--public-key': await encryptImportedCredential({
        password,
        credential: importedCredential,
      }),
    };

    const result = await buildLegacyCredentialsForCloudBackup({
      credentials,
      password,
    });

    expect(result['hd-1']).toMatch(/^\|RP\|/);
    expect(result['imported--60--public-key']).toMatch(/^\|PK\|/);
    expect(result['hd-1']).not.toBe(credentials['hd-1']);
    expect(result['imported--60--public-key']).not.toBe(
      credentials['imported--60--public-key'],
    );
    await expect(
      decryptRevealableSeedWithMetadata({
        password,
        rs: result['hd-1'],
      }),
    ).resolves.toMatchObject({ plaintext: revealableSeed });
    await expect(
      decryptImportedCredentialWithMetadata({
        password,
        credential: result['imported--60--public-key'],
      }),
    ).resolves.toMatchObject({ plaintext: importedCredential });
  });
});
