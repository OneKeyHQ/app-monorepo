import { random } from 'lodash';

import { encodePassword } from '@onekeyhq/core/src/secret';
import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import {
  EDecodedTxActionType,
  EDecodedTxStatus,
  type IDecodedTx,
  type ISendTxBaseParams,
} from '@onekeyhq/shared/types/tx';

import { vaultFactory } from '../vaults/factory';

import ServiceBase from './ServiceBase';

import type {
  IBroadcastTransactionParams,
  IBuildDecodedTxParams,
  IBuildUnsignedTxParams,
  ISignAndSendTransactionParams,
  ITransferInfo,
  IUpdateUnsignedTxParams,
} from '../vaults/types';

@backgroundClass()
class ServiceSend extends ServiceBase {
  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
  }

  @backgroundMethod()
  public async demoSendEvmTx() {
    const networkId = 'evm--5';
    const accountId = "hd-1--m/44'/60'/0'/0/0";
    const vault = await vaultFactory.getVault({
      networkId,
      accountId,
    });
    const transferInfo: ITransferInfo = {
      from: '0x1959f5f4979c5cd87d5cb75c678c770515cb5e0e',
      to: '0x1959f5f4979c5cd87d5cb75c678c770515cb5e0e',
      amount: `0.00000${random(1, 20)}`,
      token: '',
    };

    // PagePreSend -> TokenInput、AmountInput、ReceiverInput -> unsignedTx
    // PageSendConfirm
    let unsignedTx = await vault.buildUnsignedTx({
      transfersInfo: [transferInfo],
    });

    // PageSendConfirm -> feeInfoEditor -> rebuild unsignedTx
    unsignedTx = await vault.updateUnsignedTx({
      unsignedTx,
      feeInfo: {
        gas: {
          gasLimit: '0x5208', // 21000
          gasPrice: '0x2a', // 42
        },
      },
    });

    // PageSendConfirm -> password auth -> send tx
    const signedTx = await this.signAndSendTransaction({
      networkId,
      accountId,
      unsignedTx,
      password: encodePassword({ password: '11111111' }),
    });

    // signOnly
    const signedTxWithoutBroadcast = await vault.signTransaction({
      unsignedTx,
      password: encodePassword({ password: '11111111' }),
    });
    console.log({
      vault,
      unsignedTx,
      signedTx,
      transferInfo,
      signedTxWithoutBroadcast,
    });
    return Promise.resolve('hello world');
  }

  @backgroundMethod()
  public async demoBuildDecodedTx(): Promise<IDecodedTx> {
    const networkId = 'evm--5';
    const accountId = "hd-1--m/44'/60'/0'/0/0";
    return Promise.resolve({
      txid: '0x1234567890',

      owner: '0x1959f5f4979c5cd87d5cb75c678c770515cb5e0e',
      signer: '0x1959f5f4979c5cd87d5cb75c678c770515cb5e0e',

      nonce: 1,
      actions: [
        {
          type: EDecodedTxActionType.NATIVE_TRANSFER,
          nativeTransfer: {
            from: '0x1959f5f4979c5cd87d5cb75c678c770515cb5e0e',
            to: '0x1959f5f4979c5cd87d5cb75c678c770515cb5e0e',
            amount: '0.0001',
            amountValue: '1',
            tokenInfo: {
              name: 'Ethereum',
              symbol: 'ETH',
              decimals: 18,
              logoURI:
                'https://cdn.jsdelivr.net/gh/atomiclabs/cryptocurrency-icons@1a63530be6e374711a8554f31b17e4cb92c25fa5/128/color/eth.png',
              address: '',
              isNative: true,
              riskLevel: 0,
            },
          },
        },
        {
          type: EDecodedTxActionType.TOKEN_TRANSFER,
          tokenTransfer: {
            from: '0x1959f5f4979c5cd87d5cb75c678c770515cb5e0e',
            to: '0x1959f5f4979c5cd87d5cb75c678c770515cb5e0e',
            amount: '1',
            amountValue: '1000000',
            tokenInfo: {
              name: 'Matic',
              symbol: 'MATIC',
              decimals: 6,
              logoURI:
                'https://cdn.jsdelivr.net/gh/atomiclabs/cryptocurrency-icons@1a63530be6e374711a8554f31b17e4cb92c25fa5/128/color/matic.png',
              address: '',
              isNative: false,
              riskLevel: 0,
            },
          },
        },
      ],

      createdAt: new Date().getTime(),
      updatedAt: new Date().getTime(),

      status: EDecodedTxStatus.Pending,
      networkId,
      accountId,
      extraInfo: null,
    });
  }

  @backgroundMethod()
  async buildDecodedTx(
    params: ISendTxBaseParams & IBuildDecodedTxParams,
  ): Promise<IDecodedTx> {
    const { networkId, accountId, unsignedTx } = params;
    const vault = await vaultFactory.getVault({ networkId, accountId });
    return vault.buildDecodedTx({ unsignedTx });
  }

  @backgroundMethod()
  public async buildUnsignedTx(
    params: ISendTxBaseParams & IBuildUnsignedTxParams,
  ) {
    const { networkId, accountId, transfersInfo } = params;
    const vault = await vaultFactory.getVault({ networkId, accountId });
    return vault.buildUnsignedTx({ transfersInfo });
  }

  @backgroundMethod()
  public async updateUnsignedTx(
    params: ISendTxBaseParams & IUpdateUnsignedTxParams,
  ) {
    const { networkId, accountId, unsignedTx, feeInfo } = params;
    const vault = await vaultFactory.getVault({ networkId, accountId });
    return vault.updateUnsignedTx({ unsignedTx, feeInfo });
  }

  @backgroundMethod()
  public async broadcastTransaction(params: IBroadcastTransactionParams) {
    const { networkId, signedTx } = params;
    const client = await this.getClient();
    const resp = await client.post<{
      data: { result: string };
    }>('/wallet/v1/onchain/send-transaction', {
      networkId,
      tx: signedTx.rawTx,
    });

    return resp.data.data.result;
  }

  @backgroundMethod()
  public async signAndSendTransaction(
    params: ISendTxBaseParams & ISignAndSendTransactionParams,
  ) {
    const { networkId, accountId, unsignedTx, password, signOnly } = params;
    const vault = await vaultFactory.getVault({ networkId, accountId });
    const signedTx = await vault.signTransaction({
      unsignedTx,
      password,
    });
    if (signOnly) {
      return { ...signedTx, encodedTx: unsignedTx.encodedTx };
    }
    return this.broadcastTransaction({ networkId, signedTx });
  }
}

export default ServiceSend;
