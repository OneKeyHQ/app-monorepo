import { EVaultKeyringTypes } from '../types';

import { KeyringSoftwareBase } from './KeyringSoftwareBase';

export abstract class KeyringImportedBase extends KeyringSoftwareBase {
  override keyringType: EVaultKeyringTypes = EVaultKeyringTypes.imported;
}
