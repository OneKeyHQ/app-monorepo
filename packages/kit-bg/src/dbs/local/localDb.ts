import { ensureRunOnBackground } from '@onekeyhq/shared/src/utils/assertUtils';

import localDb from './localDbInstance';

if (process.env.NODE_ENV !== 'production') {
  global.$$localDb = localDb;
}

ensureRunOnBackground();

export default localDb;
