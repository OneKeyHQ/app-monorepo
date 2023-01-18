// @ts-ignore
import sdk from 'js-conflux-sdk/src/index.js';

export type {
  Contract as ISdkCfxContract,
  Transaction as ISdkCfxTransaction,
  Conflux as ISdkConflux,
} from 'js-conflux-sdk/dist/types/index';

export default sdk as typeof import('js-conflux-sdk');
