import v4localDbInstance from './v4local/v4localDbInstance';
import { V4ReduxDb } from './v4redux/V4ReduxDb';
import { V4SimpleDb } from './v4simple/V4SimpleDb';

import type { V4LocalDbBase } from './v4local/V4LocalDbBase';

export class V4DbHubs {
  _v4simpleDb: V4SimpleDb | undefined;

  get v4simpleDb() {
    if (!this._v4simpleDb) {
      this._v4simpleDb = new V4SimpleDb();
    }
    return this._v4simpleDb;
  }

  _v4reduxDb: V4ReduxDb | undefined;

  get v4reduxDb() {
    if (!this._v4reduxDb) {
      this._v4reduxDb = new V4ReduxDb();
    }
    return this._v4reduxDb;
  }

  _v4localDb: V4LocalDbBase | undefined;

  get v4localDb() {
    if (!this._v4localDb) {
      this._v4localDb = v4localDbInstance;
    }
    return this._v4localDb;
  }
}

export default new V4DbHubs();
