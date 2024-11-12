import BigNumber from 'bignumber.js';
import { cloneDeep, isNil } from 'lodash';

import type {
  IEncodedTx,
  IUnsignedMessage,
  IUnsignedTxPro,
} from '@onekeyhq/core/src/types';
import {
  backgroundClass,
  backgroundMethod,
  toastIfError,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { HISTORY_CONSTS } from '@onekeyhq/shared/src/engine/engineConsts';
import { PendingQueueTooLong } from '@onekeyhq/shared/src/errors';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { getValidUnsignedMessage } from '@onekeyhq/shared/src/utils/messageUtils';
import { generateUUID } from '@onekeyhq/shared/src/utils/miscUtils';
import { EServiceEndpointEnum } from '@onekeyhq/shared/types/endpoint';
import type {
  IFeeInfoUnit,
  ISendSelectedFeeInfo,
} from '@onekeyhq/shared/types/fee';
import type {
  ESendPreCheckTimingEnum,
  IParseTransactionResp,
} from '@onekeyhq/shared/types/send';
import { EReasonForNeedPassword } from '@onekeyhq/shared/types/setting';
import type { IFetchTokenDetailItem } from '@onekeyhq/shared/types/token';
import type {
  EReplaceTxType,
  IDecodedTx,
  ISendTxBaseParams,
  ISendTxOnSuccessData,
} from '@onekeyhq/shared/types/tx';

import { vaultFactory } from '../vaults/factory';

import ServiceBase from './ServiceBase';

import type {
  IBatchSignTransactionParamsBase,
  IBroadcastTransactionParams,
  IBuildDecodedTxParams,
  IBuildUnsignedTxParams,
  INativeAmountInfo,
  IPreCheckFeeInfoParams,
  ISignTransactionParamsBase,
  ITokenApproveInfo,
  IUpdateUnsignedTxParams,
} from '../vaults/types';

@backgroundClass()
class ServiceSend extends ServiceBase {
  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
  }

  @backgroundMethod()
  async buildDecodedTx(
    params: ISendTxBaseParams & IBuildDecodedTxParams,
  ): Promise<IDecodedTx> {
    const { networkId, accountId, unsignedTx, feeInfo, transferPayload } =
      params;
    const vault = await vaultFactory.getVault({ networkId, accountId });
    const decodedTx = await vault.buildDecodedTx({
      unsignedTx,
      transferPayload,
    });

    if (feeInfo) {
      decodedTx.totalFeeInNative =
        feeInfo.totalNativeForDisplay ?? feeInfo.totalNative;
      decodedTx.totalFeeFiatValue =
        feeInfo.totalFiatForDisplay ?? feeInfo.totalFiat;
      decodedTx.feeInfo = feeInfo.feeInfo;
    }

    return decodedTx;
  }

  @backgroundMethod()
  public async buildUnsignedTx(
    params: ISendTxBaseParams & IBuildUnsignedTxParams,
  ) {
    const {
      networkId,
      accountId,
      encodedTx,
      transfersInfo,
      approveInfo,
      wrappedInfo,
      specifiedFeeRate,
      prevNonce,
      feeInfo,
    } = params;
    const vault = await vaultFactory.getVault({ networkId, accountId });
    return vault.buildUnsignedTx({
      encodedTx,
      transfersInfo,
      approveInfo,
      wrappedInfo,
      specifiedFeeRate,
      prevNonce,
      feeInfo,
    });
  }

  @backgroundMethod()
  public async updateUnsignedTx(
    params: ISendTxBaseParams & IUpdateUnsignedTxParams,
  ) {
    const { networkId, accountId, unsignedTx, ...rest } = params;
    const vault = await vaultFactory.getVault({ networkId, accountId });
    return vault.updateUnsignedTx({
      unsignedTx: cloneDeep(unsignedTx),
      ...rest,
    });
  }

  @backgroundMethod()
  public async buildReplaceEncodedTx(params: {
    accountId: string;
    networkId: string;
    decodedTx: IDecodedTx;
    replaceType: EReplaceTxType;
  }) {
    const { networkId, accountId, ...rest } = params;
    const vault = await vaultFactory.getVault({ networkId, accountId });
    return vault.buildReplaceEncodedTx({ ...rest });
  }

  @backgroundMethod()
  public async broadcastTransaction(params: IBroadcastTransactionParams) {
    const { accountId, networkId, signedTx, accountAddress, signature } =
      params;

    // check if the network has custom rpc
    const customRpcInfo =
      await this.backgroundApi.serviceCustomRpc.getCustomRpcForNetwork(
        params.networkId,
      );
    let disableBroadcast: boolean | undefined;
    let txid = '';
    if (customRpcInfo?.rpc && customRpcInfo?.enabled) {
      disableBroadcast = true;
      const vault = await vaultFactory.getVault({ accountId, networkId });
      const result = await vault.broadcastTransactionFromCustomRpc({
        ...params,
        customRpcInfo,
      });
      txid = result.txid;
    }

    const client = await this.getClient(EServiceEndpointEnum.Wallet);
    const resp = await client.post<{
      data: { result: string };
    }>(
      '/wallet/v1/account/send-transaction',
      {
        networkId,
        accountAddress,
        tx: signedTx.rawTx,
        signature,
        disableBroadcast,
      },
      {
        headers:
          await this.backgroundApi.serviceAccountProfile._getWalletTypeHeader({
            accountId,
          }),
      },
    );
    if (!disableBroadcast) {
      txid = resp.data.data.result;
    }

    return txid;
  }

  @backgroundMethod()
  public async preCheckIsFeeInfoOverflow(params: IPreCheckFeeInfoParams) {
    try {
      const isCustomNetwork =
        await this.backgroundApi.serviceNetwork.isCustomNetwork({
          networkId: params.networkId,
        });
      // custom network will skip pre-check
      if (isCustomNetwork) {
        return false;
      }
      const client = await this.getClient(EServiceEndpointEnum.Wallet);
      const resp = await client.post<{
        data: { success: boolean };
      }>('/wallet/v1/account/pre-send-transaction', params);

      return !resp.data.data.success;
    } catch {
      // pre-check failed, return true to show fee info alert by default
      return true;
    }
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
  @toastIfError()
  public async signTransaction(
    params: ISendTxBaseParams & ISignTransactionParamsBase,
  ) {
    const { networkId, accountId, unsignedTx, signOnly } = params;
    const vault = await vaultFactory.getVault({ networkId, accountId });
    const { password, deviceParams } =
      await this.backgroundApi.servicePassword.promptPasswordVerifyByAccount({
        accountId,
        reason: EReasonForNeedPassword.CreateTransaction,
      });
    // signTransaction
    const tx =
      await this.backgroundApi.serviceHardwareUI.withHardwareProcessing(
        async () => {
          const signedTx = await vault.signTransaction({
            unsignedTx,
            password,
            deviceParams,
            signOnly,
          });
          console.log('signTx@vault.signTransaction', signedTx);
          return signedTx;
        },
        { deviceParams, debugMethodName: 'serviceSend.signTransaction' },
      );

    console.log('signTx@serviceSend.signTransaction', tx);

    tx.swapInfo = unsignedTx.swapInfo;
    tx.stakingInfo = unsignedTx.stakingInfo;
    tx.uuid = unsignedTx.uuid;
    return tx;
  }

  @backgroundMethod()
  public async signAndSendTransaction(
    params: ISendTxBaseParams & ISignTransactionParamsBase,
  ) {
    const { networkId, accountId, unsignedTx, signOnly } = params;

    const accountAddress =
      await this.backgroundApi.serviceAccount.getAccountAddressForApi({
        accountId,
        networkId,
      });

    const signedTx = await this.signTransaction({
      networkId,
      accountId,
      unsignedTx,
      signOnly, // external account should send tx here
    });

    const devSetting =
      await this.backgroundApi.serviceDevSetting.getDevSetting();
    const vaultSettings =
      await this.backgroundApi.serviceNetwork.getVaultSettings({ networkId });
    const alwaysSignOnlySendTxInDev =
      devSetting?.settings?.alwaysSignOnlySendTx;

    // skip external account send, as rawTx is empty
    if (
      !alwaysSignOnlySendTxInDev &&
      !signOnly &&
      !accountUtils.isExternalAccount({
        accountId,
      })
    ) {
      const vault = await vaultFactory.getVault({
        networkId,
        accountId,
      });
      const { txid } = await vault.broadcastTransaction({
        accountId,
        networkId,
        accountAddress,
        signedTx,
      });
      if (!txid) {
        if (vaultSettings.withoutBroadcastTxId) {
          return signedTx;
        }
        throw new Error('Broadcast transaction failed.');
      }
      return { ...signedTx, txid };
    }

    return signedTx;
  }

  @backgroundMethod()
  @toastIfError()
  public async updateUnSignedTxBeforeSend({
    accountId,
    networkId,
    feeInfos: sendSelectedFeeInfos,
    nativeAmountInfo,
    unsignedTxs,
    tokenApproveInfo,
    nonceInfo,
  }: ISendTxBaseParams & {
    unsignedTxs: IUnsignedTxPro[];
    tokenApproveInfo?: ITokenApproveInfo;
    feeInfos?: ISendSelectedFeeInfo[];
    nativeAmountInfo?: INativeAmountInfo;
    nonceInfo?: { nonce: number };
  }) {
    const newUnsignedTxs = [];
    for (let i = 0, len = unsignedTxs.length; i < len; i += 1) {
      const unsignedTx = unsignedTxs[i];
      const feeInfo = sendSelectedFeeInfos?.[i]?.feeInfo;

      const newUnsignedTx = await this.updateUnsignedTx({
        accountId,
        networkId,
        unsignedTx,
        feeInfo,
        nativeAmountInfo,
        tokenApproveInfo,
        nonceInfo,
      });

      newUnsignedTxs.push(newUnsignedTx);
    }
    return newUnsignedTxs;
  }

  @backgroundMethod()
  @toastIfError()
  public async batchSignAndSendTransaction(
    params: ISendTxBaseParams & IBatchSignTransactionParamsBase,
  ) {
    const {
      networkId,
      accountId,
      unsignedTxs,
      signOnly,
      sourceInfo,
      feeInfos: sendSelectedFeeInfos,
      replaceTxInfo,
      transferPayload,
      successfullySentTxs,
    } = params;

    const isMultiTxs = unsignedTxs.length > 1;

    const result: ISendTxOnSuccessData[] = [];
    for (let i = 0, len = unsignedTxs.length; i < len; i += 1) {
      const unsignedTx = unsignedTxs[i];
      const feeInfo = sendSelectedFeeInfos?.[i];
      if (
        !successfullySentTxs ||
        !unsignedTx.uuid ||
        !successfullySentTxs.includes(unsignedTx.uuid)
      ) {
        const signedTx = signOnly
          ? await this.signTransaction({
              unsignedTx,
              accountId,
              networkId,
              signOnly: true,
            })
          : await this.signAndSendTransaction({
              unsignedTx,
              networkId,
              accountId,
              signOnly: false,
            });
        const decodedTx = await this.buildDecodedTx({
          networkId,
          accountId,
          unsignedTx,
          feeInfo,
          transferPayload,
        });

        const data = {
          signedTx,
          decodedTx,
          feeInfo: feeInfo?.feeInfo,
          approveInfo: unsignedTx.approveInfo,
        };

        // only fill swap(staking) tx info for batch approve&swap(staking) callback
        if (
          !isMultiTxs ||
          (isMultiTxs && (unsignedTx.swapInfo || unsignedTx.stakingInfo))
        ) {
          result.push(data);
        }

        await this.backgroundApi.serviceSignature.addItemFromSendProcess(
          data,
          sourceInfo,
        );
        if (signedTx && !signOnly) {
          await this.backgroundApi.serviceHistory.saveSendConfirmHistoryTxs({
            networkId,
            accountId,
            data: {
              signedTx,
              decodedTx,
            },
            replaceTxInfo,
          });
        }

        if (!signOnly && unsignedTx.uuid && successfullySentTxs) {
          successfullySentTxs.push(unsignedTx.uuid);
        }
      }
    }

    return result;
  }

  @backgroundMethod()
  public async getNextNonce({
    accountId,
    networkId,
    accountAddress,
  }: {
    accountId: string;
    networkId: string;
    accountAddress: string;
  }) {
    const { nonce: onChainNextNonce } =
      await this.backgroundApi.serviceAccountProfile.fetchAccountDetails({
        networkId,
        accountId,
        withNonce: true,
      });
    if (isNil(onChainNextNonce)) {
      throw new Error('Get on-chain nonce failed.');
    }

    const maxPendingNonce =
      await this.backgroundApi.simpleDb.localHistory.getMaxPendingNonce({
        accountAddress,
        networkId,
      });
    const pendingNonceList =
      await this.backgroundApi.simpleDb.localHistory.getPendingNonceList({
        accountAddress,
        networkId,
      });
    let nextNonce = Math.max(
      isNil(maxPendingNonce) ? 0 : maxPendingNonce + 1,
      onChainNextNonce,
    );
    if (Number.isNaN(nextNonce)) {
      nextNonce = onChainNextNonce;
    }
    if (nextNonce > onChainNextNonce) {
      for (let i = onChainNextNonce; i < nextNonce; i += 1) {
        if (!pendingNonceList.includes(i)) {
          nextNonce = i;
          break;
        }
      }
    }

    if (nextNonce < onChainNextNonce) {
      nextNonce = onChainNextNonce;
    }

    if (
      nextNonce - onChainNextNonce >=
      HISTORY_CONSTS.PENDING_QUEUE_MAX_LENGTH
    ) {
      throw new PendingQueueTooLong(HISTORY_CONSTS.PENDING_QUEUE_MAX_LENGTH);
    }

    return nextNonce;
  }

  @backgroundMethod()
  @toastIfError()
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
      wrappedInfo,
      swapInfo,
      stakingInfo,
      specifiedFeeRate,
      prevNonce,
      feeInfo,
    } = params;

    let newUnsignedTx = unsignedTx;

    const account = await this.backgroundApi.serviceAccount.getAccount({
      accountId,
      networkId,
    });

    if (!newUnsignedTx) {
      newUnsignedTx = await this.buildUnsignedTx({
        networkId,
        accountId,
        encodedTx,
        approveInfo,
        transfersInfo,
        wrappedInfo,
        specifiedFeeRate,
        prevNonce,
        feeInfo,
      });
    }
    if (swapInfo) {
      newUnsignedTx.swapInfo = swapInfo;
    }
    if (stakingInfo) {
      newUnsignedTx.stakingInfo = stakingInfo;
    }

    if (approveInfo) {
      newUnsignedTx.approveInfo = approveInfo;
    }

    if (feeInfo) {
      newUnsignedTx.feeInfo = feeInfo;
    }

    const isNonceRequired = (
      await this.backgroundApi.serviceNetwork.getVaultSettings({
        networkId,
      })
    ).nonceRequired;

    if (isNonceRequired && new BigNumber(newUnsignedTx.nonce ?? 0).isZero()) {
      const nonce = await this.backgroundApi.serviceSend.getNextNonce({
        accountId,
        networkId,
        accountAddress: account.address,
      });

      newUnsignedTx = await this.backgroundApi.serviceSend.updateUnsignedTx({
        accountId,
        networkId,
        unsignedTx: newUnsignedTx,
        nonceInfo: { nonce },
      });
    }

    newUnsignedTx.uuid = generateUUID();

    return newUnsignedTx;
  }

  @backgroundMethod()
  @toastIfError()
  async signMessage({
    unsignedMessage,
    networkId,
    accountId,
  }: {
    unsignedMessage?: IUnsignedMessage;
    networkId: string;
    accountId: string;
  }) {
    const vault = await vaultFactory.getVault({
      networkId,
      accountId,
    });

    let validUnsignedMessage = unsignedMessage;
    if (unsignedMessage) {
      // TODO fix message format and params in vault
      validUnsignedMessage = getValidUnsignedMessage(unsignedMessage);
    }

    if (!validUnsignedMessage) {
      throw new Error('Invalid unsigned message');
    }

    const { password, deviceParams } =
      await this.backgroundApi.servicePassword.promptPasswordVerifyByAccount({
        accountId,
        reason: EReasonForNeedPassword.CreateTransaction,
      });
    const signedMessage =
      await this.backgroundApi.serviceHardwareUI.withHardwareProcessing(
        async () => {
          const [_signedMessage] = await vault.keyring.signMessage({
            messages: [validUnsignedMessage as IUnsignedMessage],
            password,
            deviceParams,
          });
          return _signedMessage;
        },
        { deviceParams, debugMethodName: 'serviceSend.signMessage' },
      );

    return signedMessage;
  }

  @backgroundMethod()
  async getRawTransactions({
    networkId,
    txids,
  }: {
    networkId: string;
    txids: string[];
  }) {
    const client = await this.getClient(EServiceEndpointEnum.Wallet);
    const resp = await client.post<{
      data: { transactionMap: Record<string, { rawTx: string }> };
    }>('/wallet/v1/network/raw-transaction/list', {
      networkId,
      hashList: txids,
    });

    return resp.data.data.transactionMap;
  }

  @backgroundMethod()
  async getFrozenBalanceSetting({
    networkId,
    tokenDetails,
  }: {
    networkId: string;
    tokenDetails?: IFetchTokenDetailItem;
  }) {
    const vaultSettings =
      await this.backgroundApi.serviceNetwork.getVaultSettings({
        networkId,
      });
    if (!vaultSettings.hasFrozenBalance) {
      return false;
    }
    if (tokenDetails?.info) {
      return tokenDetails.info.isNative;
    }
    return vaultSettings.hasFrozenBalance;
  }

  @backgroundMethod()
  @toastIfError()
  async precheckUnsignedTxs(params: {
    networkId: string;
    accountId: string;
    unsignedTxs: IUnsignedTxPro[];
    precheckTiming: ESendPreCheckTimingEnum;
    nativeAmountInfo?: INativeAmountInfo;
    feeInfos?: ISendSelectedFeeInfo[];
  }) {
    const vault = await vaultFactory.getVault({
      networkId: params.networkId,
      accountId: params.accountId,
    });
    for (let i = 0, len = params.unsignedTxs.length; i < len; i += 1) {
      const unsignedTx = params.unsignedTxs[i];
      await vault.precheckUnsignedTx({
        unsignedTx,
        precheckTiming: params.precheckTiming,
        nativeAmountInfo: params.nativeAmountInfo,
        feeInfo: params.feeInfos?.[i]?.feeInfo,
      });
    }
  }

  @backgroundMethod()
  async parseTransaction(params: {
    networkId: string;
    accountId: string;
    encodedTx: IEncodedTx;
    accountAddress?: string;
  }) {
    const { networkId, accountId, encodedTx } = params;
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

    const client = await this.backgroundApi.serviceGas.getClient(
      EServiceEndpointEnum.Wallet,
    );
    const resp = await client.post<{ data: IParseTransactionResp }>(
      '/wallet/v1/account/parse-transaction',
      {
        networkId,
        accountAddress,
        encodedTx: encodedTxToParse,
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
}

export default ServiceSend;
