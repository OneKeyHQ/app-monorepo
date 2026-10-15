import { ensureWorkerReady, workerApi } from './workerClient';

import type { IEnsureSDKReady, IZcashSdk } from '../types/sdk';

// App main/bg share a runtime on web/desktop; the wallet has its own Worker.
const ensureSDKReady: IEnsureSDKReady = async () => {
  await ensureWorkerReady();
  return true;
};

const sdk: IZcashSdk = {
  getZcashApi: async () => workerApi,
  ensureSDKReady,
};
export default sdk;
