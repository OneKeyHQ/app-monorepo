import { EV4LocalDBStoreNames } from '../../v4localDBStoreNames';

import { V4RealmSchemaAccount } from './V4RealmSchemaAccount';
import { V4RealmSchemaAccountDerivation } from './V4RealmSchemaAccountDerivation';
import { V4RealmSchemaContext } from './V4RealmSchemaContext';
import { V4RealmSchemaCredential } from './V4RealmSchemaCredential';
import { V4RealmSchemaDevice } from './V4RealmSchemaDevice';
import { V4RealmSchemaToken } from './V4RealmSchemaToken';
import { V4RealmSchemaWallet } from './V4RealmSchemaWallet';

import type { V4RealmObjectBase } from '../base/V4RealmObjectBase';

export const v4realmDBSchemasMap: Record<
  EV4LocalDBStoreNames,
  typeof V4RealmObjectBase<any>
> = {
  [EV4LocalDBStoreNames.Account]: V4RealmSchemaAccount,
  [EV4LocalDBStoreNames.Wallet]: V4RealmSchemaWallet,
  [EV4LocalDBStoreNames.Device]: V4RealmSchemaDevice,
  [EV4LocalDBStoreNames.Context]: V4RealmSchemaContext,
  [EV4LocalDBStoreNames.Credential]: V4RealmSchemaCredential,
  [EV4LocalDBStoreNames.AccountDerivation]: V4RealmSchemaAccountDerivation,
};
export const v4realmDBSchemas: (typeof V4RealmObjectBase<any>)[] =
  Object.values(v4realmDBSchemasMap);
export const v4realmDBSchemasExtra: (typeof V4RealmObjectBase<any>)[] = [
  V4RealmSchemaToken,
];

/*
- Property 'Account.tokens' has been removed.
- Property 'Context.pendingWallets' has been removed.
- Property 'Wallet.accounts' has been changed from 'set<Account>' to 'array<string>'.
- Property 'Wallet.associatedDevice' has been changed from '<Device>' to 'string'.", "name": "Error", 

"stack": "Access error.stack failed in native hermes engine: unable to serialize, circular reference is too complex to analyze"}

*/
