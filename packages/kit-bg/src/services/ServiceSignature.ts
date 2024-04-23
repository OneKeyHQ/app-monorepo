import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import type {
  IBaseSignedMessageContentType,
  IConnectedSite,
  ICreateSignedMessageParams,
  ICreateSignedTransactionParams,
  ISignatureItemQueryParams,
  ISignedMessage,
  ISignedTransaction,
} from '@onekeyhq/shared/types/signatureRecord';
import type { ISendTxOnSuccessData } from '@onekeyhq/shared/types/tx';
import { EDecodedTxActionType } from '@onekeyhq/shared/types/tx';

import localDb from '../dbs/local/localDbInstance';
import { ELocalDBStoreNames } from '../dbs/local/localDBStoreNames';

import ServiceBase from './ServiceBase';

@backgroundClass()
class ServiceSignature extends ServiceBase {
  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
  }

  @backgroundMethod()
  public async addSignedMessage(params: ICreateSignedMessageParams) {
    await localDb.addSignedMessage(params);
  }

  @backgroundMethod()
  public async getSignedMessages(
    params?: ISignatureItemQueryParams,
  ): Promise<ISignedMessage[]> {
    const { networkId, address, limit, offset } = params ?? {};
    const isSearch = Boolean(networkId || address);
    const limitOffset = isSearch ? undefined : { limit, offset };
    const { records } = await localDb.getAllRecords({
      name: ELocalDBStoreNames.SignedMessage,
      ...limitOffset,
    });
    const promises = records.map(async (item) => {
      const network = await this.backgroundApi.serviceNetwork.getNetwork({
        networkId: item.networkId,
      });
      return {
        ...item,
        network,
      };
    });
    let items = await Promise.all(promises);
    if (isSearch) {
      items = items.filter((item) => {
        if (networkId && item.networkId !== networkId) {
          return false;
        }
        if (
          address &&
          item.address.toLowerCase().includes(address.toLowerCase())
        ) {
          return false;
        }
        return true;
      });
    }
    return items;
  }

  @backgroundMethod()
  public async addSignedTransaction(params: ICreateSignedTransactionParams) {
    await localDb.addSignedTransaction(params);
  }

  @backgroundMethod()
  public async getSignedTransactions(
    params?: ISignatureItemQueryParams,
  ): Promise<ISignedTransaction[]> {
    const { networkId, address, limit, offset } = params ?? {};
    const isSearch = Boolean(networkId || address);
    const limitOffset = isSearch ? undefined : { limit, offset };
    const { records } = await localDb.getAllRecords({
      name: ELocalDBStoreNames.SignedTransaction,
      ...limitOffset,
    });
    const promises = records.map(async (item) => {
      const { dataStringify, ...rest } = item;
      const data = JSON.parse(dataStringify) as ISignedTransaction['data'];
      const network = await this.backgroundApi.serviceNetwork.getNetwork({
        networkId: item.networkId,
      });
      return {
        ...rest,
        data,
        network,
      };
    });
    let items = await Promise.all(promises);
    if (isSearch) {
      items = items.filter((item) => {
        if (networkId && item.networkId !== networkId) {
          return false;
        }
        if (
          address &&
          item.address.toLowerCase().includes(address.toLowerCase())
        ) {
          return false;
        }
        return true;
      });
    }
    return items;
  }

  @backgroundMethod()
  public async addConnectedSite(params: {
    url: string;
    items: { networkId: string; address: string }[];
  }) {
    const { url, items } = params;
    const networkIds = items.map((item) => item.networkId);
    const addresses = items.map((item) => item.address);
    await localDb.addConnectedSite({ url, networkIds, addresses });
  }

  @backgroundMethod()
  public async getConnectedSites(
    params?: ISignatureItemQueryParams,
  ): Promise<IConnectedSite[]> {
    const { networkId, address, limit, offset } = params ?? {};
    const isSearch = Boolean(networkId || address);
    const limitOffset = isSearch ? undefined : { limit, offset };
    const { records } = await localDb.getAllRecords({
      name: ELocalDBStoreNames.ConnectedSite,
      ...limitOffset,
    });
    const data = records.map(async (item) => {
      const { url, networkIds } = item;
      const logo =
        await this.backgroundApi.serviceDiscovery.buildWebsiteIconUrl(url);
      const networks = await Promise.all(
        networkIds.map((o) =>
          this.backgroundApi.serviceNetwork.getNetwork({
            networkId: o,
          }),
        ),
      );
      return { ...item, logo, networks } as IConnectedSite;
    });
    const items = await Promise.all(data);
    if (isSearch) {
      return items.filter((item) => {
        if (networkId && item.networkIds.includes(networkId)) {
          return true;
        }
        if (address && item.addresses.includes(address)) {
          return true;
        }
        return false;
      });
    }
    return items;
  }

  @backgroundMethod()
  async addItemFromSendProcess(data: ISendTxOnSuccessData) {
    const { signedTx, decodedTx } = data;
    const actions = decodedTx.actions;
    const networkId = decodedTx.networkId;
    const address = decodedTx.signer;
    const swapInfo = signedTx.swapInfo;
    const defaultTitle = 'OneKey Wallet';
    if (swapInfo) {
      const fromToken = swapInfo.sender.token;
      const toToken = swapInfo.receiver.token;
      await this.addSignedTransaction({
        networkId,
        address,
        title: defaultTitle,
        hash: signedTx.txid,
        data: {
          type: 'swap',
          fromNetworkId: fromToken.networkId,
          toNetworkId: toToken.networkId,
          fromAmount: swapInfo.sender.amount,
          toAmount: swapInfo.sender.amount,
          fromToken: {
            name: fromToken.name ?? toToken.symbol,
            symbol: fromToken.symbol,
            logoURI: fromToken.logoURI,
            address: fromToken.contractAddress,
          },
          toToken: {
            name: toToken.name ?? toToken.symbol,
            symbol: toToken.symbol,
            logoURI: toToken.logoURI,
            address: toToken.contractAddress,
          },
        },
      });
      return;
    }
    // add stake action here
    if (actions.length < 1) {
      return;
    }
    const approveAction = actions.find(
      (action) => action.type === EDecodedTxActionType.TOKEN_APPROVE,
    );
    if (approveAction && approveAction.tokenApprove) {
      const tokenApprove = approveAction.tokenApprove;
      if (tokenApprove) {
        await this.addSignedTransaction({
          networkId,
          address,
          title: defaultTitle,
          hash: signedTx.txid,
          data: {
            type: 'approve',
            amount: tokenApprove.amount,
            token: {
              name: tokenApprove.name,
              symbol: tokenApprove.symbol,
              address: tokenApprove.tokenIdOnNetwork,
              logoURI: tokenApprove.icon,
            },
            isUnlimited: tokenApprove.isInfiniteAmount,
          },
        });
      }
      return;
    }
    const transferAction = actions.find(
      (action) => action.type === EDecodedTxActionType.ASSET_TRANSFER,
    );
    if (transferAction && transferAction.assetTransfer) {
      const assetTransfer = transferAction.assetTransfer;
      await this.addSignedTransaction({
        networkId,
        address,
        title: defaultTitle,
        hash: signedTx.txid,
        data: {
          type: 'send',
          amount: assetTransfer.sends[0].amount,
          token: {
            name: assetTransfer.sends[0].name,
            symbol: assetTransfer.sends[0].symbol,
            address: assetTransfer.sends[0].tokenIdOnNetwork,
            logoURI: assetTransfer.sends[0].icon,
          },
        },
      });
    }
  }

  @backgroundMethod()
  async addItemFromSignMessage(data: {
    networkId: string;
    accountId: string;
    message: string;
  }) {
    const { networkId, accountId, message } = data;
    const address =
      await this.backgroundApi.serviceAccount.getAccountAddressForApi({
        networkId,
        accountId,
      });
    const getContentType = (str: string): IBaseSignedMessageContentType => {
      try {
        JSON.parse(str);
        return 'json';
      } catch {
        return 'text';
      }
    };
    await this.addSignedMessage({
      networkId,
      address,
      title: 'OneKey Wallet',
      message,
      contentType: getContentType(message),
    });
  }
}

export default ServiceSignature;
