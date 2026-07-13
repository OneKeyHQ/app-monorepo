import { EPrimeCloudSyncDataType } from '../consts/primeConsts';

function canSyncWithoutServer(dataType: EPrimeCloudSyncDataType) {
  return dataType === EPrimeCloudSyncDataType.IndexedAccount;
}

function normalizeDataTime(dataTime: number | undefined): number | undefined {
  if (dataTime === undefined || !Number.isFinite(dataTime)) {
    return undefined;
  }
  return Math.floor(dataTime);
}

export default {
  canSyncWithoutServer,
  normalizeDataTime,
};
