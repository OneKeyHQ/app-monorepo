import { Mutex } from 'async-mutex';
import { debounce } from 'lodash';

import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
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
import { ETransactionType } from '@onekeyhq/shared/types/signatureRecord';
import type { ISendTxOnSuccessData } from '@onekeyhq/shared/types/tx';
import { EDecodedTxActionType } from '@onekeyhq/shared/types/tx';

import localDb from '../dbs/local/localDb';
import { ELocalDBStoreNames } from '../dbs/local/localDBStoreNames';
import { getVaultSettings, getVaultSettingsImpls } from '../vaults/settings';

import ServiceBase from './ServiceBase';

@backgroundClass()
class ServiceSignature extends ServiceBase {
  // The archive row and its ID counter are written in different DB buckets.
  private transactionArchiveMutex = new Mutex();

  private zcashArchiveGeneration = new Map<string, number>();

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
    const { networkId: _networkId, address, limit, offset } = params ?? {};
    const networkId =
      _networkId !== getNetworkIdsMap().onekeyall ? _networkId : undefined;
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
          let match = true;
          if (networkId) {
            match = item.networkId === networkId;
          }
          if (match && address) {
            match = item.address.toLowerCase().includes(address.toLowerCase());
          }
          return match;
        })
        .toSorted((a, b) => b.createdAt - a.createdAt);
    }
    return items;
  }

  @backgroundMethod()
  public async addSignedTransaction(params: ICreateSignedTransactionParams) {
    try {
      await this.transactionArchiveMutex.runExclusive(() =>
        localDb.addSignedTransaction(params),
      );
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
    const { networkId: _networkId, address, limit, offset } = params ?? {};
    const networkId =
      _networkId !== getNetworkIdsMap().onekeyall ? _networkId : undefined;
    const isSearch = Boolean(networkId || address);
    const { records } = await localDb.getAllRecords({
      name: ELocalDBStoreNames.SignedTransaction,
    });
    const { networks } =
      await this.backgroundApi.serviceNetwork.getAllNetworks();
    const supportedImpls = new Set(getVaultSettingsImpls());
    const networkById = new Map(
      networks
        .filter((network) => supportedImpls.has(network.impl))
        .map((network) => [network.id, network]),
    );
    // Unsupported old records must not poison a selected network or consume a page.
    let selected = records
      .filter(
        (item) =>
          networkById.has(item.networkId) &&
          (!networkId || item.networkId === networkId) &&
          (!address ||
            item.address.toLowerCase().includes(address.toLowerCase())),
      )
      .toSorted((a, b) => b.createdAt - a.createdAt);
    if (!isSearch) {
      selected = selected.slice(
        offset ?? 0,
        limit === undefined ? undefined : (offset ?? 0) + limit,
      );
    }
    const promises = selected.map(async (item) => {
      const { dataStringify, ...rest } = item;
      const data = JSON.parse(dataStringify) as ISignedTransaction['data'];
      const network = networkById.get(item.networkId)!;
      const vaultSettings =
        await this.backgroundApi.serviceNetwork.getVaultSettings({
          networkId: network.id,
        });
      return {
        ...rest,
        data,
        network,
        vaultSettings,
      };
    });
    return Promise.all(promises);
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
  public async getFirstConnectedSites() {
    const { records } = await localDb.getAllRecords({
      name: ELocalDBStoreNames.ConnectedSite,
    });
    return records?.[0];
  }

  @backgroundMethod()
  public async getAllConnectedSites(query?: {
    limit?: number;
    offset?: number;
  }) {
    const { records } = await localDb.getAllRecords({
      name: ELocalDBStoreNames.ConnectedSite,
      limit: query?.limit,
      offset: query?.offset,
    });
    return records;
  }

  @backgroundMethod()
  public async getAllConnectedSitesCount() {
    return localDb.getRecordsCount({
      name: ELocalDBStoreNames.ConnectedSite,
    });
  }

  @backgroundMethod()
  public async getConnectedSites(
    params?: ISignatureItemQueryParams,
  ): Promise<IConnectedSite[]> {
    const { networkId: _networkId, address, limit, offset } = params ?? {};
    const networkId =
      _networkId !== getNetworkIdsMap().onekeyall ? _networkId : undefined;
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
          let match = true;
          if (networkId) {
            match = item.networkIds.includes(networkId);
          }
          if (match && address) {
            if (item.addresses.length) {
              const allAddresses = item.addresses.map((o) => o.toLowerCase());
              match = allAddresses.some((o) =>
                o.includes(address.toLowerCase()),
              );
            } else {
              match = false;
            }
          }
          return match;
        })
        .toSorted((a, b) => b.createdAt - a.createdAt);
    }
    return items;
  }

  private async addSignedTransactionFromSend(
    data: ISendTxOnSuccessData,
    sourceInfo?: IDappSourceInfo,
    privacyChainAccountId?: string,
    signatureEpoch?: string,
  ) {
    const addRecord = async (params: ICreateSignedTransactionParams) => {
      if (privacyChainAccountId) {
        await localDb.addSignedTransaction({
          ...params,
          data: {
            ...params.data,
            privacyChainAccountId,
            ...(signatureEpoch ? { privacyChainEpoch: signatureEpoch } : {}),
          },
        });
      } else {
        await this.addSignedTransaction(params);
      }
    };
    const { signedTx, decodedTx } = data;
    const actions = decodedTx.actions;
    const networkId = decodedTx.networkId;
    const address = decodedTx.signer;
    const swapInfo = signedTx.swapInfo;
    const stakingInfo = signedTx.stakingInfo;
    let title = 'OneKey Wallet';
    if (sourceInfo?.origin) {
      title = uriUtils.getHostNameFromUrl({ url: sourceInfo?.origin });
    } else if (swapInfo) {
      const providerName = swapInfo.swapBuildResData.result?.info?.providerName;
      if (providerName) {
        title = providerName;
      }
    } else if (stakingInfo) {
      title = stakingInfo.protocol;
    }
    if (swapInfo) {
      const fromToken = swapInfo.sender.token;
      const toToken = swapInfo.receiver.token;
      await addRecord({
        networkId,
        address,
        title,
        hash: signedTx.txid,
        data: {
          type: ETransactionType.SWAP,
          fromNetworkId: fromToken.networkId,
          toNetworkId: toToken.networkId,
          fromAmount: swapInfo.sender.amount,
          toAmount: swapInfo.receiver.amount,
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
    if (stakingInfo) {
      await addRecord({
        networkId,
        address,
        title,
        hash: signedTx.txid,
        data: {
          type: ETransactionType.EARN,
          label: stakingInfo.label,
          send: stakingInfo.send,
          receive: stakingInfo.receive,
        },
      });
      return;
    }
    if (actions.length < 1) {
      return;
    }
    const approveAction = actions.find(
      (action) => action.type === EDecodedTxActionType.TOKEN_APPROVE,
    );
    if (approveAction && approveAction.tokenApprove) {
      const tokenApprove = approveAction.tokenApprove;
      if (tokenApprove) {
        await addRecord({
          networkId,
          address,
          title,
          hash: signedTx.txid,
          data: {
            type: ETransactionType.APPROVE,
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
      const tokens = transferAction.assetTransfer.sends;
      const tokenSent = tokens.find((token) => !token.isNative) || tokens[0];
      if (tokenSent) {
        await addRecord({
          networkId,
          address,
          title,
          hash: signedTx.txid,
          data: {
            type: ETransactionType.SEND,
            amount: tokenSent.amount,
            token: {
              name: tokenSent.name,
              symbol: tokenSent.symbol,
              address: tokenSent.tokenIdOnNetwork,
              logoURI: tokenSent.icon,
            },
          },
        });
        return;
      }
    }
    await addRecord({
      networkId,
      address,
      title,
      hash: signedTx.txid,
      data: {
        type: ETransactionType.CONTRACT_INTERACTION,
      },
    });
  }

  @backgroundMethod()
  async addItemFromSendProcess(
    data: ISendTxOnSuccessData,
    sourceInfo?: IDappSourceInfo,
    zcashSignatureContext?: { generation: number; signatureEpoch?: string },
  ) {
    const isZcash = data.decodedTx.networkId === getNetworkIdsMap().zec;
    try {
      if (isZcash) {
        const { accountId } = data.decodedTx;
        if (!accountId) return;
        const context =
          zcashSignatureContext ??
          (await this.getZcashSignatureRecordContext(accountId));
        await this.transactionArchiveMutex.runExclusive(async () => {
          if (
            context.generation !==
              this.getZcashSignatureRecordGeneration(accountId) ||
            context.signatureEpoch !==
              (await this.backgroundApi.simpleDb.privacyChainState.getAccountSignatureEpoch(
                { accountId },
              )) ||
            !(await this.backgroundApi.serviceAccount.getDBAccountSafe({
              accountId,
            }))
          )
            return;
          await this.addSignedTransactionFromSend(
            data,
            sourceInfo,
            accountId,
            context.signatureEpoch,
          );
        });
        return;
      }
      const settings = await getVaultSettings({
        networkId: data.decodedTx.networkId,
      });
      if (settings.localWallet) {
        return;
      }
      await this.addSignedTransactionFromSend(data, sourceInfo);
    } catch (e) {
      if (isZcash) {
        // Recording must not turn an already broadcast payment into a retry.
        console.error('[zcash] signature archive write failed');
      } else {
        console.error(e);
      }
    }
  }

  // In-flight sends cannot outlive this background JS runtime. Full removal
  // and Clear all use this fence; privacy deletion has its own persisted epoch.
  getZcashSignatureRecordGeneration(accountId: string): number {
    const generation = this.zcashArchiveGeneration.get(accountId) ?? 0;
    this.zcashArchiveGeneration.set(accountId, generation);
    return generation;
  }

  async getZcashSignatureRecordContext(
    accountId: string,
  ): Promise<{ generation: number; signatureEpoch?: string }> {
    const generation = this.getZcashSignatureRecordGeneration(accountId);
    const signatureEpoch =
      await this.backgroundApi.simpleDb.privacyChainState.getAccountSignatureEpoch(
        { accountId },
      );
    return { generation, signatureEpoch };
  }

  async listZcashSignedTransactionAccountIds(): Promise<string[]> {
    return localDb.listSignedTransactionAccountIds({
      networkId: getNetworkIdsMap().zec,
    });
  }

  // Everything this device recorded about what the account signed. The chain
  // history stays: it is public and the backend owns it.
  @backgroundMethod()
  async removeSignedTransactionsForAccount({
    networkId,
    accountId,
    deletionRequestId,
  }: {
    networkId: string;
    accountId: string;
    deletionRequestId?: string;
  }): Promise<void> {
    if (networkId === getNetworkIdsMap().zec) {
      await this.transactionArchiveMutex.runExclusive(async () => {
        if (deletionRequestId) {
          if (
            !(await this.backgroundApi.simpleDb.privacyChainState.isAccountDeletionPending(
              { accountId, requestId: deletionRequestId },
            ))
          )
            return;
        } else {
          this.zcashArchiveGeneration.set(
            accountId,
            this.getZcashSignatureRecordGeneration(accountId) + 1,
          );
        }
        const account =
          await this.backgroundApi.serviceAccount.getDBAccountSafe({
            accountId,
          });
        const address = account
          ? await this.backgroundApi.serviceAccount.getAccountAddressForApi({
              networkId,
              accountId,
            })
          : undefined;
        await localDb.removeSignedTransactions({
          networkId,
          accountId,
          address,
          ...(deletionRequestId
            ? { preservePrivacyChainEpoch: deletionRequestId }
            : {}),
        });
      });
      return;
    }
    const address =
      await this.backgroundApi.serviceAccount.getAccountAddressForApi({
        networkId,
        accountId,
      });
    if (!address) {
      return;
    }
    await this.transactionArchiveMutex.runExclusive(() =>
      localDb.removeSignedTransactions({ networkId, address }),
    );
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
    for (const [accountId, generation] of this.zcashArchiveGeneration) {
      this.zcashArchiveGeneration.set(accountId, generation + 1);
    }
    await this.transactionArchiveMutex.runExclusive(async () => {
      await localDb.removeAllSignedTransaction();
      await localDb.removeAllSignedMessage();
      await localDb.removeAllConnectedSite();
    });
  }
}

export default ServiceSignature;
