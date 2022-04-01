import {
  SignedTx,
  UnsignedTx,
} from '@onekeyfe/blockchain-libs/dist/types/provider';

import * as OneKeyHardware from '../../../hardware';
import { KeyringHardwareBase } from '../../keyring/KeyringHardwareBase';

export class KeyringHardware extends KeyringHardwareBase {
  async signTransaction(unsignedTx: UnsignedTx): Promise<SignedTx> {
    const path = await this.getAccountPath();
    const chainId = await this.getNetworkChainId();
    return OneKeyHardware.ethereumSignTransaction(path, chainId, unsignedTx);
  }
}
