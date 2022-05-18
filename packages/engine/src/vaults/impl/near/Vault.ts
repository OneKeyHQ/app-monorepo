/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/require-await, camelcase, @typescript-eslint/naming-convention */
import {
  NearCli,
  Provider as NearProvider,
} from '@onekeyfe/blockchain-libs/dist/provider/chains/near';
import { UnsignedTx } from '@onekeyfe/blockchain-libs/dist/types/provider';
import BigNumber from 'bignumber.js';

import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import { NotImplemented } from '../../../errors';
import { fillUnsignedTx } from '../../../proxy';
import { DBAccount, DBVariantAccount } from '../../../types/account';
import { TxStatus } from '../../../types/covalent';
import {
  IApproveInfo,
  IDecodedTx,
  IEncodedTxAny,
  IEncodedTxUpdateOptions,
  IEncodedTxUpdatePayloadTransfer,
  IFeeInfo,
  IFeeInfoUnit,
  ISignCredentialOptions,
  ITransferInfo,
} from '../../../types/vault';
import { VaultBase } from '../../VaultBase';
import { EVMDecodedItem, EVMDecodedTxType } from '../evm/decoder/types';

import { KeyringHardware } from './KeyringHardware';
import { KeyringHd } from './KeyringHd';
import { KeyringImported } from './KeyringImported';
import { KeyringWatching } from './KeyringWatching';
import {
  BN,
  FT_TRANSFER_DEPOSIT,
  FT_TRANSFER_GAS,
  baseDecode,
  baseEncode,
  deserializeTransaction,
  nearApiJs,
  serializeTransaction,
} from './utils';

// TODO extends evm/Vault
export default class Vault extends VaultBase {
  keyringMap = {
    hd: KeyringHd,
    hw: KeyringHardware,
    imported: KeyringImported,
    watching: KeyringWatching,
  };

  async _getNearCli(): Promise<NearCli> {
    const nearProvider = (await this.engine.providerManager.getProvider(
      this.networkId,
    )) as NearProvider;
    const nearCli = await nearProvider.nearCli;
    return nearCli;
  }

  async _getPublicKey(pub: string) {
    const verifier = this.engine.providerManager.getVerifier(
      this.networkId,
      pub,
    );
    const pubKeyBuffer = await verifier.getPubkey(true);

    return pubKeyBuffer;
    // pubkeyToAddress
    // if (encoding === 'ENCODED_PUBKEY') {
    //   return 'ed25519:' + baseEncode(pubKeyBuffer);
    // } else {
    //   return pubKeyBuffer.toString('hex');
    // }
  }

  attachFeeInfoToEncodedTx(params: {
    encodedTx: any;
    feeInfoValue: IFeeInfoUnit;
  }): Promise<any> {
    return Promise.resolve(params.encodedTx);
  }

  async decodeTx(encodedTx: IEncodedTxAny, payload?: any): Promise<IDecodedTx> {
    const nativeTx = (await this.helper.parseToNativeTx(
      encodedTx,
    )) as nearApiJs.transactions.Transaction;
    const network = await this.getNetwork();
    const firstAction = nativeTx.actions[0];
    let actionInfo = null;
    let txType = EVMDecodedTxType.NATIVE_TRANSFER;

    if (firstAction.enum === 'transfer') {
      txType = EVMDecodedTxType.NATIVE_TRANSFER;
      actionInfo = firstAction.transfer;
    }
    const valueOnChain = (
      actionInfo as nearApiJs.transactions.Transfer
    ).deposit.toString();
    const value = new BigNumber(valueOnChain)
      .shiftedBy(network.decimals * -1)
      .toFixed();
    const decodedTx: EVMDecodedItem = {
      txType,
      blockSignedAt: 0,
      fromType: 'OUT',
      txStatus: TxStatus.Pending,
      mainSource: 'raw',

      symbol: network.symbol,
      amount: value,
      value: valueOnChain,
      network,

      fromAddress: nativeTx.signerId,
      toAddress: nativeTx.receiverId,
      nonce: parseFloat(nativeTx.nonce.toString()),
      txHash: baseEncode(nativeTx.blockHash),

      gasInfo: {
        gasLimit: 0,
        gasPrice: '0',
        maxFeePerGas: '0',
        maxPriorityFeePerGas: '0',
        maxPriorityFeePerGasInGwei: '0',
        maxFeePerGasInGwei: '0',
        maxFeeSpend: '0',
        feeSpend: '0',
        gasUsed: 0,
        gasUsedRatio: 0,
        effectiveGasPrice: '0',
        effectiveGasPriceInGwei: '0',
      },

      data: '',
      chainId: 0,

      total: '0',

      info: null,
    };
    return decodedTx;
  }

  async _buildNativeTokenTransferAction({
    amount,
  }: IEncodedTxUpdatePayloadTransfer) {
    const network = await this.getNetwork();
    const amountBN = new BigNumber(amount || 0);
    const amountBNInAction = new BN(
      amountBN.shiftedBy(network.decimals).toFixed(),
    );
    return nearApiJs.transactions.transfer(amountBNInAction);
  }

