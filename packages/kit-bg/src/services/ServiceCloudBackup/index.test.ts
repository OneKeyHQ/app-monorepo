import { filterWillRemoveBackupList } from './utils/BackupTimeStrategyUtils';

import { subHours, subMonths, subWeeks } from 'date-fns';

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
