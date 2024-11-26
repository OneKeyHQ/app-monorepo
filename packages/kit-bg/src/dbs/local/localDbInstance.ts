import dbPerfMonitor from '@onekeyhq/shared/src/utils/debug/dbPerfMonitor';

import { LocalDbIndexed } from './indexed/LocalDbIndexed';

import type { LocalDbBase } from './LocalDbBase';

// TODO ensureBackgroundObject

const localDb: LocalDbBase = new LocalDbIndexed();

dbPerfMonitor.logIndexedDBCreateTx();
export default localDb;
