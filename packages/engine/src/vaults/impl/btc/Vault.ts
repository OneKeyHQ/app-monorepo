/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/require-await */
import { BlockBook } from '@onekeyfe/blockchain-libs/dist/provider/chains/btc/blockbook';
import { Provider } from '@onekeyfe/blockchain-libs/dist/provider/chains/btc/provider';
import { decrypt } from '@onekeyfe/blockchain-libs/dist/secret/encryptors/aes256';
import {
  PartialTokenInfo,
  TxInput,
  UnsignedTx,
} from '@onekeyfe/blockchain-libs/dist/types/provider';
import BigNumber from 'bignumber.js';
import bs58check from 'bs58check';
// @ts-ignore
import coinSelect from 'coinselect';
// @ts-ignore
import coinSelectSplit from 'coinselect/split';

import { ExportedPrivateKeyCredential } from '../../../dbs/base';
import { NotImplemented, OneKeyInternalError } from '../../../errors';
import { DBUTXOAccount } from '../../../types/account';
import { TxStatus } from '../../../types/covalent';
import {
  IApproveInfo,
  IDecodedTx,
  IDecodedTxLegacy,
  IEncodedTx,
  IEncodedTxUpdateOptions,
  IFeeInfo,
  IFeeInfoUnit,
  ISignCredentialOptions,
  ITransferInfo,
} from '../../types';
import { VaultBase } from '../../VaultBase';
import { EVMDecodedItem, EVMDecodedTxType } from '../evm/decoder/types';

import { KeyringHardware } from './KeyringHardware';
import { KeyringHd } from './KeyringHd';
import { KeyringImported } from './KeyringImported';
import { KeyringWatching } from './KeyringWatching';
import settings from './settings';
import { getAccountDefaultByPurpose } from './utils';

type UTXO = {
  txid: string;
  vout: number;
  value: string;
  address: string;
  path: string;
};

type IEncodedTxBTC = {
  inputs: Array<UTXO>;
  outputs: Array<{ address: string; value: string }>;
  fee: string;
  transferInfo: ITransferInfo;
};

export default class Vault extends VaultBase {
  lastFeeRate?: { updatedAt: number; rates: Array<string> };

  cachedUTXOs?: { updatedAt: number; utxos: Array<UTXO> };

  private async getFeeRate(): Promise<Array<string>> {
    const now = Date.now();
    const { updatedAt, rates } = this.lastFeeRate ?? {
      updatedAt: 0,
      rates: [],
    };
    if (now - updatedAt <= 30 * 1000) {
      // 30 seconds cache.  TODO: may differ for different network?
      return rates;
    }
    const provider = (await this.engine.providerManager.getProvider(
      this.networkId,
    )) as Provider;
    const client = await provider.blockbook;
    const newRates = [];
    try {
      for (const blocks of [15, 10, 5]) {
        newRates.push(
          new BigNumber(await client.estimateFee(blocks)).toFixed(0),
        );
        // TODO: blockbook API rate limit.
        await new Promise((r) => setTimeout(r, 100));
      }
    } catch (e) {
      console.error(e);
      throw new OneKeyInternalError('Failed to get fee rates.');
    }
    this.lastFeeRate = { updatedAt: Date.now(), rates: newRates };
    return newRates;
  }

  async collectUTXOs(): Promise<Array<UTXO>> {
    const now = Date.now();
    const { updatedAt, utxos } = this.cachedUTXOs ?? {
      updatedAt: 0,
      utxos: [],
    };
    if (now - updatedAt <= 60 * 1000) {
      // One minute cache.  TODO: may differ for different network?
      return utxos;
    }

    const dbAccount = (await this.getDbAccount()) as DBUTXOAccount;
    const provider = (await this.engine.providerManager.getProvider(
      this.networkId,
    )) as Provider;
    const client = await provider.blockbook;
    let newUTXOs: Array<UTXO> = [];
    try {
      // TODO: use updated blockchain-libs API
      newUTXOs = await client.restful
        .get(`/api/v2/utxo/${dbAccount.xpub}`)
        .then((i) => i.json());
    } catch (e) {
      console.error(e);
      throw new OneKeyInternalError('Failed to get UTXOs of the account.');
    }
    this.cachedUTXOs = { updatedAt: Date.now(), utxos: newUTXOs };
    return newUTXOs;
  }

  settings = settings;

  keyringMap = {
    hd: KeyringHd,
    hw: KeyringHardware,
    imported: KeyringImported,
    watching: KeyringWatching,
  };

  attachFeeInfoToEncodedTx(params: {
    encodedTx: IEncodedTxBTC;
    feeInfoValue: IFeeInfoUnit;
  }): Promise<IEncodedTxBTC> {
    const feeRate = params.feeInfoValue.price;
    if (typeof feeRate === 'string') {
      return this.buildEncodedTxFromTransfer(
        params.encodedTx.transferInfo,
        feeRate,
      );
    }
    return Promise.resolve(params.encodedTx);
  }

