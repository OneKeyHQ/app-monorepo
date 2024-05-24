import { ensureRunOnBackground } from '@onekeyhq/shared/src/utils/assertUtils';

// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import localDb from './localDbInstance';

if (process.env.NODE_ENV !== 'production') {
  global.$$localDb = localDb;
}

ensureRunOnBackground();

export default localDb;
