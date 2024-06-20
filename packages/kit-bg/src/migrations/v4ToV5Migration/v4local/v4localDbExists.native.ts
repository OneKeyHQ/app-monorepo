import Realm from 'realm';

import { V4_REALM_DB_NAME } from './v4localDBConsts';

export default async function v4localDbExists(): Promise<boolean> {
  try {
    return Realm.exists(V4_REALM_DB_NAME);
  } catch (error) {
    return false;
  }
}