  decodedTxToLegacy(decodedTx: IDecodedTx): Promise<IDecodedTxLegacy> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return Promise.resolve(decodedTx as any);
  }

  async decodeTx(encodedTx: IEncodedTxBTC, payload?: any): Promise<any> {
    const { inputs, outputs, fee } = encodedTx;
    const network = await this.engine.getNetwork(this.networkId);
    const dbAccount = (await this.getDbAccount()) as DBUTXOAccount;
    return {
      txType: EVMDecodedTxType.NATIVE_TRANSFER,
      symbol: network.symbol,
      amount: new BigNumber(outputs[0].value)
        .shiftedBy(-network.decimals)
        .toFixed(),
      value: outputs[0].value,
      network,
      fromAddress: dbAccount.address,
      toAddress: outputs[0].address,
      data: '',
      total: BigNumber.sum
        .apply(
          null,
          inputs.map(({ value }) => value),
        )
        .toFixed(),
    };
  }

  async buildEncodedTxFromTransfer(
    transferInfo: ITransferInfo,
    specifiedFeeRate?: string,
  ): Promise<IEncodedTxBTC> {
    const { to, amount, max } = transferInfo;
    const network = await this.engine.getNetwork(this.networkId);
    const dbAccount = (await this.getDbAccount()) as DBUTXOAccount;
    const utxos = await this.collectUTXOs();
    // const feeRate = '2';
    const feeRate = specifiedFeeRate || (await this.getFeeRate())[1];

    const {
      inputs,
      outputs,
      fee,
    }: {
      inputs: Array<{
        txId: string;
        vout: number;
        value: number;
        address: string;
        path: string;
      }>;
      outputs: Array<{ address: string; value: number }>;
      fee: number;
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    } = (max ? coinSelectSplit : coinSelect)(
      utxos.map(({ txid, vout, value, address, path }) => ({
        txId: txid,
        vout,
        value: parseInt(value),
        address,
        path,
      })),
      [
        max
          ? { address: to }
          : {
              address: to,
              value: parseInt(
                new BigNumber(amount).shiftedBy(network.decimals).toFixed(),
              ),
            },
      ],
      parseInt(feeRate),
    );
    if (!inputs || !outputs) {
      // TODO: balance not enough.
      throw new OneKeyInternalError('Failed to select UTXOs');
    }
    return {
      inputs: inputs.map(({ txId, value, ...keep }) => ({
        ...keep,
        txid: txId,
        value: value.toString(),
      })),
      outputs: outputs.map(({ value, address }) => ({
        address: address || dbAccount.address, // change amount
        value: value.toString(),
      })),
      fee: fee.toString(),
      transferInfo,
    };
  }

  buildEncodedTxFromApprove(approveInfo: IApproveInfo): Promise<any> {
    throw new NotImplemented();
  }

  updateEncodedTxTokenApprove(
    encodedTx: IEncodedTx,
    amount: string,
  ): Promise<IEncodedTx> {
    throw new NotImplemented();
  }

  updateEncodedTx(
    encodedTx: IEncodedTx,
    payload: any,
    options: IEncodedTxUpdateOptions,
  ): Promise<IEncodedTx> {
    throw new NotImplemented();
  }

  buildUnsignedTxFromEncodedTx(encodedTx: IEncodedTxBTC): Promise<UnsignedTx> {
    const { inputs, outputs } = encodedTx;

    const inputsInUnsignedTx: Array<TxInput> = [];
    for (const input of inputs) {
      const value = new BigNumber(input.value);
      inputsInUnsignedTx.push({
        address: input.address,
        value,
        utxo: { txid: input.txid, vout: input.vout, value },
      });
    }
    const outputsInUnsignedTx = outputs.map(({ address, value }) => ({
      address,
      value: new BigNumber(value),
    }));

    const ret = {
      inputs: inputsInUnsignedTx,
      outputs: outputsInUnsignedTx,
      payload: {},
    };
    return Promise.resolve(ret);
  }

  async fetchFeeInfo(encodedTx: IEncodedTxBTC): Promise<IFeeInfo> {
    const network = await this.engine.getNetwork(this.networkId);
    const { feeLimit } = await this.engine.providerManager.buildUnsignedTx(
      this.networkId,
      {
        ...(await this.buildUnsignedTxFromEncodedTx(encodedTx)),
        feePricePerUnit: new BigNumber(1),
      },
    );
    const prices = await this.getFeeRate();
    return {
      limit: (feeLimit ?? new BigNumber(0)).toFixed(),
      prices,
      symbol: 'sats',
      decimals: network.feeDecimals, // TODO: UI calculation incorrect?
      nativeSymbol: network.symbol,
      nativeDecimals: network.decimals,
      tx: null, // Must be null if network not support feeInTx
    };
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
      txs =
        (
          (await provider.getAccount({
            type: 'history',
            xpub: dbAccount.xpub,
          })) as { transactions: Array<any> }
        ).transactions ?? [];
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

  fetchTokenInfos(
    tokenAddresses: string[],
  ): Promise<Array<PartialTokenInfo | undefined>> {
    throw new NotImplemented();
  }
}
