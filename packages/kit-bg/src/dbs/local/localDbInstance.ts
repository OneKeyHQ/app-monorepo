import { LocalDbIndexed } from './indexed/LocalDbIndexed';

import type { LocalDbBase } from './LocalDbBase';

// TODO ensureBackgroundObject

const localDb: LocalDbBase = new LocalDbIndexed();
if (process.env.NODE_ENV !== 'production') {
  global.$$localDb = localDb;
}
export default localDb;
