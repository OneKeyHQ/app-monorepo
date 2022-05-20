/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/require-await */
import { BlockBook } from '@onekeyfe/blockchain-libs/dist/provider/chains/btc/blockbook';
import { Provider } from '@onekeyfe/blockchain-libs/dist/provider/chains/btc/provider';
import { decrypt } from '@onekeyfe/blockchain-libs/dist/secret/encryptors/aes256';
import { UnsignedTx } from '@onekeyfe/blockchain-libs/dist/types/provider';
import BigNumber from 'bignumber.js';
import bs58check from 'bs58check';

import { ExportedPrivateKeyCredential } from '../../../dbs/base';
import { NotImplemented, OneKeyInternalError } from '../../../errors';
import { DBUTXOAccount } from '../../../types/account';
import { TxStatus } from '../../../types/covalent';
import {
  IApproveInfo,
  IEncodedTxAny,
  IEncodedTxUpdateOptions,
  IFeeInfo,
  IFeeInfoUnit,
  ISignCredentialOptions,
  ITransferInfo,
} from '../../../types/vault';
import { VaultBase } from '../../VaultBase';
import { EVMDecodedItem } from '../evm/decoder/types';

import { KeyringHardware } from './KeyringHardware';
import { KeyringHd } from './KeyringHd';
import { KeyringImported } from './KeyringImported';
import { KeyringWatching } from './KeyringWatching';
import { getAccountDefaultByPurpose } from './utils';

export default class Vault extends VaultBase {
  keyringMap = {
    hd: KeyringHd,
    hw: KeyringHardware,
    imported: KeyringImported,
    watching: KeyringWatching,
  };

  simpleTransfer(
    payload: {
      to: string;
      value: string;
      tokenIdOnNetwork?: string;
      extra?: { [key: string]: any };
      gasPrice: string; // TODO remove gasPrice, gasLimit
      gasLimit: string;
    },
    options: ISignCredentialOptions,
  ): Promise<any> {
    throw new NotImplemented();
  }

  attachFeeInfoToEncodedTx(params: {
    encodedTx: any;
    feeInfoValue: IFeeInfoUnit;
  }): Promise<any> {
    throw new NotImplemented();
  }

  decodeTx(encodedTx: IEncodedTxAny, payload?: any): Promise<any> {
    throw new NotImplemented();
  }

  buildEncodedTxFromTransfer(transferInfo: ITransferInfo): Promise<any> {
    throw new NotImplemented();
  }

  buildEncodedTxFromApprove(approveInfo: IApproveInfo): Promise<any> {
    throw new NotImplemented();
  }

  updateEncodedTxTokenApprove(
    encodedTx: IEncodedTxAny,
    amount: string,
  ): Promise<IEncodedTxAny> {
    throw new NotImplemented();
  }

  updateEncodedTx(
    encodedTx: IEncodedTxAny,
    payload: any,
    options: IEncodedTxUpdateOptions,
  ): Promise<IEncodedTxAny> {
    throw new NotImplemented();
  }

  buildUnsignedTxFromEncodedTx(encodedTx: IEncodedTxAny): Promise<UnsignedTx> {
    throw new NotImplemented();
  }

  fetchFeeInfo(encodedTx: IEncodedTxAny): Promise<IFeeInfo> {
    throw new NotImplemented();
  }

