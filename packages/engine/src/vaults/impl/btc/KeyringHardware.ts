/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/require-await */
import { Provider } from '@onekeyfe/blockchain-libs/dist/provider/chains/btc/provider';
import OneKeyConnect from '@onekeyfe/js-sdk';

import { COINTYPE_BTC as COIN_TYPE } from '../../../constants';
import {
  NotImplemented,
  OneKeyHardwareError,
  OneKeyInternalError,
} from '../../../errors';
import * as OneKeyHardware from '../../../hardware';
import { AccountType, DBUTXOAccount } from '../../../types/account';
import { KeyringHardwareBase } from '../../keyring/KeyringHardwareBase';

import { getAccountDefaultByPurpose } from './utils';

import type {
  IPrepareHardwareAccountsParams,
  ISignCredentialOptions,
} from '../../types';
import type BTCVault from './Vault';
import type {
  SignedTx,
  UnsignedTx,
} from '@onekeyfe/blockchain-libs/dist/types/provider';

const DEFAULT_PURPOSE = 49;

export class KeyringHardware extends KeyringHardwareBase {
  async signTransaction(
    unsignedTx: UnsignedTx,
    options: ISignCredentialOptions,
  ): Promise<SignedTx> {
    const addresses = unsignedTx.inputs.map((output) => output.address);
    const utxos = await (this.vault as BTCVault).collectUTXOs();

    const signers: Record<string, string> = {};
    for (const utxo of utxos) {
      const { address, path } = utxo;
      if (addresses.includes(address)) {
        signers[address] = path;
      }
    }

    const provider = (await this.engine.providerManager.getProvider(
      this.networkId,
    )) as Provider;

    return provider.hardwareSignTransaction(unsignedTx, signers);
  }

  async signMessage(
    messages: any[],
    options: ISignCredentialOptions,
  ): Promise<string[]> {
    throw new NotImplemented();
  }

  override async prepareAccounts(
    params: IPrepareHardwareAccountsParams,
  ): Promise<Array<DBUTXOAccount>> {
    const { indexes, purpose, names } = params;
    const usedPurpose = purpose || DEFAULT_PURPOSE;
    const ignoreFirst = indexes[0] !== 0;
    const usedIndexes = [...(ignoreFirst ? [indexes[0] - 1] : []), ...indexes];
    const { namePrefix, addressEncoding } =
      getAccountDefaultByPurpose(usedPurpose);
    const provider = (await this.engine.providerManager.getProvider(
      this.networkId,
    )) as Provider;

    let response;
    try {
      response = await OneKeyConnect.getPublicKey({
        bundle: usedIndexes.map((index) => ({
          path: `m/${usedPurpose}'/${COIN_TYPE}'/${index}'`,
        })),
      });
    } catch (error: any) {
      console.error(error);
      throw new OneKeyHardwareError(error);
    }

    if (!response.success) {
      console.error(response.payload);
      throw new OneKeyHardwareError({
        code: response.payload.code,
        message: response.payload.error,
      });
    }

    if (response.payload.length !== usedIndexes.length) {
      throw new OneKeyInternalError('Unable to get publick key.');
    }

    const ret = [];
    let index = 0;
    for (const {
      serializedPath: path,
      xpub: legacyXPub,
      xpubSegwit,
    } of response.payload) {
      const xpub = xpubSegwit || legacyXPub;
      const firstAddressRelPath = '0/0';
      const { [firstAddressRelPath]: address } = provider.xpubToAddresses(
        xpub,
        [firstAddressRelPath],
      );
      const name =
        (names || [])[index] || `${namePrefix} #${usedIndexes[index] + 1}`;
      if (!ignoreFirst || index > 0) {
        ret.push({
          id: `${this.walletId}--${path}`,
          name,
          type: AccountType.UTXO,
          path,
          coinType: COIN_TYPE,
          xpub,
          address,
          addresses: { [firstAddressRelPath]: address },
        });
      }

      if (usedIndexes.length === 1) {
        // Only getting the first account, ignore balance checking.
        break;
      }

      const { txs } = (await provider.getAccount(
        { type: 'simple', xpub },
        addressEncoding,
      )) as { txs: number };
      if (txs > 0) {
        index += 1;
        // TODO: blockbook API rate limit.
        await new Promise((r) => setTimeout(r, 200));
      } else {
        break;
      }
    }
    return ret;
  }
}
