import { OneKeyLocalError } from '@onekeyhq/shared/src/errors/errors/localError';

import { getKeys, getRuntime, getRuntimeWasm } from './carrier';

import type { IZcashSdkApi } from '../types/sdk';

export const runRuntimeSelfTest: IZcashSdkApi['runRuntimeSelfTest'] = async ({
  stage,
  lightwalletdUrl,
}) => {
  switch (stage) {
    case 'worker':
      return { stage };
    case 'wasm':
      await getKeys();
      await getRuntimeWasm();
      return { stage };
    case 'storage': {
      const rt = await getRuntime();
      if (rt.storageRequiresWorkerRestart()) {
        throw new OneKeyLocalError('zcash worker: storage failed');
      }
      // Probe the production VFS without opening or migrating a wallet DB.
      await rt.diagDatabaseExists('onekey-zcash-runtime-self-test.db');
      return { stage };
    }
    case 'network': {
      if (!lightwalletdUrl) {
        throw new OneKeyLocalError('zcash self-test: no node to ask');
      }
      const rt = await getRuntimeWasm();
      const chainTip = await rt.chainTipAt(lightwalletdUrl);
      if (!Number.isSafeInteger(chainTip) || chainTip <= 0) {
        throw new OneKeyLocalError('zcash self-test: invalid chain tip');
      }
      return { stage, chainTip };
    }
    default:
      throw new OneKeyLocalError('zcash self-test: invalid stage');
  }
};
