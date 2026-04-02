import { ensureRunOnNative } from '@onekeyhq/shared/src/utils/assertUtils';

import { LocalDbRealm } from './realm/LocalDbRealm';

import type { LocalDbBase } from './LocalDbBase';

ensureRunOnNative();
const localDb: LocalDbBase = new LocalDbRealm();
export default localDb;
