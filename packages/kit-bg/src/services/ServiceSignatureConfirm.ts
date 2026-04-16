import type { IUnsignedTxPro } from '@onekeyhq/core/src/types';
import {
  backgroundClass,
  backgroundMethod,
  toastIfError,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import {
  convertAddressToSignatureConfirmAddress,
  convertDecodedTxActionsToSignatureConfirmTxDisplayComponents,
  convertDecodedTxActionsToSignatureConfirmTxDisplayTitle,
  convertNetworkToSignatureConfirmNetwork,
} from '@onekeyhq/shared/src/utils/txActionUtils';
import { EServiceEndpointEnum } from '@onekeyhq/shared/types/endpoint';
import type { ITronResourceRentalInfo } from '@onekeyhq/shared/types/fee';
import {
  EParseTxComponentRole,
  EParseTxComponentType,
  EParseTxType,
} from '@onekeyhq/shared/types/signatureConfirm';
import type {
  IAfterSendTxActionParams,
  IParseMessageParams,
  IParseMessageResp,
  IParseTransactionParams,
  IParseTransactionResp,
} from '@onekeyhq/shared/types/signatureConfirm';
import { EEarnLabels } from '@onekeyhq/shared/types/staking';
import { ESwapProvider } from '@onekeyhq/shared/types/swap/SwapProvider.constants';
import type { IDecodedTx, ISendTxBaseParams } from '@onekeyhq/shared/types/tx';

import {
  type IRecentRecipientEntry,
  RECENT_RECIPIENTS_BUCKET_CAP,
} from '../dbs/simple/entity/SimpleDbEntityRecentRecipients';
import { vaultFactory } from '../vaults/factory';

import ServiceBase from './ServiceBase';

import type { IBuildDecodedTxParams } from '../vaults/types';

@backgroundClass()
class ServiceSignatureConfirm extends ServiceBase {
  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
  }

  @backgroundMethod()
  async buildDecodedTxs(
    params: ISendTxBaseParams &
      Omit<IBuildDecodedTxParams, 'unsignedTx'> & {
        unsignedTxs: IUnsignedTxPro[];
      },
  ) {
    const { unsignedTxs, accountId, networkId, ...rest } = params;

    let accountAddress = params.accountAddress;
    if (!accountAddress) {
      accountAddress =
        await this.backgroundApi.serviceAccount.getAccountAddressForApi({
          accountId,
          networkId,
        });
    }
    const isMultiTxs = unsignedTxs.length > 1;
    const r = await Promise.all(
      params.unsignedTxs.map((unsignedTx) =>
        this.buildDecodedTx({
          ...rest,
          accountId,
          networkId,
          accountAddress,
          unsignedTx,
          isMultiTxs,
          sourceInfo: params.sourceInfo,
        }),
      ),
    );

    if (r[0] && r[0].txDisplay && r[0].isLocalParsed) {
      // add network and account info as leading components

      if (r[0].txDisplay.components.length > 0) {
        r[0].txDisplay.components.unshift({
          type: EParseTxComponentType.Divider,
        });
      }

      r[0].txDisplay.components.unshift(
        convertAddressToSignatureConfirmAddress({
          address: accountAddress,
          showAccountName:
            networkUtils.isLightningNetworkByNetworkId(networkId),
        }),
      );

      r[0].txDisplay.components.unshift(
        convertNetworkToSignatureConfirmNetwork({
          networkId,
        }),
      );

      r[0].txDisplay.title =
        convertDecodedTxActionsToSignatureConfirmTxDisplayTitle({
          decodedTxs: r,
          unsignedTxs: params.unsignedTxs,
        });
    }

    return r;
  }

  @backgroundMethod()
  async buildDecodedTx(
    params: ISendTxBaseParams &
      IBuildDecodedTxParams & {
        isMultiTxs?: boolean;
      },
  ): Promise<IDecodedTx> {
    const {
      networkId,
      accountId,
      accountAddress,
      unsignedTx,
      feeInfo,
      transferPayload,
      saveToLocalHistory,
      isMultiTxs,
      sourceInfo,
    } = params;

    let parsedTx: IParseTransactionResp | null = null;

    let disableParseTxThroughApi = false;

    const swapInfo = unsignedTx.swapInfo;

    if (isMultiTxs) {
      disableParseTxThroughApi = true;
    }

    if (swapInfo) {
      const isBridge =
        swapInfo.sender.accountInfo.networkId !==
        swapInfo.receiver.accountInfo.networkId;

      const isSwftOrder = swapInfo.swapBuildResData.swftOrder?.orderId;
      const isChangellyOrder =
        swapInfo.swapBuildResData.changellyOrder?.orderId;

      if (isBridge && (isSwftOrder || isChangellyOrder)) {
        disableParseTxThroughApi = true;
      } else if (
        networkUtils.isTronNetworkByNetworkId(networkId) &&
        (isSwftOrder || isChangellyOrder)
      ) {
        disableParseTxThroughApi = true;
      }
    }

    // if the network is custom network, disable parse tx through api
    if (
      !disableParseTxThroughApi &&
      (await this.backgroundApi.serviceNetwork.isCustomNetwork({ networkId }))
    ) {
      disableParseTxThroughApi = true;
    }

    // try to parse tx through background api
    // multi txs not supported by api for now, will support in future versions
    if (!disableParseTxThroughApi) {
      try {
        parsedTx = await this.parseTransaction({
          networkId,
          accountId,
          accountAddress,
          encodedTx: unsignedTx.encodedTx,
          origin: sourceInfo?.origin,
        });
      } catch (e) {
        console.log('parse tx through api failed', e);
      }
    }

    if (
      parsedTx &&
      (unsignedTx.stakingInfo || unsignedTx.swapInfo) &&
      parsedTx?.type === EParseTxType.Unknown &&
      !unsignedTx.stakingInfo?.tags?.includes(EEarnLabels.Borrow)
    ) {
      parsedTx.display = null;
    }

    const vault = await vaultFactory.getVault({ networkId, accountId });
    const decodedTx = await vault.buildDecodedTx({
      unsignedTx,
      transferPayload,
      saveToLocalHistory,
      isToContract: parsedTx?.parsedTx?.to?.isContract,
    });

    if (feeInfo) {
      decodedTx.totalFeeInNative =
        feeInfo.totalNativeForDisplay ?? feeInfo.totalNative;
      decodedTx.totalFeeFiatValue =
        feeInfo.totalFiatForDisplay ?? feeInfo.totalFiat;
      decodedTx.feeInfo = feeInfo.feeInfo;
    }

    if (parsedTx) {
      decodedTx.isConfirmationRequired = parsedTx.isConfirmationRequired;
      decodedTx.txParseType = parsedTx.type;
    }

    if (parsedTx && parsedTx.parsedTx?.data) {
      decodedTx.txABI = parsedTx.parsedTx?.data;
    }

    if (parsedTx && parsedTx.display) {
      decodedTx.txDisplay = parsedTx.display;
    } else {
      const vaultSettings =
        await this.backgroundApi.serviceNetwork.getVaultSettings({
          networkId,
        });
      // convert decodedTx actions to signatureConfirm txDisplay as fallback
      const txDisplayComponents =
        convertDecodedTxActionsToSignatureConfirmTxDisplayComponents({
          decodedTx,
          isMultiTxs,
          unsignedTx,
          isUTXO: vaultSettings.isUtxo,
        });

      decodedTx.txDisplay = {
        title: '',
        components: txDisplayComponents,
        alerts: [],
      };
      decodedTx.isLocalParsed = true;
    }

    if (transferPayload?.isCustomHexData) {
      decodedTx.isCustomHexData = true;
    }

    return decodedTx;
  }

  @backgroundMethod()
  async parseTransaction(params: IParseTransactionParams) {
    const { accountId, networkId, encodedTx } = params;
    const vault = await vaultFactory.getVault({
      networkId,
      accountId,
    });
    let accountAddress = params.accountAddress;
    if (!accountAddress) {
      accountAddress =
        await this.backgroundApi.serviceAccount.getAccountAddressForApi({
          accountId,
          networkId,
        });
    }

    const { encodedTx: encodedTxToParse } =
      await vault.buildParseTransactionParams({
        encodedTx,
      });

    let xpub: string | undefined;
    try {
      xpub =
        (await this.backgroundApi.serviceAccount.getAccountXpub({
          accountId,
          networkId,
        })) || undefined;
    } catch {
      // non-fatal: backend parses from encodedTx, xpub is an identity hint
    }

    const client = await this.backgroundApi.serviceGas.getClient(
      EServiceEndpointEnum.Wallet,
    );
    const resp = await client.post<{ data: IParseTransactionResp }>(
      '/wallet/v1/account/parse-transaction',
      {
        networkId,
        accountAddress,
        encodedTx: encodedTxToParse,
        xpub,
      },
      {
        headers:
          await this.backgroundApi.serviceAccountProfile._getWalletTypeHeader({
            accountId,
          }),
      },
    );
    return resp.data.data;
  }

  @backgroundMethod()
  async parseMessage(params: IParseMessageParams) {
    const { accountId, networkId, message, swapInfo } = params;

    // if the network is custom network, disable parse message through api
    if (
      await this.backgroundApi.serviceNetwork.isCustomNetwork({ networkId })
    ) {
      return null;
    }

    let accountAddress = params.accountAddress;
    if (!accountAddress) {
      accountAddress =
        await this.backgroundApi.serviceAccount.getAccountAddressForApi({
          accountId,
          networkId,
        });
    }

    let messageToParse = message;
    try {
      messageToParse = JSON.parse(messageToParse);
    } catch (_e) {
      // ignore
    }

    const client = await this.backgroundApi.serviceGas.getClient(
      EServiceEndpointEnum.Wallet,
    );
    try {
      const resp = await client.post<{ data: IParseMessageResp }>(
        '/wallet/v1/account/parse-signature',
        {
          networkId,
          accountAddress,
          data: messageToParse,
        },
        {
          headers:
            await this.backgroundApi.serviceAccountProfile._getWalletTypeHeader(
              {
                accountId,
              },
            ),
        },
      );

      const parsedMessage = resp.data.data;

      if (
        swapInfo &&
        swapInfo.swapBuildResData.result.info.provider ===
          ESwapProvider.Swap1inchFusion
      ) {
        // fix: 1inch fusion receiver address
        parsedMessage?.display?.components?.forEach((component) => {
          if (
            component.type === EParseTxComponentType.Address &&
            component.role === EParseTxComponentRole.SwapReceiver
          ) {
            component.address = swapInfo.receivingAddress;
            component.tags = [];
          }
        });
      }

      return parsedMessage;
    } catch (e) {
      console.log('parse message failed', e);
      return null;
    }
  }

  @toastIfError()
  @backgroundMethod()
  async preActionsBeforeSending(params: {
    accountId: string;
    networkId: string;
    unsignedTxs: IUnsignedTxPro[];
    tronResourceRentalInfo?: ITronResourceRentalInfo;
  }) {
    const { accountId, networkId, unsignedTxs, tronResourceRentalInfo } =
      params;
    const vault = await vaultFactory.getVault({
      networkId,
      accountId,
    });
    return vault.preActionsBeforeSending({
      unsignedTxs,
      tronResourceRentalInfo,
    });
  }

  @backgroundMethod()
  async preActionsBeforeConfirm(params: {
    accountId: string;
    networkId: string;
    unsignedTxs: IUnsignedTxPro[];
  }) {
    const { accountId, networkId, unsignedTxs } = params;
    const vault = await vaultFactory.getVault({ networkId, accountId });
    return vault.preActionsBeforeConfirm({
      unsignedTxs,
    });
  }

  @backgroundMethod()
  async afterSendTxAction(
    params: IAfterSendTxActionParams & {
      networkId: string;
      accountId: string;
    },
  ) {
    const { networkId, accountId, result } = params;
    const vault = await vaultFactory.getVault({ networkId, accountId });
    await vault.afterSendTxAction({
      result,
    });
  }

  @backgroundMethod()
  async updateRecentRecipients({
    networkId,
    accountId,
    address,
    memo,
  }: {
    networkId: string;
    accountId: string;
    address: string;
    memo?: string;
  }) {
    // Resolve to xpub-or-address so two HD wallets wrapping the same mnemonic
    // share the same recent-recipient bucket (OK-53307). Writes land in the
    // currently-active derive type's bucket; getRecentRecipients fans out
    // across all derive types on read.
    const accountIdentity =
      await this.backgroundApi.serviceAccount.getAccountXpubOrAddress({
        accountId,
        networkId,
      });
    if (!accountIdentity) {
      defaultLogger.transaction.send.recentRecipientsSkipWrite({
        accountId,
        networkId,
        reason: 'unresolvedIdentity',
      });
      return;
    }
    await this.backgroundApi.simpleDb.recentRecipients.updateRecentRecipients({
      networkId,
      accountIdentity,
      address,
      updatedAt: Date.now(),
      memo,
    });
  }

  @backgroundMethod()
  async getRecentRecipients({
    networkId,
    accountId,
    limit = 5,
  }: {
    networkId: string;
    accountId: string;
    limit?: number;
  }) {
    // For BTC/LTC merge-derive chains, one user-facing account spans multiple
    // xpubs (Taproot / Native SegWit / ...). Fan out across all of them and
    // merge so the local fallback list isn't bound to whichever derive type
    // is currently active. Mirrors ServiceHistory.fetchTransferRecipients.
    const xpubEntries =
      await this.backgroundApi.serviceAccount.safeGetAccountXpubsForAllDeriveTypes(
        {
          accountId,
          networkId,
        },
      );

    const identities: string[] = xpubEntries
      .map((entry) => entry.xpub)
      .filter((xpub): xpub is string => !!xpub);

    if (identities.length === 0) {
      const fallbackIdentity =
        await this.backgroundApi.serviceAccount.getAccountXpubOrAddress({
          accountId,
          networkId,
        });
      if (!fallbackIdentity) return [];
      identities.push(fallbackIdentity);
    }

    if (identities.length === 1) {
      return this.backgroundApi.simpleDb.recentRecipients.getRecentRecipients({
        networkId,
        accountIdentity: identities[0],
        limit,
      });
    }

    // Read the full per-bucket cap from each xpub so concentration on a single
    // derive path can't starve the merge (mirrors ServiceHistory.fetchTransfer
    // Recipients which fetches `limit` per xpub for the same reason).
    const buckets = await Promise.all(
      identities.map((accountIdentity) =>
        this.backgroundApi.simpleDb.recentRecipients.getRecentRecipients({
          networkId,
          accountIdentity,
          limit: RECENT_RECIPIENTS_BUCKET_CAP,
        }),
      ),
    );

    // Dedupe by recipient address keeping the latest updatedAt. EVM addresses
    // are case-insensitive (checksum variants), so lowercase the dedupe key
    // there. Other chains keep the original case — Solana base58 and Sui /
    // Aptos / TON hex addresses would lose distinct addresses if collapsed.
    const merged = new Map<string, IRecentRecipientEntry>();
    const isEvm = networkUtils.isEvmNetwork({ networkId });
    for (const bucket of buckets) {
      for (const entry of bucket) {
        const key = isEvm ? entry.address.toLowerCase() : entry.address;
        const existing = merged.get(key);
        if (!existing || entry.updatedAt > existing.updatedAt) {
          merged.set(key, entry);
        }
      }
    }

    return [...merged.values()]
      .toSorted((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, limit);
  }
}

export default ServiceSignatureConfirm;
