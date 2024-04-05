import { web3Errors } from '@onekeyfe/cross-inpage-provider-errors';
import { IInjectedProviderNames } from '@onekeyfe/cross-inpage-provider-types';
import BigNumber from 'bignumber.js';
import { Psbt } from 'bitcoinjs-lib';
import { isNil } from 'lodash';

import { getFiatEndpoint } from '@onekeyhq/engine/src/endpoint';
import type { NFTBTCAssetModel } from '@onekeyhq/engine/src/types/nft';
import type VaultBtcFork from '@onekeyhq/engine/src/vaults/utils/btcForkChain/VaultBtcFork';
import { getActiveWalletAccount } from '@onekeyhq/kit/src/hooks';
import {
  backgroundClass,
  providerApiMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { OnekeyNetwork } from '@onekeyhq/shared/src/config/networkIds';
import { IMPL_BTC, IMPL_TBTC } from '@onekeyhq/shared/src/engine/engineConsts';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';
import type {
  DecodedPsbt,
  InscribeTransferParams,
  PushPsbtParams,
  PushTxParams,
  SendBitcoinParams,
  SendInscriptionParams,
  SignMessageParams,
  SignPsbtParams,
  SignPsbtsParams,
  SwitchNetworkParams,
} from '@onekeyhq/shared/src/providerApis/ProviderApiBtc/ProviderApiBtc.types';
import {
  formatPsbtHex,
  getInputsToSignFromPsbt,
  getNetworkName,
  httpPost,
  mapInscriptionToNFTBTCAssetModel,
  toPsbtNetwork,
} from '@onekeyhq/shared/src/providerApis/ProviderApiBtc/ProviderApiBtc.utils';
import { RestfulRequest } from '@onekeyhq/shared/src/request/RestfulRequest';

import ProviderApiBase from './ProviderApiBase';

import type { IProviderBaseBackgroundNotifyInfo } from './ProviderApiBase';
import type { IJsBridgeMessagePayload } from '@onekeyfe/cross-inpage-provider-types';
import type * as BitcoinJS from 'bitcoinjs-lib';

@backgroundClass()
class ProviderApiBtc extends ProviderApiBase {
  public providerName = IInjectedProviderNames.btc;

  public notifyDappAccountsChanged(info: IProviderBaseBackgroundNotifyInfo) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const data = async ({ origin }: { origin: string }) => {
      const params = await this.getAccounts({ origin });
      const result = {
        method: 'wallet_events_accountsChanged',
        params,
      };
      return result;
    };
    info.send(data);
  }

  public notifyDappChainChanged(info: IProviderBaseBackgroundNotifyInfo) {
    const data = async () => {
      const params = await this.getNetwork();
      const result = {
        method: 'wallet_events_networkChanged',
        params,
      };
      return result;
    };
    info.send(data);
  }

  public rpcCall() {
    throw web3Errors.rpc.methodNotSupported();
  }

  @providerApiMethod()
  public async getProviderState() {
    const isUnlocked = await this.backgroundApi.serviceApp.isUnlock();
    const accounts: string[] = [];
    const { accountAddress, network } = getActiveWalletAccount();
    if (isUnlocked) {
      if (accountAddress) {
        accounts.push(accountAddress);
      }
    }
    return {
      network: network ? getNetworkName(network) : '',
      isUnlocked,
      accounts,
    };
  }

  @providerApiMethod()
  public async requestAccounts(request: IJsBridgeMessagePayload) {
    debugLogger.providerApi.info('ProviderApiBtc.requestAccounts', request);

    const accounts = await this.getAccounts(request);
    if (accounts && accounts.length) {
      return accounts;
    }

    await this.backgroundApi.serviceDapp.openConnectionModal(request);
    return this.getAccounts(request);
  }

  @providerApiMethod()
  public async getAccounts(request: IJsBridgeMessagePayload) {
    const { network } = getActiveWalletAccount();
    const accounts = this.backgroundApi.serviceDapp?.getActiveConnectedAccounts(
      {
        origin: request.origin as string,
        impl: network?.isTestnet ? IMPL_TBTC : IMPL_BTC,
      },
    );
    if (!accounts) {
      return Promise.resolve([]);
    }
    const accountAddresses = accounts.map((account) => account.address);
    return Promise.resolve(accountAddresses);
  }

  @providerApiMethod()
  public async getNetwork() {
    debugLogger.providerApi.info('ProviderApiBtc.getNetwork');

    const { network } = getActiveWalletAccount();

    return network ? getNetworkName(network) : '';
  }

  @providerApiMethod()
  public async switchNetwork(
    request: IJsBridgeMessagePayload,
    params: SwitchNetworkParams,
  ) {
    debugLogger.providerApi.info('ProviderApiBtc.switchNetwork');

    const { network: networkName } = params;
    let networkId;
    if (networkName === 'livenet') {
      networkId = OnekeyNetwork.btc;
    } else if (networkName === 'testnet') {
      networkId = OnekeyNetwork.tbtc;
    }
    if (!networkId) {
      throw web3Errors.provider.custom({
        code: 4000,
        message: `Unrecognized network ${networkName}.`,
      });
    }

    const { network } = getActiveWalletAccount();
    if (networkId === network?.id) {
      return;
    }

    await this.backgroundApi.serviceDapp?.openSwitchNetworkModal(request, {
      networkId,
    });
  }

  @providerApiMethod()
  public async getPublicKey() {
    debugLogger.providerApi.info('ProviderApiBtc.getPublicKey');
    const { accountPubKey } = getActiveWalletAccount();

    return Promise.resolve(accountPubKey);
  }

  @providerApiMethod()
  public async getBalance() {
    debugLogger.providerApi.info('ProviderApiBtc.getBalance');
    const { accountId, network } = getActiveWalletAccount();
    if (!accountId || !network) return null;
    const balanceDetail =
      await this.backgroundApi.serviceToken.fetchBalanceDetails({
        networkId: network.id,
        accountId,
      });
    if (balanceDetail) {
      return {
        confirmed: new BigNumber(balanceDetail.total)
          .minus(balanceDetail.unavailableOfUnconfirmed ?? '0')
          .shiftedBy(network.decimals)
          .toFixed(),
        unconfirmed: new BigNumber(
          balanceDetail.unavailableOfUnconfirmed ?? '0',
        )
          .shiftedBy(network.decimals)
          .toFixed(),
        total: new BigNumber(balanceDetail.total)
          .shiftedBy(network.decimals)
          .toFixed(),
      };
    }
    return null;
  }

  @providerApiMethod()
  public async getInscriptions() {
    debugLogger.providerApi.info('ProviderApiBtc.getBalance');
    const { networkId, accountAddress } = getActiveWalletAccount();

    const req = new RestfulRequest(getFiatEndpoint(), {}, 60 * 1000);

    const query = {
      chain: networkId,
      address: accountAddress,
    };

    try {
      const resp = (await req
        .get('/NFT/v2/list', query)
        .then((r) => r.json())) as { data: NFTBTCAssetModel[] };

      return {
        total: resp.data.length,
        list: resp.data,
      };
    } catch {
      return null;
    }
  }

  @providerApiMethod()
  public async sendBitcoin(
    request: IJsBridgeMessagePayload,
    params: SendBitcoinParams,
  ) {
    const { toAddress, satoshis, feeRate } = params;
    const { account, network } = getActiveWalletAccount();

    if (!network || !account) {
      throw web3Errors.provider.custom({
        code: 4002,
        message: `Can not get current account`,
      });
    }

    const amountBN = new BigNumber(satoshis);

    if (amountBN.isNaN() || amountBN.isNegative()) {
      throw web3Errors.rpc.invalidParams('Invalid satoshis');
    }
    const vault = (await this.backgroundApi.engine.getVault({
      networkId: network.id,
      accountId: account.id,
    })) as VaultBtcFork;

    const encodedTx = await vault.buildEncodedTxFromTransfer(
      {
        from: account.address,
        to: toAddress,
        amount: amountBN.shiftedBy(-network.decimals).toFixed(),
      },
      isNil(feeRate)
        ? undefined
        : new BigNumber(feeRate).shiftedBy(-network.feeDecimals).toFixed(),
    );

    const result = await this.backgroundApi.serviceDapp?.openSignAndSendModal(
      request,
      {
        encodedTx,
      },
    );

    return result;
  }

  @providerApiMethod()
  public async sendInscription(
    request: IJsBridgeMessagePayload,
    params: SendInscriptionParams,
  ) {
    const { toAddress, inscriptionId, feeRate } = params;

    const { account, accountAddress, network } = getActiveWalletAccount();

    if (!network || !account) {
      throw web3Errors.provider.custom({
        code: 4002,
        message: `Can not get current account`,
      });
    }

    const asset = (await this.backgroundApi.serviceNFT.getAsset({
      networkId: network.id,
      accountId: account.id,
      tokenId: inscriptionId,
      local: true,
    })) as NFTBTCAssetModel;

    if (!asset) {
      throw web3Errors.provider.custom({
        code: 4001,
        message: `Can not get asset by inscriptionId ${inscriptionId}`,
      });
    }

    const vault = (await this.backgroundApi.engine.getVault({
      networkId: network.id,
      accountId: account.id,
    })) as VaultBtcFork;

    const encodedTx = await vault.buildEncodedTxFromTransfer(
      {
        from: accountAddress,
        to: toAddress,
        amount: '0',
        isNFT: true,
        nftTokenId: asset.inscription_id,
        nftInscription: {
          address: asset.owner,
          inscriptionId: asset.inscription_id,
          output: asset.output,
          location: asset.location,
        },
      },
      isNil(feeRate)
        ? undefined
        : new BigNumber(feeRate)
            .shiftedBy(-network.feeDecimals ?? '0')
            .toFixed(),
    );

    const result = await this.backgroundApi.serviceDapp?.openSignAndSendModal(
      request,
      {
        encodedTx,
      },
    );

    return result;
  }

  @providerApiMethod()
  public async signMessage(
    request: IJsBridgeMessagePayload,
    params: SignMessageParams,
  ) {
    const { message, type } = params;

    const { network, account } = getActiveWalletAccount();

    if (!network || !account) {
      throw web3Errors.provider.custom({
        code: 4002,
        message: `Can not get current account`,
      });
    }

    if (type !== 'bip322-simple' && type !== 'ecdsa') {
      throw web3Errors.rpc.invalidParams('Invalid type');
    }

    const result = await this.backgroundApi.serviceDapp.openSignAndSendModal(
      request,
      {
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
        signOnly: true,
      },
    );
    return Buffer.from(result as string, 'hex').toString('base64');
  }

  @providerApiMethod()
  public async pushTx(request: IJsBridgeMessagePayload, params: PushTxParams) {
    const { rawTx } = params;
    const { networkId, accountId } = getActiveWalletAccount();
    const vault = (await this.backgroundApi.engine.getVault({
      networkId,
      accountId,
    })) as VaultBtcFork;

    const result = await vault.broadcastTransaction({
      txid: '',
      rawTx,
    });

    return result.txid;
  }

  @providerApiMethod()
  public async signPsbt(
    request: IJsBridgeMessagePayload,
    params: SignPsbtParams,
  ) {
    const { psbtHex, options } = params;

    const formatedPsbtHex = formatPsbtHex(psbtHex);

    const { network, wallet } = getActiveWalletAccount();

    if (wallet?.type === 'hw') {
      throw web3Errors.provider.custom({
        code: 4003,
        message:
          'Partially signed bitcoin transactions is not supported on hardware.',
      });
    }
    if (!network) return null;
    const psbtNetwork = toPsbtNetwork(network);
    const psbt = Psbt.fromHex(formatedPsbtHex, { network: psbtNetwork });
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
    params: SignPsbtsParams,
  ) {
    const { psbtHexs, options } = params;

    const { network } = getActiveWalletAccount();
    if (!network) return null;

    const psbtNetwork = toPsbtNetwork(network);
    const result: string[] = [];

    for (let i = 0; i < psbtHexs.length; i += 1) {
      const formatedPsbtHex = formatPsbtHex(psbtHexs[i]);
      const psbt = Psbt.fromHex(formatedPsbtHex, { network: psbtNetwork });
      const respPsbtHex = await this._signPsbt(request, {
        psbt,
        psbtNetwork,
        options,
      });
      result.push(respPsbtHex);
    }

    return result;
  }

  @providerApiMethod()
  public async pushPsbt(
    request: IJsBridgeMessagePayload,
    params: PushPsbtParams,
  ) {
    const { psbtHex } = params;

    const formatedPsbtHex = formatPsbtHex(psbtHex);
    const psbt = Psbt.fromHex(formatedPsbtHex);
    const tx = psbt.extractTransaction();
    const rawTx = tx.toHex();

    const { networkId, accountId } = getActiveWalletAccount();
    const vault = (await this.backgroundApi.engine.getVault({
      networkId,
      accountId,
    })) as VaultBtcFork;

    const result = await vault.broadcastTransaction({
      txid: '',
      rawTx,
    });

    return result.txid;
  }

  @providerApiMethod()
  public async inscribeTransfer(
    request: IJsBridgeMessagePayload,
    params: InscribeTransferParams,
  ) {
    const { ticker, amount } = params;

    const amountBN = new BigNumber(amount ?? 0);

    if (amountBN.isNaN() || amountBN.isNegative()) {
      throw web3Errors.rpc.invalidParams('Invalid amount.');
    }

    if (!ticker) {
      throw web3Errors.rpc.invalidParams('Invalid ticker.');
    }

    return this.backgroundApi.serviceDapp.openInscribeTransferModal(request, {
      ticker,
      amount,
    });
  }

  private async _signPsbt(
    request: IJsBridgeMessagePayload,
    params: {
      psbt: Psbt;
      psbtNetwork: BitcoinJS.networks.Network;
      options: SignPsbtParams['options'];
    },
  ) {
    const { psbt, psbtNetwork, options } = params;

    const { account, network } = getActiveWalletAccount();

    if (!account || !account.xpub || !network) {
      throw web3Errors.provider.custom({
        code: 4002,
        message: `Can not get current account`,
      });
    }

    const decodedPsbt = (
      await httpPost<DecodedPsbt>({
        isTestnet: network.isTestnet,
        route: '/tx/decode',
        params: { psbtHex: psbt.toHex() },
      })
    ).data;

    const inputsToSign = getInputsToSignFromPsbt({
      psbt,
      psbtNetwork,
      account,
    });

    const resp = (await this.backgroundApi.serviceDapp.openSignAndSendModal(
      request,
      {
        encodedTx: {
          inputs: decodedPsbt.inputInfos.map((v) => ({
            ...v,
            path: '',
            value: v.value.toString(),
            inscriptions: v.inscriptions.map((i) =>
              mapInscriptionToNFTBTCAssetModel(
                decodedPsbt.inscriptions[i.inscriptionId],
              ),
            ),
          })),
          outputs: decodedPsbt.outputInfos.map((v) => ({
            ...v,
            value: v.value.toString(),
            inscriptions: v.inscriptions.map((i) =>
              mapInscriptionToNFTBTCAssetModel(
                decodedPsbt.inscriptions[i.inscriptionId],
              ),
            ),
          })),
          totalFee: decodedPsbt.fee,
          totalFeeInNative: new BigNumber(decodedPsbt.fee)
            .shiftedBy(-network.decimals)
            .toFixed(),
          transferInfo: {
            from: '',
            to: '',
            amount: '0',
            coinControlDisabled: true,
          },
          inputsToSign,
          psbtHex: psbt.toHex(),
        },
        signOnly: true,
      },
    )) as { psbtHex: string };

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
}

export default ProviderApiBtc;
