import { logIndexedDBCreateTx } from '@onekeyhq/shared/src/utils/debug/logIndexedDBCreateTx';

import { LocalDbIndexed } from './indexed/LocalDbIndexed';

import type { LocalDbBase } from './LocalDbBase';

// TODO ensureBackgroundObject

const localDb: LocalDbBase = new LocalDbIndexed();

logIndexedDBCreateTx();
export default localDb;
