import { EVaultKeyringTypes } from '../types';

import { KeyringSoftwareBase } from './KeyringSoftwareBase';

export abstract class KeyringHdBase extends KeyringSoftwareBase {
  override keyringType: EVaultKeyringTypes = EVaultKeyringTypes.hd;
}
