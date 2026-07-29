import type { ISwapRecordsParams } from '@onekeyhq/shared/src/referralCode/type';

export type ISwapRecordsTab = 'undistributed' | 'total';

export type ISwapRecordQuery = Pick<
  ISwapRecordsParams,
  'timeRange' | 'startTime' | 'endTime' | 'inviteCode'
>;
