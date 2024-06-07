import { ensureRunOnNative } from '@onekeyhq/shared/src/utils/assertUtils';

import { V4LocalDbRealm } from './v4realm/V4LocalDbRealm';

import type { V4LocalDbBase } from './V4LocalDbBase';

ensureRunOnNative();

const v4localDb: V4LocalDbBase = new V4LocalDbRealm();
export default v4localDb;
