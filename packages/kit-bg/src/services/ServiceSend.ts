import { isNil, random } from 'lodash';

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
import { getVaultSettings } from '../vaults/settings';

import ServiceBase from './ServiceBase';

import type ServiceNFT from './ServiceNFT';
import type ServiceToken from './ServiceToken';
import type {
  IBroadcastTransactionParams,
  IBuildDecodedTxParams,
  IBuildUnsignedTxParams,
  ISignAndSendTransactionParams,
  ISignTransactionParamsBase,
  ITransferInfo,
  IUpdateUnsignedTxParams,
} from '../vaults/types';

@backgroundClass()
class ServiceSend extends ServiceBase {
  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
  }

  @backgroundMethod()
  public async demoSend({
    networkId,
    accountId,
  }: {
    networkId: string;
    accountId: string;
  }) {
    const vault = await vaultFactory.getVault({
      networkId,
      accountId,
    });
    const account = await this.backgroundApi.serviceAccount.getAccount({
      accountId,
      networkId,
    });
    const transferInfo: ITransferInfo = {
      from: account.address,
      to: account.address,
      amount: `0.00000${random(1, 20)}`,
      tokenInfo: {
        address: '',
        decimals: 18,
        name: 'Ethereum',
        symbol: 'ETH',
      },
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
        common: {
          nativeDecimals: 18,
          nativeSymbol: 'ETH',
          feeDecimals: 9,
          feeSymbol: 'Gwei',
          nativeTokenPrice: 2000,
        },
        gas: {
          gasPrice: '0x2a', // 42
          gasLimit: '0x5208', // 21000
        },
      },
    });

    // @ts-ignore
    unsignedTx.encodedTx.nonce = '0x817'; // Nonce: 2071

    // PageSendConfirm -> password auth -> send tx
    const signedTxWithoutBroadcast = await this.signTransaction({
      networkId,
      accountId,
      unsignedTx,
    });

    // const txid = await this.broadcastTransaction({
    //   networkId,
    //   signedTx: signedTxWithoutBroadcast,
    // });
    const txid = await this.broadcastTransactionLegacy({
      accountId,
      networkId,
      signedTx: signedTxWithoutBroadcast,
    });

    const signedTx = {
      ...signedTxWithoutBroadcast,
      txid,
    };

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
          type: EDecodedTxActionType.ASSET_TRANSFER,
          assetTransfer: {
            from: '0x1959f5f4979c5cd87d5cb75c678c770515cb5e0e',
            to: '0x1959f5f4979c5cd87d5cb75c678c770515cb5e0e',
            label: 'Send',
            sends: [
              {
                from: '0x1959f5f4979c5cd87d5cb75c678c770515cb5e0e',
                to: '0x1959f5f4979c5cd87d5cb75c678c770515cb5e0e',
                token: '',
                label: '',
                amount: '1',
                symbol: 'ETH',
                icon: 'https://cdn.jsdelivr.net/gh/atomiclabs/cryptocurrency-icons@1a63530be6e374711a8554f31b17e4cb92c25fa5/128/color/eth.png',
              },
            ],
            receives: [],
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
    const buildTxHelper = await this.getBuildTxHelper();
    return vault.buildDecodedTx({
      unsignedTx,
      ...buildTxHelper,
    });
  }

  @backgroundMethod()
  public async buildUnsignedTx(
    params: ISendTxBaseParams & IBuildUnsignedTxParams,
  ) {
    const { networkId, accountId, encodedTx, transfersInfo, approveInfo } =
      params;
    const vault = await vaultFactory.getVault({ networkId, accountId });
    return vault.buildUnsignedTx({
      encodedTx,
      transfersInfo,
      approveInfo,
    });
  }

  @backgroundMethod()
  public async updateUnsignedTx(
    params: ISendTxBaseParams & IUpdateUnsignedTxParams,
  ) {
    const { networkId, accountId, unsignedTx, ...rest } = params;
    const vault = await vaultFactory.getVault({ networkId, accountId });
    return vault.updateUnsignedTx({ unsignedTx, ...rest });
  }

  @backgroundMethod()
  public async broadcastTransaction(params: IBroadcastTransactionParams) {
    const { networkId, signedTx } = params;
    const client = await this.getClient();
    const resp = await client.post<{
      data: { result: string };
    }>('/wallet/v1/account/send-transaction', {
      networkId,
      tx: signedTx.rawTx,
    });

    return resp.data.data.result;
  }

  @backgroundMethod()
  public async broadcastTransactionLegacy(
    params: IBroadcastTransactionParams & { accountId: string },
  ) {
    const { networkId, accountId } = params;
    const vault = await vaultFactory.getVault({ networkId, accountId });
    return vault.broadcastTransaction(params);
  }

  @backgroundMethod()
  public async signTransaction(
    params: ISendTxBaseParams & ISignTransactionParamsBase,
  ) {
    const { networkId, accountId, unsignedTx } = params;
    const vault = await vaultFactory.getVault({ networkId, accountId });
    const { password, deviceParams } =
      await this.backgroundApi.servicePassword.promptPasswordVerifyByAccount({
        accountId,
      });
    const signedTx = await vault.signTransaction({
      unsignedTx,
      password,
      deviceParams,
    });
    return signedTx;
  }

  @backgroundMethod()
  public async signAndSendTransaction(
    params: ISendTxBaseParams & ISignAndSendTransactionParams,
  ) {
    const { networkId, accountId, unsignedTx } = params;
    const signedTx = await this.signTransaction({
      networkId,
      accountId,
      unsignedTx,
    });
    return this.broadcastTransaction({ networkId, signedTx });
  }

  @backgroundMethod()
  public async getIsNonceRequired({ networkId }: { networkId: string }) {
    const settings = await getVaultSettings({ networkId });
    return settings.nonceRequired;
  }

  @backgroundMethod()
  public async getNextNonce({
    networkId,
    accountAddress,
  }: {
    networkId: string;
    accountAddress: string;
  }) {
    const { nonce } =
      await this.backgroundApi.serviceAccountProfile.fetchAccountDetails({
        networkId,
        accountAddress,
        withNonce: true,
      });

    if (isNil(nonce)) {
      throw new Error('Get on-chain nonce failed.');
    }

    // TODO: fix nonce with local pending txs

    return nonce;
  }

  @backgroundMethod()
  public getBuildTxHelper(): Promise<{
    getToken: ServiceToken['getToken'];
    getNFT: ServiceNFT['getNFT'];
  }> {
    return Promise.resolve({
      getToken: this.backgroundApi.serviceToken.getToken.bind(
        this.backgroundApi.serviceToken,
      ),
      getNFT: this.backgroundApi.serviceNFT.getNFT.bind(
        this.backgroundApi.serviceNFT,
      ),
    });
  }

  @backgroundMethod()
  async prepareSendConfirmUnsignedTx(
    params: ISendTxBaseParams & IBuildUnsignedTxParams,
  ) {
    const {
      networkId,
      accountId,
      unsignedTx,
      encodedTx,
      approveInfo,
      transfersInfo,
    } = params;
    if (unsignedTx) return unsignedTx;

    return this.buildUnsignedTx({
      networkId,
      accountId,
      encodedTx,
      approveInfo,
      transfersInfo,
    });
  }
}

export default ServiceSend;