  async buildEncodedTxFromTransfer(
    transferInfo: ITransferInfo,
  ): Promise<string> {
    // TODO check dbAccount address match transferInfo.from
    const dbAccount = (await this.getDbAccount()) as DBVariantAccount;
    const network = await this.getNetwork();
    const cli = await this._getNearCli();
    const { nonce } = await cli.getAddress(transferInfo.from);
    const { blockHash } = await cli.getBestBlock();

    // TODO packActions
    const actions = [];

    const amountBN = new BigNumber(transferInfo.amount || 0);
    // token transfer
    if (transferInfo.token) {
      actions.push(
        nearApiJs.transactions.functionCall(
          'ft_transfer',
          {
            // TODO decimals shift
            amount: amountBN,
            receiver_id: transferInfo.to,
          },
          new BN(FT_TRANSFER_GAS),
          new BN(FT_TRANSFER_DEPOSIT),
        ),
      );
    } else {
      // native token transfer
      actions.push(
        await this._buildNativeTokenTransferAction({
          amount: transferInfo.amount,
        }),
      );
    }
    const pubKeyBuffer = await this._getPublicKey(dbAccount.pub);
    const tx = nearApiJs.transactions.createTransaction(
      // 'c3be856133196da252d0f1083614cdc87a85c8aa8abeaf87daff1520355eec51',
      transferInfo.from,
      // 'ed25519:' + baseEncode(pubKeyBuffer);
      nearApiJs.utils.key_pair.PublicKey.from(baseEncode(pubKeyBuffer)),
      transferInfo.token || transferInfo.to,
      nonce ?? 0,
      actions,
      baseDecode(blockHash),
    );
    const txStr = serializeTransaction(tx);
    // TODO remove
    const tx2 = deserializeTransaction(txStr);
    console.log('buildEncodedTxFromTransfer NEAR  >>>>>  ', txStr, tx, tx2);
    return Promise.resolve(txStr);
  }

  async buildUnsignedTxFromEncodedTx(encodedTx: any): Promise<UnsignedTx> {
    const nativeTx = await this.helper.parseToNativeTx(encodedTx);
    const unsignedTx: UnsignedTx = {
      inputs: [],
      outputs: [],
      payload: {
        nativeTx,
      },
    };
    return unsignedTx;
  }

  async fetchFeeInfo(encodedTx: any): Promise<IFeeInfo> {
    const cli = await this._getNearCli();
    const txCostConfig = await cli.getTxCostConfig();
    const priceInfo = await cli.getFeePricePerUnit();
    const price = priceInfo.normal.price.toFixed();
    const { transfer_cost, action_receipt_creation_config } = txCostConfig;
    const network = await this.getNetwork();
    let limit = '0';
    // tokenTransfer with token activation
    limit = new BigNumber(transfer_cost.execution)
      .plus(action_receipt_creation_config.execution)
      .multipliedBy(2)
      .toFixed();

    // hard to estimate gas of function call
    limit = new BigNumber(FT_TRANSFER_GAS).toFixed();

    return {
      editable: false,

      nativeSymbol: network.symbol,
      nativeDecimals: network.decimals,
      symbol: network.feeSymbol,
      decimals: network.feeDecimals,

      limit,
      prices: [price],

      tx: null, // Must be null if network not support feeInTx
    };
  }

  async updateEncodedTx(
    encodedTx: string,
    payload: any,
    options: IEncodedTxUpdateOptions,
  ): Promise<string> {
    const nativeTx = deserializeTransaction(encodedTx);
    // max native token transfer update
    if (options.type === 'transfer') {
      if (
        nativeTx?.actions?.length === 1 &&
        nativeTx?.actions[0]?.enum === 'transfer'
      ) {
        const payloadTransfer = payload as IEncodedTxUpdatePayloadTransfer;
        const action = await this._buildNativeTokenTransferAction(
          payloadTransfer,
        );
        nativeTx.actions = [action];
        return serializeTransaction(nativeTx);
      }
    }
    return Promise.resolve(encodedTx);
  }

  // ----------------------------------------------
  // TODO remove
  buildEncodedTxFromApprove(approveInfo: IApproveInfo): Promise<any> {
    throw new Error('Method not implemented: buildEncodedTxFromApprove');
  }

  updateEncodedTxTokenApprove(
    encodedTx: IEncodedTxAny,
    amount: string,
  ): Promise<IEncodedTxAny> {
    throw new Error('Method not implemented: updateEncodedTxTokenApprove');
  }

  createClientFromURL(url: string): any {
    throw new Error('Method not implemented: createClientFromURL');
  }

  getExportedCredential(password: string): Promise<string> {
    throw new Error('Method not implemented: getExportedCredential');
  }
}