  async getExportedCredential(password: string): Promise<string> {
    const dbAccount = (await this.getDbAccount()) as DBUTXOAccount;

    if (dbAccount.id.startsWith('hd-')) {
      const purpose = parseInt(dbAccount.path.split('/')[1]);
      const { addressEncoding } = getAccountDefaultByPurpose(purpose);
      const provider = (await this.engine.providerManager.getProvider(
        this.networkId,
      )) as Provider;
      const { network } = provider;
      const { private: xprvVersionBytes } =
        (network.segwitVersionBytes || {})[addressEncoding] || network.bip32;

      const keyring = this.keyring as KeyringHd;
      const [encryptedPrivateKey] = Object.values(
        await keyring.getPrivateKeys(password),
      );
      return bs58check.encode(
        bs58check
          .decode(dbAccount.xpub)
          .fill(
            Buffer.from(xprvVersionBytes.toString(16).padStart(8, '0'), 'hex'),
            0,
            4,
          )
          .fill(
            Buffer.concat([
              Buffer.from([0]),
              decrypt(password, encryptedPrivateKey),
            ]),
            45,
            78,
          ),
      );
    }
    if (dbAccount.id.startsWith('imported-')) {
      // Imported accounts, crendetial is already xprv
      const { privateKey } = (await this.engine.dbApi.getCredential(
        this.accountId,
        password,
      )) as ExportedPrivateKeyCredential;
      if (typeof privateKey === 'undefined') {
        throw new OneKeyInternalError('Unable to get credential.');
      }
      return bs58check.encode(decrypt(password, privateKey));
    }
    throw new OneKeyInternalError(
      'Only credential of HD or imported accounts can be exported',
    );
  }

  // TODO: BTC history type
  async getHistory(): Promise<Array<EVMDecodedItem>> {
    const dbAccount = (await this.getDbAccount()) as DBUTXOAccount;
    const provider = (await this.engine.providerManager.getProvider(
      this.networkId,
    )) as Provider;

    const ret = [];
    let txs;
    try {
      txs = (
        (await provider.getAccount({
          type: 'history',
          xpub: dbAccount.xpub,
        })) as { transactions: Array<any> }
      ).transactions;
    } catch (e) {
      console.error(e);
      txs = [];
    }

    const network = await this.engine.getNetwork(this.networkId);

    for (const tx of txs) {
      try {
        const item = {} as EVMDecodedItem;
        item.symbol = network.symbol;
        item.network = network;
        item.chainId = 0;
        item.txStatus = TxStatus.Confirmed;
        item.info = null;

        const { value, valueIn, fees } = tx as {
          value: string;
          valueIn: string;
          fees: string;
        };
        item.amount = new BigNumber(value)
          .shiftedBy(-network.decimals)
          .toFixed();
        item.value = value;
        item.total = new BigNumber(valueIn).toFixed();

        item.txHash = (tx as { txid: string }).txid;
        item.blockSignedAt = (tx as { blockTime: number }).blockTime * 1000;
        item.data = (tx as { hex: string }).hex;

        const txSize = item.data.length / 2;
        const gasPrice = new BigNumber(fees).div(txSize).toFixed();

        item.gasInfo = {
          gasLimit: txSize,
          gasPrice,
          maxPriorityFeePerGas: '0',
          maxFeePerGas: '0',
          maxPriorityFeePerGasInGwei: '0',
          maxFeePerGasInGwei: '0',
          maxFeeSpend: '0',
          feeSpend: new BigNumber(fees).shiftedBy(-network.decimals).toFixed(),
          gasUsed: txSize,
          gasUsedRatio: 1,
          effectiveGasPrice: gasPrice,
          effectiveGasPriceInGwei: gasPrice,
        };

        const isSend = (tx as { vin: Array<{ isOwn: boolean }> }).vin.some(
          ({ isOwn }) => isOwn,
        );

        if (isSend) {
          item.fromType = 'OUT';
          [item.toAddress] = (
            tx as { vout: Array<{ addresses: Array<string> }> }
          ).vout[0].addresses;
          for (const input of (tx as { vin: Array<any> }).vin) {
            const { isOwn, addresses } = input as {
              isOwn: boolean;
              addresses: Array<string>;
            };
            if (isOwn) {
              [item.fromAddress] = addresses;
              break;
            }
          }
        } else {
          item.fromType = 'IN';
          [item.fromAddress] = (
            tx as { vin: Array<{ addresses: Array<string> }> }
          ).vin[0].addresses;
          for (const output of (tx as { vout: Array<any> }).vout) {
            const { isOwn, addresses } = output as {
              isOwn: boolean;
              addresses: Array<string>;
            };
            if (isOwn) {
              [item.toAddress] = addresses;
              break;
            }
          }
        }

        ret.push(item);
      } catch (e) {
        console.error(e);
      }
    }

    return ret;
  }

  // Chain only functionalities below.

  createClientFromURL(url: string): BlockBook {
    return new BlockBook(url);
  }
}
