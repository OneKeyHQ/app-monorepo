import { decrypt } from '@onekeyhq/engine/src/secret/encryptors/aes256';
import { COINTYPE_XMR as COIN_TYPE } from '@onekeyhq/shared/src/engine/engineConsts';

import { OneKeyInternalError } from '../../../errors';
import { AccountType } from '../../../types/account';
import { KeyringImportedBase } from '../../keyring/KeyringImportedBase';

import { getMoneroApi } from './sdk';
import { MoneroNetTypeEnum } from './sdk/moneroUtil/moneroUtilTypes';

import type { DBVariantAccount } from '../../../types/account';
import type { SignedTx } from '../../../types/provider';
import type {
  IPrepareImportedAccountsParams,
  ISignCredentialOptions,
  IUnsignedTxPro,
} from '../../types';
import type { IClientApi, IEncodedTxXmr, ISendFundsArgs } from './types';

// @ts-ignore
export class KeyringImported extends KeyringImportedBase {
  override async prepareAccounts(
    params: IPrepareImportedAccountsParams,
  ): Promise<Array<DBVariantAccount>> {
    const { name, privateKey } = params;
    const network = await this.getNetwork();

    const moneroApi = await getMoneroApi();

    const { publicSpendKey, publicViewKey } =
      await moneroApi.getKeyPairFromRawPrivatekey({
        rawPrivateKey: privateKey,
        isPrivateSpendKey: true,
      });

    if (!publicSpendKey || !publicViewKey) {
      throw new OneKeyInternalError('Unable to get public spend/view key.');
    }

    const address = moneroApi.pubKeysToAddress(
      network.isTestnet ? MoneroNetTypeEnum.TestNet : MoneroNetTypeEnum.MainNet,
      false,
      publicSpendKey,
      publicViewKey,
    );

    return Promise.resolve([
      {
        id: `imported--${COIN_TYPE}--${address}`,
        name: name || '',
        type: AccountType.VARIANT,
        path: '',
        coinType: COIN_TYPE,
        pub: `${Buffer.from(publicSpendKey).toString('hex')},${Buffer.from(
          publicViewKey,
        ).toString('hex')}`,
        address,
        addresses: { [this.networkId]: address },
      },
    ]);
  }

  override async signTransaction(
    unsignedTx: IUnsignedTxPro,
    options: ISignCredentialOptions,
  ): Promise<SignedTx> {
    const { password } = options;
    const moneroApi = await getMoneroApi();
    const clientApi = await this.getClientApi<IClientApi>();

    const [privateKey] = Object.values(
      await this.getPrivateKeys(password || ''),
    );

    const rawPrivateKey = decrypt(password || '', privateKey);

    const { publicSpendKey, privateViewKey, privateSpendKey } =
      await moneroApi.getKeyPairFromRawPrivatekey({
        rawPrivateKey,
        isPrivateSpendKey: true,
      });

    const encodedTx = unsignedTx.encodedTx as IEncodedTxXmr;

    let destinations = [...encodedTx.destinations];

    if (encodedTx.shouldSweep) {
      destinations = destinations.map((destination) => ({
        to_address: destination.to_address,
        send_amount: '0',
      }));
    }

    const sendFundsArgs: ISendFundsArgs = {
      destinations,
      from_address_string: encodedTx.address,
      is_sweeping: encodedTx.shouldSweep,
      nettype: encodedTx.nettype,
      priority: encodedTx.priority,

      pub_spendKey_string: Buffer.from(publicSpendKey || []).toString('hex'),
      sec_spendKey_string: Buffer.from(privateSpendKey).toString('hex'),
      sec_viewKey_string: Buffer.from(privateViewKey || []).toString('hex'),

      fromWallet_didFailToBoot: false,
      fromWallet_didFailToInitialize: false,
      fromWallet_needsImport: false,
      hasPickedAContact: false,
      manuallyEnteredPaymentID: '',
      manuallyEnteredPaymentID_fieldIsVisible: false,
      requireAuthentication: false,
      resolvedAddress: '',
      resolvedAddress_fieldIsVisible: false,
      resolvedPaymentID: '',
      resolvedPaymentID_fieldIsVisible: false,
    };
    const signedTx = await moneroApi.sendFunds(
      sendFundsArgs,
      clientApi.mymonero,
    );
    return signedTx;
  }
}
