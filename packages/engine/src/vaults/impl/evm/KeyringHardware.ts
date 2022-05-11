/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  SignedTx,
  UnsignedTx,
} from '@onekeyfe/blockchain-libs/dist/types/provider';

import * as OneKeyHardware from '../../../hardware';
import { ISignCredentialOptions } from '../../../types/vault';
import { KeyringHardwareBase } from '../../keyring/KeyringHardwareBase';

import type { IUnsignedMessageEvm } from './Vault';

export class KeyringHardware extends KeyringHardwareBase {
  async signTransaction(unsignedTx: UnsignedTx): Promise<SignedTx> {
    const path = await this.getAccountPath();
    const chainId = await this.getNetworkChainId();
    return OneKeyHardware.ethereumSignTransaction(path, chainId, unsignedTx);
  }

  async signMessage(
    messages: IUnsignedMessageEvm[],
    options: ISignCredentialOptions,
  ): Promise<string[]> {
    const path = await this.getAccountPath();
    return Promise.all(
      messages.map((message) =>
        OneKeyHardware.ethereumSignMessage({
          path,
          message,
        }),
      ),
    );
  }
}
