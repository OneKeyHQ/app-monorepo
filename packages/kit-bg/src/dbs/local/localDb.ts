import { LocalDbIndexed } from './indexed/LocalDbIndexed';

import type { LocalDbBase } from './LocalDbBase';

// TODO ensureBackgroundObject

const localDb: LocalDbBase = new LocalDbIndexed();
export default localDb;
