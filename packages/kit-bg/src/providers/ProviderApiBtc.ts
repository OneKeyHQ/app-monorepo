import { web3Errors } from '@onekeyfe/cross-inpage-provider-errors';
import { IInjectedProviderNames } from '@onekeyfe/cross-inpage-provider-types';
import BigNumber from 'bignumber.js';
import { Psbt } from 'bitcoinjs-lib';
import { isEmpty, isNil } from 'lodash';

import { getInputsToSignFromPsbt } from '@onekeyhq/core/src/chains/btc/sdkBtc';
import {
  decodedPsbt as decodedPsbtFN,
  formatPsbtHex,
  toPsbtNetwork,
} from '@onekeyhq/core/src/chains/btc/sdkBtc/providerUtils';
import type { IEncodedTx } from '@onekeyhq/core/src/types';
import {
  backgroundClass,
  providerApiMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import type {
  ISendBitcoinParams,
  ISignMessageParams,
  ISwitchNetworkParams,
} from '@onekeyhq/shared/types/ProviderApis/ProviderApiBtc.type';
import type {
  IPushPsbtParams,
  IPushTxParams,
  ISignPsbtParams,
  ISignPsbtsParams,
} from '@onekeyhq/shared/types/ProviderApis/ProviderApiSui.type';

import { vaultFactory } from '../vaults/factory';

import ProviderApiBase from './ProviderApiBase';

import type { IProviderBaseBackgroundNotifyInfo } from './ProviderApiBase';
import type { IJsBridgeMessagePayload } from '@onekeyfe/cross-inpage-provider-types';
import type * as BitcoinJS from 'bitcoinjs-lib';

@backgroundClass()
class ProviderApiBtc extends ProviderApiBase {
  public providerName = IInjectedProviderNames.btc;

  public override notifyDappAccountsChanged(
    info: IProviderBaseBackgroundNotifyInfo,
  ): void {
    const data = async ({ origin }: { origin: string }) => {
      const result = {
        method: 'wallet_events_accountChanged',
        params: {
          accounts: await this.getAccounts({
            origin,
            scope: this.providerName,
          }),
        },
      };
      return result;
    };
    info.send(data, info.targetOrigin);
  }

  public override notifyDappChainChanged(
    info: IProviderBaseBackgroundNotifyInfo,
  ): void {
    const data = async ({ origin }: { origin: string }) => {
      const params = await this.getNetwork({
        origin,
        scope: this.providerName,
      });
      const result = {
        method: 'wallet_events_networkChanged',
        params,
      };
      return result;
    };
    info.send(data, info.targetOrigin);
  }

  public async rpcCall(): Promise<any> {
    throw web3Errors.rpc.methodNotSupported();
  }

  @providerApiMethod()
  public async getProviderState() {
    return {
      network: '',
      isUnlocked: true,
      accounts: [],
    };
  }

  // Provider API
  @providerApiMethod()
  public async requestAccounts(request: IJsBridgeMessagePayload) {
    const accounts = await this.getAccounts(request);
    if (accounts && accounts.length) {
      return accounts;
    }
    await this.backgroundApi.serviceDApp.openConnectionModal(request);
    return this.getAccounts(request);
  }

  @providerApiMethod()
  async getAccounts(request: IJsBridgeMessagePayload) {
    const accountsInfo =
      await this.backgroundApi.serviceDApp.dAppGetConnectedAccountsInfo(
        request,
      );
    if (!accountsInfo) {
      return Promise.resolve([]);
    }
    return Promise.resolve(accountsInfo.map((i) => i.account.address));
  }

  @providerApiMethod()
  public async getPublicKey(request: IJsBridgeMessagePayload) {
    const accountsInfo =
      await this.backgroundApi.serviceDApp.dAppGetConnectedAccountsInfo(
        request,
      );
    if (!accountsInfo) {
      return Promise.resolve('');
    }
    return Promise.resolve(accountsInfo[0]?.account?.pub);
  }

  @providerApiMethod()
  public async getNetwork(request: IJsBridgeMessagePayload) {
    try {
      const networks =
        await this.backgroundApi.serviceDApp.getConnectedNetworks({
          origin: request.origin ?? '',
          scope: request.scope ?? this.providerName,
        });
      if (Array.isArray(networks) && networks.length) {
        return await networkUtils.getBtcDappNetworkName(networks[0]);
      }
      return '';
    } catch {
      return '';
    }
  }

  @providerApiMethod()
  public async switchNetwork(
    request: IJsBridgeMessagePayload,
    params: ISwitchNetworkParams,
  ) {
    console.log('ProviderApiBtc.switchNetwork');
    const accountsInfo =
      await this.backgroundApi.serviceDApp.dAppGetConnectedAccountsInfo(
        request,
      );
    if (!accountsInfo) {
      return;
    }
    const { accountInfo: { networkId: oldNetworkId } = {} } = accountsInfo[0];

    if (!oldNetworkId) {
      return;
    }

    const { network: networkName } = params;
    let networkId;
    if (networkName === 'livenet') {
      networkId = getNetworkIdsMap().btc;
    } else if (networkName === 'testnet') {
      networkId = getNetworkIdsMap().tbtc;
    }
    if (!networkId) {
      throw web3Errors.provider.custom({
        code: 4000,
        message: `Unrecognized network ${networkName}.`,
      });
    }
    await this.backgroundApi.serviceDApp.switchConnectedNetwork({
      origin: request.origin ?? '',
      scope: request.scope ?? this.providerName,
      oldNetworkId,
      newNetworkId: networkId,
    });
    const network = await this.getNetwork(request);
    return network;
  }

  @providerApiMethod()
  public async getBalance(request: IJsBridgeMessagePayload) {
    const { accountInfo: { networkId, accountId } = {} } = (
      await this.getAccountsInfo(request)
    )[0];
    const accountAddress =
      await this.backgroundApi.serviceAccount.getAccountAddressForApi({
        networkId: networkId ?? '',
        accountId: accountId ?? '',
      });
    const { balance } =
      await this.backgroundApi.serviceAccountProfile.fetchAccountDetails({
        networkId: networkId ?? '',
        xpub: await this.backgroundApi.serviceAccount.getAccountXpub({
          accountId: accountId ?? '',
          networkId: networkId ?? '',
        }),
        accountAddress,
      });
    return {
      confirmed: balance,
      unconfirmed: 0,
      total: balance,
    };
  }

  @providerApiMethod()
  public async getInscriptions() {
    throw web3Errors.rpc.methodNotSupported();
  }

  @providerApiMethod()
  public async sendBitcoin(
    request: IJsBridgeMessagePayload,
    params: ISendBitcoinParams,
  ) {
    const { toAddress, satoshis, feeRate } = params;
    const accountsInfo = await this.getAccountsInfo(request);
    const { accountInfo: { accountId, networkId, address } = {} } =
      accountsInfo[0];

    if (!networkId || !accountId) {
      throw web3Errors.provider.custom({
        code: 4002,
        message: `Can not get account`,
      });
    }

    const amountBN = new BigNumber(satoshis);

    if (amountBN.isNaN() || amountBN.isNegative()) {
      throw web3Errors.rpc.invalidParams('Invalid satoshis');
    }

    const vault = await vaultFactory.getVault({
      networkId,
      accountId,
    });
    const network = await this.backgroundApi.serviceNetwork.getNetwork({
      networkId,
    });

    const transfersInfo = [
      {
        from: address ?? '',
        to: toAddress,
        amount: amountBN.shiftedBy(-network.decimals).toFixed(),
      },
    ];
    const encodedTx = await vault.buildEncodedTx({
      transfersInfo,
      specifiedFeeRate: isNil(feeRate)
        ? undefined
        : new BigNumber(feeRate).shiftedBy(-network.feeMeta.decimals).toFixed(),
    });

    const result =
      await this.backgroundApi.serviceDApp.openSignAndSendTransactionModal({
        request,
        encodedTx,
        accountId: accountId ?? '',
        networkId: networkId ?? '',
        transfersInfo,
      });
    return result;
  }

  @providerApiMethod()
  public async signMessage(
    request: IJsBridgeMessagePayload,
    params: ISignMessageParams,
  ) {
    const { message, type } = params;
    const accountsInfo = await this.getAccountsInfo(request);
    const { accountInfo: { accountId, networkId } = {} } = accountsInfo[0];

    if (type !== 'bip322-simple' && type !== 'ecdsa') {
      throw web3Errors.rpc.invalidParams('Invalid type');
    }

    const result = await this.backgroundApi.serviceDApp.openSignMessageModal({
      request,
      accountId: accountId ?? '',
      networkId: networkId ?? '',
      unsignedMessage: {
        type,
        message,
        sigOptions: {
          noScriptType: true,
        },
        payload: {
          isFromDApp: true,
        },
      },
    });
    return Buffer.from(result as string, 'hex').toString('base64');
  }

  @providerApiMethod()
  public async sendInscription() {
    throw web3Errors.rpc.methodNotSupported();
  }

  @providerApiMethod()
  public async inscribeTransfer() {
    throw web3Errors.rpc.methodNotSupported();
  }

  @providerApiMethod()
  public async pushTx(request: IJsBridgeMessagePayload, params: IPushTxParams) {
    const { rawTx } = params;
    const accountsInfo = await this.getAccountsInfo(request);
    const { accountInfo: { accountId, networkId, address } = {} } =
      accountsInfo[0];

    if (!networkId || !accountId) {
      throw web3Errors.provider.custom({
        code: 4002,
        message: `Can not get account`,
      });
    }

    const vault = await vaultFactory.getVault({
      networkId,
      accountId,
    });
    const result = await vault.broadcastTransaction({
      accountAddress: address ?? '',
      networkId,
      signedTx: {
        txid: '',
        rawTx,
        encodedTx: null,
      },
    });

    return result.txid;
  }

  @providerApiMethod()
  public async signPsbt(
    request: IJsBridgeMessagePayload,
    params: ISignPsbtParams,
  ) {
    const accountsInfo = await this.getAccountsInfo(request);
    const { accountInfo: { accountId, networkId } = {} } = accountsInfo[0];

    if (!networkId || !accountId) {
      throw web3Errors.provider.custom({
        code: 4002,
        message: `Can not get account`,
      });
    }

    if (accountUtils.isHwAccount({ accountId })) {
      throw web3Errors.provider.custom({
        code: 4003,
        message:
          'Partially signed bitcoin transactions is not supported on hardware.',
      });
    }

    const network = await this.backgroundApi.serviceNetwork.getNetwork({
      networkId,
    });
    if (!network) return null;

    const { psbtHex, options } = params;
    const formattedPsbtHex = formatPsbtHex(psbtHex);
    const psbtNetwork = toPsbtNetwork(network);
    const psbt = Psbt.fromHex(formattedPsbtHex, { network: psbtNetwork });
    const respPsbtHex = await this._signPsbt(request, {
      psbt,
      psbtNetwork,
      options,
    });

    return respPsbtHex;
  }

  @providerApiMethod()
  public async signPsbts(
    request: IJsBridgeMessagePayload,
    params: ISignPsbtsParams,
  ) {
    const accountsInfo = await this.getAccountsInfo(request);
    const { accountInfo: { accountId, networkId } = {} } = accountsInfo[0];

    if (!networkId || !accountId) {
      throw web3Errors.provider.custom({
        code: 4002,
        message: `Can not get account`,
      });
    }

    if (accountUtils.isHwAccount({ accountId })) {
      throw web3Errors.provider.custom({
        code: 4003,
        message:
          'Partially signed bitcoin transactions is not supported on hardware.',
      });
    }

    const network = await this.backgroundApi.serviceNetwork.getNetwork({
      networkId,
    });
    if (!network) return null;

    const { psbtHexs, options } = params;

    const psbtNetwork = toPsbtNetwork(network);
    const result: string[] = [];

    for (let i = 0; i < psbtHexs.length; i += 1) {
      const formattedPsbtHex = formatPsbtHex(psbtHexs[i]);
      const psbt = Psbt.fromHex(formattedPsbtHex, { network: psbtNetwork });
      const respPsbtHex = await this._signPsbt(request, {
        psbt,
        psbtNetwork,
        options,
      });
      result.push(respPsbtHex);
    }

    return result;
  }

  async _signPsbt(
    request: IJsBridgeMessagePayload,
    params: {
      psbt: Psbt;
      psbtNetwork: BitcoinJS.networks.Network;
      options: ISignPsbtParams['options'];
    },
  ) {
    const accountsInfo = await this.getAccountsInfo(request);
    const { accountInfo: { accountId, networkId } = {} } = accountsInfo[0];

    if (!networkId || !accountId) {
      throw web3Errors.provider.custom({
        code: 4002,
        message: `Can not get account`,
      });
    }

    const { psbt, psbtNetwork, options } = params;

    const decodedPsbt = decodedPsbtFN({ psbt, psbtNetwork });

    const account = await this.backgroundApi.serviceAccount.getAccount({
      accountId,
      networkId,
    });

    const inputsToSign = getInputsToSignFromPsbt({
      psbt,
      psbtNetwork,
      account,
      isBtcWalletProvider: options.isBtcWalletProvider,
    });

    const resp =
      (await this.backgroundApi.serviceDApp.openSignAndSendTransactionModal({
        request,
        accountId,
        networkId,
        encodedTx: {
          inputs: (decodedPsbt.inputInfos ?? []).map((v) => ({
            ...v,
            path: '',
            value: new BigNumber(v.value).toFixed(),
          })),
          outputs: (decodedPsbt.outputInfos ?? []).map((v) => ({
            ...v,
            value: new BigNumber(v.value).toFixed(),
          })),
          inputsForCoinSelect: [],
          outputsForCoinSelect: [],
          fee: new BigNumber(decodedPsbt.fee).toFixed(),
          inputsToSign,
          psbtHex: psbt.toHex(),
          disabledCoinSelect: true,
        },
        signOnly: true,
      })) as { psbtHex: string };

    const respPsbt = Psbt.fromHex(resp.psbtHex, { network: psbtNetwork });

    if (options && options.autoFinalized === false) {
      // do not finalize
    } else {
      inputsToSign.forEach((v) => {
        respPsbt.finalizeInput(v.index);
      });
    }
    return respPsbt.toHex();
  }

  @providerApiMethod()
  public async pushPsbt(
    request: IJsBridgeMessagePayload,
    params: IPushPsbtParams,
  ) {
    const accountsInfo = await this.getAccountsInfo(request);
    const { accountInfo: { accountId, networkId, address } = {} } =
      accountsInfo[0];

    if (!networkId || !accountId) {
      throw web3Errors.provider.custom({
        code: 4002,
        message: `Can not get account`,
      });
    }

    const { psbtHex } = params;

    const formattedPsbtHex = formatPsbtHex(psbtHex);
    const psbt = Psbt.fromHex(formattedPsbtHex);
    const tx = psbt.extractTransaction();
    const rawTx = tx.toHex();

    const vault = await vaultFactory.getVault({
      networkId,
      accountId,
    });
    const result = await vault.broadcastTransaction({
      accountAddress: address ?? '',
      networkId,
      signedTx: {
        txid: '',
        rawTx,
        encodedTx: null,
      },
    });

    return result.txid;
  }

  @providerApiMethod()
  public async getNetworkFees(request: IJsBridgeMessagePayload) {
    const accountsInfo = await this.getAccountsInfo(request);
    const { accountInfo: { networkId, accountId } = {} } = accountsInfo[0];

    if (!networkId || !accountId) {
      throw web3Errors.provider.custom({
        code: 4002,
        message: `Can not get account`,
      });
    }
    const accountAddress =
      await this.backgroundApi.serviceAccount.getAccountAddressForApi({
        networkId,
        accountId,
      });
    const result = await this.backgroundApi.serviceGas.estimateFee({
      networkId,
      encodedTx: await this.backgroundApi.serviceGas.buildEstimateFeeParams({
        accountId,
        networkId,
        encodedTx: {} as IEncodedTx,
      }),
      accountAddress,
    });
    if (result.feeUTXO && result.feeUTXO.length === 3) {
      const fastestFee = Number(result.feeUTXO[0].feeRate);
      const halfHourFee = Number(result.feeUTXO[1].feeRate);
      const hourFee = Number(result.feeUTXO[2].feeRate);
      return {
        fastestFee,
        halfHourFee,
        hourFee,
        economyFee: hourFee,
        minimumFee: hourFee,
      };
    }
    throw web3Errors.provider.custom({
      code: 4001,
      message: 'Failed to get network fees',
    });
  }

  @providerApiMethod()
  public async getUtxos(
    request: IJsBridgeMessagePayload,
    params: {
      address: string;
      amount: number;
    },
  ) {
    const accountsInfo = await this.getAccountsInfo(request);
    const { accountInfo: { networkId, accountId } = {} } = accountsInfo[0];

    if (!networkId || !accountId) {
      throw web3Errors.provider.custom({
        code: 4002,
        message: `Can not get account`,
      });
    }
    const accountAddress =
      await this.backgroundApi.serviceAccount.getAccountAddressForApi({
        networkId,
        accountId,
      });
    const xpub = await this.backgroundApi.serviceAccount.getAccountXpub({
      accountId,
      networkId,
    });
    const { utxoList } =
      await this.backgroundApi.serviceAccountProfile.fetchAccountDetails({
        networkId,
        accountAddress,
        xpub,
        withUTXOList: true,
      });
    if (!utxoList || isEmpty(utxoList)) {
      throw web3Errors.provider.custom({
        code: 4001,
        message: 'Failed to get UTXO list',
      });
    }
    const utxos = utxoList;
    const confirmedUtxos = utxos.filter(
      (v) => v.address === params.address && Number(v?.confirmations ?? 0) > 0,
    );
    let sum = 0;
    let index = 0;
    for (const utxo of confirmedUtxos) {
      sum += new BigNumber(utxo.value).toNumber();
      index += 1;
      if (sum > params.amount) {
        break;
      }
    }
    if (sum < params.amount) {
      return [];
    }
    const sliced = confirmedUtxos.slice(0, index);
    const result = [];
    for (const utxo of sliced) {
      // TODO: get scriptPubKey from txDetails by Api
      const txDetails = {} as any;
      result.push({
        txid: utxo.txid,
        vout: utxo.vout,
        value: new BigNumber(utxo.value).toNumber(),
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        scriptPubKey: txDetails?.vout?.[utxo.vout].hex ?? '',
      });
    }

    return result;
  }

  @providerApiMethod()
  public async getBTCTipHeight(request: IJsBridgeMessagePayload) {
    await this.getAccountsInfo(request);
    // TODO: get tip height from btc node
    const blockHeight = 100;
    return blockHeight;
  }
}

export default ProviderApiBtc;
