import { ELocalDBStoreNames } from '../../localDBStoreNames';

import { RealmSchemaAccount } from './RealmSchemaAccount';
import { RealmSchemaAccountDerivation } from './RealmSchemaAccountDerivation';
import { RealmSchemaContext } from './RealmSchemaContext';
import { RealmSchemaCredential } from './RealmSchemaCredential';
import { RealmSchemaDevice } from './RealmSchemaDevice';
import { RealmSchemaWallet } from './RealmSchemaWallet';

import type { RealmObjectBase } from '../base/RealmObjectBase';

export const realmDBSchemasMap: Record<
  ELocalDBStoreNames,
  typeof RealmObjectBase<any>
> = {
  [ELocalDBStoreNames.Account]: RealmSchemaAccount,
  [ELocalDBStoreNames.Wallet]: RealmSchemaWallet,
  [ELocalDBStoreNames.Device]: RealmSchemaDevice,
  [ELocalDBStoreNames.Context]: RealmSchemaContext,
  [ELocalDBStoreNames.Credential]: RealmSchemaCredential,
  [ELocalDBStoreNames.AccountDerivation]: RealmSchemaAccountDerivation,
};
export const realmDBSchemas = Object.values(realmDBSchemasMap);
