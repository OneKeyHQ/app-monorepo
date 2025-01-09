import { ELocalDBStoreNames } from '../../localDBStoreNames';

import { RealmSchemaAccount } from './RealmSchemaAccount';
import { RealmSchemaAccountDerivation } from './RealmSchemaAccountDerivation';
import { RealmSchemaAddress } from './RealmSchemaAddress';
import { RealmSchemaConnectedSite } from './RealmSchemaConnectedSite';
import { RealmSchemaContext } from './RealmSchemaContext';
import { RealmSchemaCredential } from './RealmSchemaCredential';
import { RealmSchemaDevice } from './RealmSchemaDevice';
import { RealmSchemaIndexedAccount } from './RealmSchemaIndexedAccount';
import { RealmSchemaSignMessage } from './RealmSchemaSignMessage';
import { RealmSchemaSignTransaction } from './RealmSchemaSignTransaction';
import { RealmSchemaWallet } from './RealmSchemaWallet';

import type { RealmObjectBase } from '../base/RealmObjectBase';

export const realmDBSchemasMap: Record<
  ELocalDBStoreNames,
  typeof RealmObjectBase<any>
> = {
  [ELocalDBStoreNames.Account]: RealmSchemaAccount,
  [ELocalDBStoreNames.IndexedAccount]: RealmSchemaIndexedAccount,
  [ELocalDBStoreNames.Wallet]: RealmSchemaWallet,
  [ELocalDBStoreNames.Device]: RealmSchemaDevice,
  [ELocalDBStoreNames.Context]: RealmSchemaContext,
  [ELocalDBStoreNames.Credential]: RealmSchemaCredential,
  [ELocalDBStoreNames.AccountDerivation]: RealmSchemaAccountDerivation,
  [ELocalDBStoreNames.Address]: RealmSchemaAddress,
  [ELocalDBStoreNames.SignedMessage]: RealmSchemaSignMessage,
  [ELocalDBStoreNames.SignedTransaction]: RealmSchemaSignTransaction,
  [ELocalDBStoreNames.ConnectedSite]: RealmSchemaConnectedSite,
};
export const realmDBSchemas = Object.values(realmDBSchemasMap);
