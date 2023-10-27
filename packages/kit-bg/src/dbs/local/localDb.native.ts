import { LocalDbRealm } from './realm/LocalDbRealm';

import type { LocalDbBase } from './LocalDbBase';

const localDb: LocalDbBase = new LocalDbRealm();
export default localDb;
