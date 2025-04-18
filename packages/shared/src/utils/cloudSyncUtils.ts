import { EPrimeCloudSyncDataType } from '../consts/primeConsts';

function canSyncWithoutServer(dataType: EPrimeCloudSyncDataType) {
  return dataType === EPrimeCloudSyncDataType.IndexedAccount;
}

export default {
  canSyncWithoutServer,
};
