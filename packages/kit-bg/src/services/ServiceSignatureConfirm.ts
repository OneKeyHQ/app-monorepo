import type { IUnsignedTxPro } from '@onekeyhq/core/src/types';
import {
  backgroundClass,
  backgroundMethod,
  toastIfError,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
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
import { EProtocolOfExchange } from '@onekeyhq/shared/types/swap/types';
import {
  EApproveType,
  type IDecodedTx,
  type ISendTxBaseParams,
} from '@onekeyhq/shared/types/tx';

import {
  type IRecentRecipientEntry,
  RECENT_RECIPIENTS_BUCKET_CAP,
} from '../dbs/simple/entity/SimpleDbEntityRecentRecipients';
import { vaultFactory } from '../vaults/factory';

import ServiceBase from './ServiceBase';

import type { IBuildDecodedTxParams } from '../vaults/types';

function mergeAddressComponentTags(
  results: IParseTransactionResp[],
): IParseTransactionResp {
  const base = results[0];

  if (!base.display?.components?.length) {
    return base;
  }

  base.display.components.forEach((component, index) => {
    if (component.type !== EParseTxComponentType.Address) {
      return;
    }

    const addressComponents = results
      .map((result) => result.display?.components?.[index])
      .filter(
        (candidate): candidate is typeof component =>
          candidate?.type === EParseTxComponentType.Address,
      );

    const preferredTags =
      addressComponents.find((candidate) =>
        candidate.tags?.some((tag) => tag.key === 'transferred'),
      )?.tags ?? addressComponents[0]?.tags;

    if (preferredTags) {
      component.tags = preferredTags;
    }
  });

  return base;
}

function getAddressKey(address?: string) {
  return address?.toLowerCase() ?? '';
}

function isPrivateSendTx({
  transferPayload,
  unsignedTx,
}: {
  transferPayload?: IBuildDecodedTxParams['transferPayload'];
  unsignedTx?: IUnsignedTxPro;
}) {
  return (
    transferPayload?.isPrivateSend === true ||
    unsignedTx?.swapInfo?.protocol === EProtocolOfExchange.PRIVATE_SEND
  );
}

function getPrivateSendTxDisplayTitle() {
  return appLocale.intl.formatMessage({
    id: ETranslations.private_send_private_send,
  });
}

function fixPrivateSendRecipientDisplay({
  decodedTx,
  unsignedTx,
  transferPayload,
}: {
  decodedTx: IDecodedTx;
  unsignedTx: IUnsignedTxPro;
  transferPayload?: IBuildDecodedTxParams['transferPayload'];
}) {
  const originalRecipient =
    transferPayload?.originalRecipient || unsignedTx.swapInfo?.receivingAddress;
  const isPrivateSend = isPrivateSendTx({ transferPayload, unsignedTx });
  if (decodedTx.txDisplay && isPrivateSend) {
    decodedTx.txDisplay.title = getPrivateSendTxDisplayTitle();
  }

  if (
    !isPrivateSend ||
    !decodedTx.txDisplay?.components?.length ||
    !originalRecipient
  ) {
    return;
  }

  const originalRecipientKey = getAddressKey(originalRecipient);
  const payinAddresses = new Set<string>();
  const addPayinAddress = (address?: string) => {
    const key = getAddressKey(address);
    if (key && key !== originalRecipientKey) {
      payinAddresses.add(key);
    }
  };

  addPayinAddress(transferPayload?.privateSend?.payinAddress);
  addPayinAddress(
    unsignedTx.swapInfo?.swapBuildResData.changellyOrder?.payinAddress,
  );
  // EVM token/private-send transactions target token or router contracts; only
  // explicit transfer recipients should be rewritten to the original recipient.
  decodedTx.actions.forEach((action) => {
    if (action.assetTransfer) {
      action.assetTransfer.sends.forEach((send) => addPayinAddress(send.to));
    }
  });
  decodedTx.outputActions?.forEach((action) => {
    if (action.assetTransfer) {
      action.assetTransfer.sends.forEach((send) => addPayinAddress(send.to));
    }
  });

  decodedTx.txDisplay.components = decodedTx.txDisplay.components.map(
    (component) => {
      if (component.type !== EParseTxComponentType.Address) {
        return component;
      }

      const shouldUseOriginalRecipient =
        component.role === EParseTxComponentRole.SwapReceiver ||
        payinAddresses.has(getAddressKey(component.address));
      if (!shouldUseOriginalRecipient) {
        return component;
      }

      return {
        ...component,
        label: appLocale.intl.formatMessage({ id: ETranslations.global_to }),
        address: originalRecipient,
        tags: [],
        isNavigable: false,
        highlight: true,
      };
    },
  );
}

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

    if (
      r[0]?.txDisplay &&
      params.unsignedTxs.some((unsignedTx) =>
        isPrivateSendTx({
          transferPayload: params.transferPayload,
          unsignedTx,
        }),
      )
    ) {
      r[0].txDisplay.title = getPrivateSendTxDisplayTitle();
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

    // Backfill approveType/spender/amount on server-built Approve components
    // from the local decoder, which always reflects current calldata (the
    // server's amountParsed lags re-encoding after the user edits the delta).
    if (decodedTx.txDisplay?.components) {
      const localApproves = decodedTx.actions
        .map((a) => a.tokenApprove)
        .filter((a): a is NonNullable<typeof a> => Boolean(a));
      if (localApproves.length > 0) {
        const localByToken = new Map<string, (typeof localApproves)[number]>();
        for (const a of localApproves) {
          if (a.tokenIdOnNetwork) {
            localByToken.set(a.tokenIdOnNetwork.toLowerCase(), a);
          }
        }
        // Prevent double-attribution: token-keyed hits must not be re-handed
        // out by the positional fallback to a later component.
        const usedLocal = new Set<(typeof localApproves)[number]>();
        let fallbackIdx = 0;
        for (const c of decodedTx.txDisplay.components) {
          if (c.type === EParseTxComponentType.Approve) {
            const tokenAddr = c.token?.info?.address?.toLowerCase();
            let localApprove: (typeof localApproves)[number] | undefined;
            const byToken = tokenAddr ? localByToken.get(tokenAddr) : undefined;
            if (byToken && !usedLocal.has(byToken)) {
              localApprove = byToken;
            } else {
              while (
                fallbackIdx < localApproves.length &&
                usedLocal.has(localApproves[fallbackIdx])
              ) {
                fallbackIdx += 1;
              }
              localApprove = localApproves[fallbackIdx];
              fallbackIdx += 1;
            }
            if (localApprove) {
              usedLocal.add(localApprove);
              if (!c.approveType && localApprove.approveType) {
                c.approveType = localApprove.approveType;
              }
              if (!c.spender && localApprove.spender) {
                c.spender = localApprove.spender;
              }
              const localApproveType =
                localApprove.approveType ?? c.approveType;
              if (
                localApproveType === EApproveType.IncreaseAllowance ||
                localApproveType === EApproveType.IncreaseApproval
              ) {
                c.amountParsed = localApprove.amount;
              }
            }
          }
        }
      }
    }

    fixPrivateSendRecipientDisplay({
      decodedTx,
      unsignedTx,
      transferPayload,
    });

    if (transferPayload?.isCustomHexData) {
      decodedTx.isCustomHexData = true;
    }

    return decodedTx;
  }

  @backgroundMethod()
  async parseTransaction(params: IParseTransactionParams) {
    const { accountId, networkId, encodedTx, origin } = params;
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

    // For BTC/LTC merge-derive accounts, the server's parse-transaction
    // API only accepts a single xpub per call. Call once per derive type
    // and merge interaction results (same as fetchBadgesDeduped).
    let xpubs: string[] = [];
    try {
      const xpubEntries =
        await this.backgroundApi.serviceAccount.safeGetAccountXpubsForAllDeriveTypes(
          { accountId, networkId },
        );
      xpubs = xpubEntries.map((e) => e.xpub).filter((x): x is string => !!x);
    } catch {
      // non-fatal
    }
    if (xpubs.length === 0) {
      try {
        const singleXpub =
          (await this.backgroundApi.serviceAccount.getAccountXpub({
            accountId,
            networkId,
          })) || undefined;
        if (singleXpub) {
          xpubs = [singleXpub];
        }
      } catch {
        // non-fatal
      }
    }

    const client = await this.backgroundApi.serviceGas.getClient(
      EServiceEndpointEnum.Wallet,
    );
    const walletTypeHeaders =
      await this.backgroundApi.serviceAccountProfile._getWalletTypeHeader({
        accountId,
      });

    const callParseTransaction = async (xpub?: string) => {
      const resp = await client.post<{ data: IParseTransactionResp }>(
        '/wallet/v1/account/parse-transaction',
        {
          networkId,
          accountAddress,
          encodedTx: encodedTxToParse,
          xpub,
          origin,
        },
        { headers: walletTypeHeaders },
      );
      return resp.data.data;
    };

    if (xpubs.length <= 1) {
      return callParseTransaction(xpubs[0]);
    }

    // Multiple xpubs: call once per xpub, merge interaction results.
    const settled = await Promise.allSettled(
      xpubs.map((xpub) => callParseTransaction(xpub)),
    );
    const validResults = settled
      .filter(
        (r): r is PromiseFulfilledResult<IParseTransactionResp> =>
          r.status === 'fulfilled',
      )
      .map((r) => r.value);
    if (validResults.length === 0) {
      // All xpub-scoped calls failed; retry without xpub so the server
      // still parses the tx from encodedTx alone.
      return callParseTransaction(undefined);
    }
    // Use the first result as base, merge riskLevel across xpubs
    // (take the highest risk seen from any derive path).
    const base = mergeAddressComponentTags(validResults);
    if (base.parsedTx?.to) {
      const maxRiskLevel = Math.max(
        ...validResults.map((r) => r.parsedTx?.to?.riskLevel ?? 0),
      );
      if (maxRiskLevel > (base.parsedTx.to.riskLevel ?? 0)) {
        base.parsedTx.to.riskLevel = maxRiskLevel;
      }
    }
    return base;
  }

  @backgroundMethod()
  async parseMessage(params: IParseMessageParams) {
    const { accountId, networkId, message, swapInfo, origin } = params;

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
          origin,
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
