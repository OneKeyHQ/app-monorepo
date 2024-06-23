import { debounce } from 'lodash';

import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import uriUtils from '@onekeyhq/shared/src/utils/uriUtils';
import type { IDappSourceInfo } from '@onekeyhq/shared/types';
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

import localDb from '../dbs/local/localDb';
import { ELocalDBStoreNames } from '../dbs/local/localDBStoreNames';

import ServiceBase from './ServiceBase';

@backgroundClass()
class ServiceSignature extends ServiceBase {
  private debouncedAddConnectedSite:
    | ((url: string, networkIds: string[], addresses: string[]) => void)
    | null = null;

  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
  }

  @backgroundMethod()
  public async addSignedMessage(params: ICreateSignedMessageParams) {
    try {
      await localDb.addSignedMessage(params);
    } catch (e) {
      const errMsg = (e as Error).message;
      defaultLogger.signatureRecord.normal.failToCreateSignedMessage({
        params,
        error: errMsg,
      });
      console.error(errMsg);
    }
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
      items = items
        .filter((item) => {
          if (networkId && item.networkId === networkId) {
            return true;
          }
          if (
            address &&
            item.address.toLowerCase().includes(address.toLowerCase())
          ) {
            return true;
          }
          return false;
        })
        .sort((a, b) => b.createdAt - a.createdAt);
    }
    return items;
  }

  @backgroundMethod()
  public async addSignedTransaction(params: ICreateSignedTransactionParams) {
    try {
      await localDb.addSignedTransaction(params);
    } catch (e: unknown) {
      const errMsg = (e as Error).message;
      defaultLogger.signatureRecord.normal.failToCreateSignedTransaction({
        params,
        error: errMsg,
      });
      console.error(errMsg);
    }
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
      items = items
        .filter((item) => {
          if (networkId && item.networkId === networkId) {
            return true;
          }
          if (
            address &&
            item.address.toLowerCase().includes(address.toLowerCase())
          ) {
            return true;
          }
          return false;
        })
        .sort((a, b) => b.createdAt - a.createdAt);
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

    // Lazy initialization of the debounced function
    if (!this.debouncedAddConnectedSite) {
      this.debouncedAddConnectedSite = debounce(
        this._addConnectedSiteToDb.bind(this),
        500,
      );
    }

    // Avoid repeated calls to dApp or UI hooks
    this.debouncedAddConnectedSite(url, networkIds, addresses);
  }

  private async _addConnectedSiteToDb(
    url: string,
    networkIds: string[],
    addresses: string[],
  ) {
    try {
      await localDb.addConnectedSite({ url, networkIds, addresses });
    } catch (e) {
      const errMsg = (e as Error).message;
      defaultLogger.signatureRecord.normal.failToAddConnectedSite({
        params: { url, networkIds, addresses },
        error: errMsg,
      });
      console.error(errMsg);
    }
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
      return items
        .filter((item) => {
          if (networkId) {
            return item.networkIds.includes(networkId);
          }
          if (address && item.addresses.length) {
            const allAddresses = item.addresses.map((o) => o.toLowerCase());
            return allAddresses.some((o) => o.includes(address.toLowerCase()));
          }
          return false;
        })
        .sort((a, b) => b.createdAt - a.createdAt);
    }
    return items;
  }

  private async addSignedTransactionFromSend(
    data: ISendTxOnSuccessData,
    sourceInfo?: IDappSourceInfo,
  ) {
    const { signedTx, decodedTx } = data;
    const actions = decodedTx.actions;
    const networkId = decodedTx.networkId;
    const address = decodedTx.signer;
    const swapInfo = signedTx.swapInfo;
    let title = 'OneKey Wallet';
    if (sourceInfo?.origin) {
      title = uriUtils.getHostNameFromUrl({ url: sourceInfo?.origin });
    } else if (swapInfo) {
      const providerName = swapInfo.swapBuildResData.result?.info?.providerName;
      if (providerName) {
        title = providerName;
      }
    }
    if (swapInfo) {
      const fromToken = swapInfo.sender.token;
      const toToken = swapInfo.receiver.token;
      await this.addSignedTransaction({
        networkId,
        address,
        title,
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
          title,
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
        title,
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
  async addItemFromSendProcess(
    data: ISendTxOnSuccessData,
    sourceInfo?: IDappSourceInfo,
  ) {
    try {
      await this.addSignedTransactionFromSend(data, sourceInfo);
    } catch (e) {
      console.error(e);
    }
  }

  private async addSignMessageFromDapp(data: {
    networkId: string;
    accountId: string;
    message: string;
    sourceInfo?: IDappSourceInfo;
  }) {
    const { sourceInfo, networkId, accountId, message } = data;
    const title = sourceInfo?.origin
      ? uriUtils.getHostNameFromUrl({ url: sourceInfo?.origin })
      : 'OneKey Wallet';
    const address =
      await this.backgroundApi.serviceAccount.getAccountAddressForApi({
        networkId,
        accountId,
      });
    const getContentType = (str: string): IBaseSignedMessageContentType => {
      try {
        const obj = JSON.parse(str);
        return typeof obj === 'object' ? 'json' : 'text';
      } catch {
        return 'text';
      }
    };
    await this.addSignedMessage({
      networkId,
      address,
      title,
      message,
      contentType: getContentType(message),
    });
  }

  @backgroundMethod()
  async addItemFromSignMessage(data: {
    networkId: string;
    accountId: string;
    message: string;
    sourceInfo?: IDappSourceInfo;
  }) {
    try {
      await this.addSignMessageFromDapp(data);
    } catch (e) {
      console.error(e);
    }
  }

  @backgroundMethod()
  async deleteAllSignatureRecords() {
    await localDb.removeAllSignedTransaction();
    await localDb.removeAllSignedMessage();
    await localDb.removeAllConnectedSite();
  }
}

export default ServiceSignature;
