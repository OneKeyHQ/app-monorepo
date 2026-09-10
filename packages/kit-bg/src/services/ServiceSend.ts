/* cspell:ignore Infini */
import BigNumber from 'bignumber.js';
import { cloneDeep, isNil } from 'lodash';
import pLimit from 'p-limit';
import pRetry from 'p-retry';

import type { IEncodedTxTron } from '@onekeyhq/core/src/chains/tron/types';
import type {
  IEncodedTx,
  IUnsignedMessage,
  IUnsignedTxPro,
} from '@onekeyhq/core/src/types';
import { getPbkdf2KdfParamsForNonDbTxNoCache } from '@onekeyhq/shared/src/appCrypto/modules/pbkdf2';
import {
  backgroundClass,
  backgroundMethod,
  toastIfError,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import {
  HISTORY_CONSTS,
  SEND_TX_SERVER_ERROR_CODES,
} from '@onekeyhq/shared/src/engine/engineConsts';
import {
  InvoiceExpiredError,
  OneKeyLocalError,
  PendingQueueTooLong,
  ReplaceTxNonceConsumedError,
} from '@onekeyhq/shared/src/errors';
import { EOneKeyErrorClassNames } from '@onekeyhq/shared/src/errors/types/errorTypes';
import {
  GasAccountSubmitCancelledError,
  MAX_GAS_ACCOUNT_RETRY_ATTEMPTS,
  abortableWait,
  getGasAccountErrorCode,
  getGasAccountRetryAfterSec,
  isGasAccountSubmitCancelledError,
  shouldDeepRetryGasAccount,
} from '@onekeyhq/shared/src/errors/utils/gasAccountErrorUtils';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { getValidUnsignedMessage } from '@onekeyhq/shared/src/utils/messageUtils';
import { generateUUID } from '@onekeyhq/shared/src/utils/miscUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import {
  isPrimeInfiniPaymentPreBroadcastSnapshotSendable,
  isSamePrimeInfiniNetworkAddress,
  isValidPrimeInfiniPaymentContract,
} from '@onekeyhq/shared/src/utils/primeInfiniPaymentCacheUtils';
import {
  createPrimeInfiniPaymentValidationError,
  getPrimeInfiniPaymentValidationFailure,
} from '@onekeyhq/shared/src/utils/primeInfiniPaymentValidation';
import { hasUnconfirmedPrimeInfiniPaymentWarnings } from '@onekeyhq/shared/src/utils/primeInfiniPaymentWarnings';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import { EServiceEndpointEnum } from '@onekeyhq/shared/types/endpoint';
import type {
  ISendSelectedFeeInfo,
  ITronResourceRentalInfo,
} from '@onekeyhq/shared/types/fee';
import { EOnChainHistoryTxType } from '@onekeyhq/shared/types/history';
import type { ESendPreCheckTimingEnum } from '@onekeyhq/shared/types/send';
import { EReasonForNeedPassword } from '@onekeyhq/shared/types/setting';
import type { IParseTransactionResp } from '@onekeyhq/shared/types/signatureConfirm';
import type { IFetchTokenDetailItem } from '@onekeyhq/shared/types/token';
import { EDecodedTxActionType } from '@onekeyhq/shared/types/tx';
import type {
  EReplaceTxType,
  IDecodedTx,
  ISendTxBaseParams,
  ISendTxOnSuccessData,
} from '@onekeyhq/shared/types/tx';

import { vaultFactory } from '../vaults/factory';

import ServiceBase from './ServiceBase';
import {
  buildStageConfirmContentForMessage,
  buildStageConfirmContentForSignTx,
} from './ServiceHardwareUI/deviceStageConfirmUtils';

import type {
  IBatchSignTransactionParamsBase,
  IBroadcastTransactionParams,
  IBuildDecodedTxParams,
  IBuildUnsignedTxParams,
  INativeAmountInfo,
  IPreCheckFeeInfoParams,
  ISignTransactionParamsBase,
  ISignTransactionPrefetchedCredentials,
  ITokenApproveInfo,
  ITransferInfo,
  IUpdateUnsignedTxParams,
} from '../vaults/types';

@backgroundClass()
class ServiceSend extends ServiceBase {
  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
  }

  // submitId → AbortController for in-flight 90212 retry loops. Registered
  // when `signAndSendTransaction` enters the gas-account retry branch and
  // cleared in its `finally`. UI calls `abortGasAccountSubmit` to break the
  // loop when the user cancels the confirm screen.
  private gasAccountSubmitAborters: Map<string, AbortController> = new Map();

  @backgroundMethod()
  public async abortGasAccountSubmit(submitId: string): Promise<void> {
    const controller = this.gasAccountSubmitAborters.get(submitId);
    if (controller) {
      controller.abort();
      this.gasAccountSubmitAborters.delete(submitId);
    }
  }

  @backgroundMethod()
  async buildDecodedTx(
    params: ISendTxBaseParams & IBuildDecodedTxParams,
  ): Promise<IDecodedTx> {
    const {
      networkId,
      accountId,
      unsignedTx,
      feeInfo,
      transferPayload,
      saveToLocalHistory,
    } = params;
    const vault = await vaultFactory.getVault({ networkId, accountId });
    const decodedTx = await vault.buildDecodedTx({
      unsignedTx,
      transferPayload,
      saveToLocalHistory,
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
      swapInfo,
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
      swapInfo,
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
    const {
      accountId,
      networkId,
      signedTx,
      accountAddress,
      signature,
      rawTxType,
      tronResourceRentalInfo,
      gasAccountUiState,
      isPrivateSend,
      useDefaultRpc,
    } = params;

    // check if the network has custom rpc
    const customRpcInfo =
      await this.backgroundApi.serviceCustomRpc.getCustomRpcForNetwork(
        params.networkId,
      );
    let disableBroadcast: boolean | undefined;
    let txid = '';
    // Use custom RPC only if it's enabled AND user hasn't chosen to use default RPC
    if (customRpcInfo?.rpc && customRpcInfo?.enabled && !useDefaultRpc) {
      disableBroadcast = true;
      const vault = await vaultFactory.getVault({ accountId, networkId });
      const result = await vault.broadcastTransactionFromCustomRpc({
        ...params,
        customRpcInfo,
      });

      try {
        const verified = await vault.verifyTxId({
          txid: result.txid,
          signedTx: result,
        });
        if (!verified) {
          throw new OneKeyLocalError('Invalid txid');
        }
      } catch (_error) {
        throw new OneKeyLocalError('Invalid txid');
      }

      txid = result.txid;
    }

    const hasEnergyRented =
      tronResourceRentalInfo?.isResourceRentalNeeded &&
      tronResourceRentalInfo?.isResourceRentalEnabled;

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
        rawTxType,
        disableBroadcast,
        disableAntiMev: signedTx.disableMev,
        hasEnergyRented,
        ...(isPrivateSend ? { isPrivateSend } : {}),
        ...(gasAccountUiState?.selectedPayer === 'gasAccount' &&
        gasAccountUiState.gasAccountQuote?.quoteId
          ? {
              quoteId: gasAccountUiState.gasAccountQuote.quoteId,
              idempotencyKey: gasAccountUiState.idempotencyKey,
            }
          : {}),
      },
      {
        timeout: timerUtils.getTimeDurationMs({ seconds: 10 }),
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
    const devSettings =
      await this.backgroundApi.serviceDevSetting.getDevSetting();

    if (devSettings.enabled && devSettings.settings?.enableMockHighTxFee) {
      return true;
    }

    try {
      const isCustomNetwork =
        await this.backgroundApi.serviceNetwork.isCustomNetwork({
          networkId: params.networkId,
        });
      // custom network will skip pre-check
      if (isCustomNetwork) {
        return false;
      }
      const isLightningNetwork = networkUtils.isLightningNetworkByNetworkId(
        params.networkId,
      );
      if (isLightningNetwork) {
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
    params: ISendTxBaseParams &
      ISignTransactionParamsBase & {
        prefetchedCredentials?: ISignTransactionPrefetchedCredentials;
        /** DeviceStage confirm channel: the fee the caller already
         * resolved, shown as the confirm card's fee row (OK-59934). */
        stageFeeInfo?: ISendSelectedFeeInfo;
      },
  ) {
    const { networkId, accountId, unsignedTx, signOnly, stageFeeInfo } = params;
    const vault = await vaultFactory.getVault({ networkId, accountId });
    const { password, deviceParams } =
      params.prefetchedCredentials ??
      (await this.backgroundApi.servicePassword.promptPasswordVerifyByAccount({
        accountId,
        reason: EReasonForNeedPassword.CreateTransaction,
      }));
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
          if (process.env.NODE_ENV !== 'production') {
            console.log('signTx@vault.signTransaction', signedTx);
          }
          return signedTx;
        },
        {
          deviceParams,
          debugMethodName: 'serviceSend.signTransaction',
          stageConfirmContent: buildStageConfirmContentForSignTx(
            unsignedTx,
            stageFeeInfo,
          ),
        },
      );

    if (process.env.NODE_ENV !== 'production') {
      console.log('signTx@serviceSend.signTransaction', tx);
    }

    tx.swapInfo = unsignedTx.swapInfo;
    tx.stakingInfo = unsignedTx.stakingInfo;
    tx.disableMev = unsignedTx.disableMev;
    tx.uuid = unsignedTx.uuid;
    return tx;
  }

  @backgroundMethod()
  public async signAndSendTransaction(
    params: ISendTxBaseParams &
      ISignTransactionParamsBase & {
        gasAccountUiState?: IBatchSignTransactionParamsBase['gasAccountUiState'];
        gasAccountSubmitId?: IBatchSignTransactionParamsBase['gasAccountSubmitId'];
        broadcastDeadline?: IBatchSignTransactionParamsBase['broadcastDeadline'];
        beforeBroadcastAction?: IBatchSignTransactionParamsBase['beforeBroadcastAction'];
        transferPayload?: IBatchSignTransactionParamsBase['transferPayload'];
        isPrivateSend?: boolean;
        stageFeeInfo?: ISendSelectedFeeInfo;
      },
  ) {
    const {
      networkId,
      accountId,
      unsignedTx,
      signOnly,
      rawTxType,
      tronResourceRentalInfo,
      gasAccountUiState,
      gasAccountSubmitId,
      broadcastDeadline,
      beforeBroadcastAction,
      transferPayload,
      isPrivateSend,
      useDefaultRpc,
      stageFeeInfo,
    } = params;

    const accountAddress =
      await this.backgroundApi.serviceAccount.getAccountAddressForApi({
        accountId,
        networkId,
      });

    const isExternalAccount = accountUtils.isExternalAccount({ accountId });
    let staticBroadcastSkipReason: string | undefined;
    if (signOnly) {
      staticBroadcastSkipReason = 'requestedSignOnly';
    } else if (isExternalAccount) {
      staticBroadcastSkipReason = 'externalAccount';
    }
    const primeBroadcastDiagnosticBase =
      beforeBroadcastAction?.type === 'primeInfiniPayment'
        ? {
            ...beforeBroadcastAction.flowContext,
            networkId,
            hasBeforeBroadcastAction: true,
            isSignOnlyRequested: Boolean(signOnly),
            isExternalAccount,
          }
        : undefined;

    if (primeBroadcastDiagnosticBase && staticBroadcastSkipReason) {
      defaultLogger.prime.subscription.primeCryptoPaymentFlow({
        ...primeBroadcastDiagnosticBase,
        stage: 'broadcast',
        status: 'blocked',
        reason: 'primeBroadcastDiagV1:pathDecision',
        failureReason: staticBroadcastSkipReason,
        hasCompletedBeforeBroadcastAction: false,
        hasAttemptedBroadcast: false,
      });
      throw new OneKeyLocalError({
        message: 'Prime Infini payment requires a real broadcast',
        autoToast: false,
        data: {
          primeInfiniBroadcastSkipReason: staticBroadcastSkipReason,
        },
      });
    }

    const signedTx = await this.signTransaction({
      networkId,
      accountId,
      unsignedTx,
      signOnly, // external account should send tx here
      stageFeeInfo,
    });

    const devSetting =
      await this.backgroundApi.serviceDevSetting.getDevSetting();
    const isDevModeEnabled = Boolean(devSetting?.enabled);
    const isAlwaysSignOnlySendTxConfigured = Boolean(
      devSetting?.settings?.alwaysSignOnlySendTx,
    );
    const alwaysSignOnlySendTxInDev =
      isDevModeEnabled && isAlwaysSignOnlySendTxConfigured;
    const broadcastSkipReason = alwaysSignOnlySendTxInDev
      ? 'alwaysSignOnlySendTx'
      : staticBroadcastSkipReason;
    const primeBroadcastDiagnosticContext = primeBroadcastDiagnosticBase
      ? {
          ...primeBroadcastDiagnosticBase,
          isDevModeEnabled,
          isAlwaysSignOnlySendTxConfigured,
        }
      : undefined;

    if (primeBroadcastDiagnosticContext) {
      defaultLogger.prime.subscription.primeCryptoPaymentFlow({
        ...primeBroadcastDiagnosticContext,
        stage: 'broadcast',
        status: broadcastSkipReason ? 'blocked' : 'started',
        reason: 'primeBroadcastDiagV1:pathDecision',
        failureReason: broadcastSkipReason,
        hasCompletedBeforeBroadcastAction: false,
        hasAttemptedBroadcast: false,
      });
    }

    if (primeBroadcastDiagnosticContext && broadcastSkipReason) {
      throw new OneKeyLocalError({
        message: 'Prime Infini payment requires a real broadcast',
        autoToast: false,
        data: {
          primeInfiniBroadcastSkipReason: broadcastSkipReason,
        },
      });
    }

    // skip external account send, as rawTx is empty
    if (!broadcastSkipReason) {
      const vaultSettings =
        await this.backgroundApi.serviceNetwork.getVaultSettings({ networkId });
      const vault = await vaultFactory.getVault({
        networkId,
        accountId,
      });

      let effectiveBroadcastDeadline = broadcastDeadline;
      let infiniPaymentExpiresAt: number | undefined;
      const ensureBroadcastDeadline = () => {
        if (
          effectiveBroadcastDeadline !== undefined &&
          Date.now() >= effectiveBroadcastDeadline
        ) {
          if (beforeBroadcastAction?.type === 'primeInfiniPayment') {
            throw new InvoiceExpiredError({
              data: {
                paymentValidationFailure:
                  infiniPaymentExpiresAt !== undefined &&
                  Date.now() >= infiniPaymentExpiresAt
                    ? 'quoteExpired'
                    : 'quoteValidityTooShort',
              },
            });
          }
          throw new InvoiceExpiredError();
        }
      };
      // Threat model: this hook is attached only to OneKey-built Prime
      // transfers (isInternalTransfer + local transfersInfo + vault-built
      // encodedTx), never to dApp- or third-party-supplied transactions. It
      // must run in full before broadcast: require a signed encodedTx, bind the
      // current Prime user and invoice recipient/amount/token/network/signer,
      // enforce the deadline, refresh the server snapshot, and atomically
      // claim sendStarted. That claim is the duplicate-broadcast/payment
      // boundary. The decoded action count is only an internal consistency
      // check; it does not prove that a chain-native transaction contains one
      // money-moving instruction. The TRON contract-count check below is
      // likewise low-cost hardening, not a security boundary. Under these
      // assumptions, current and future Prime rails intentionally do not need
      // chain-native instruction validators. Reusing this hook for externally
      // supplied encodedTx invalidates the threat model and requires
      // redesigning this defense.
      if (beforeBroadcastAction?.type === 'primeInfiniPayment') {
        const paymentCacheKey = beforeBroadcastAction.paymentCacheKey;
        const ensurePrimePaymentUserIsCurrent = async () => {
          const currentPrimeUser =
            await this.backgroundApi.servicePrime.getLocalUserInfo();
          if (
            !currentPrimeUser.isLoggedIn ||
            currentPrimeUser.onekeyUserId !== paymentCacheKey.onekeyUserId
          ) {
            throw new OneKeyLocalError({
              message: 'Prime payment user changed before broadcast',
              autoToast: false,
            });
          }
        };
        if (signedTx.encodedTx === null) {
          throw new OneKeyLocalError({
            message: 'Infini payment transaction cannot be verified',
            autoToast: false,
          });
        }
        const hasExpectedNativeTransactionShape =
          !networkUtils.isTronNetworkByNetworkId(networkId) ||
          (signedTx.encodedTx as IEncodedTxTron).raw_data?.contract?.length ===
            1;
        if (!hasExpectedNativeTransactionShape) {
          throw new OneKeyLocalError({
            message: 'Infini payment transaction cannot be verified',
            autoToast: false,
          });
        }
        ensureBroadcastDeadline();
        await ensurePrimePaymentUserIsCurrent();
        const decodedTxPromise = vault
          .buildDecodedTx({
            unsignedTx: {
              ...unsignedTx,
              encodedTx: signedTx.encodedTx,
            },
            transferPayload,
          })
          .catch(() => {
            throw new OneKeyLocalError({
              message: 'Infini payment transaction cannot be verified',
              autoToast: false,
            });
          });
        const preBroadcastSnapshotPromise =
          this.backgroundApi.servicePrime.apiGetInfiniPaymentPreBroadcastSnapshot(
            {
              paymentId: paymentCacheKey.paymentId,
              expectedOneKeyUserId: paymentCacheKey.onekeyUserId,
              flowContext: beforeBroadcastAction.flowContext,
            },
          );
        const [decodedTx, { payment: latestPayment, purchaseStatusSnapshot }] =
          await Promise.all([decodedTxPromise, preBroadcastSnapshotPromise]);
        infiniPaymentExpiresAt = latestPayment.expiresAt;
        const action = decodedTx.actions[0];
        const transfer = action?.assetTransfer?.sends[0];
        const isExpectedTransferAsset =
          isValidPrimeInfiniPaymentContract({
            chain: latestPayment.chain,
            networkId,
            token: latestPayment.token,
            contractAddress: paymentCacheKey.contractAddress,
          }) &&
          typeof transfer?.tokenIdOnNetwork === 'string' &&
          (paymentCacheKey.contractAddress === ''
            ? transfer.isNative === true && transfer.tokenIdOnNetwork === ''
            : transfer.isNative !== true &&
              Boolean(transfer.tokenIdOnNetwork.trim()));
        const isExpectedSingleAssetTransfer =
          decodedTx.networkId === networkId &&
          decodedTx.accountId === accountId &&
          isSamePrimeInfiniNetworkAddress({
            networkId,
            first: decodedTx.signer,
            second: accountAddress,
          }) &&
          decodedTx.actions.length === 1 &&
          (!decodedTx.outputActions || decodedTx.outputActions.length === 0) &&
          !decodedTx.approveInfo &&
          action.type === EDecodedTxActionType.ASSET_TRANSFER &&
          Boolean(action.assetTransfer) &&
          action.assetTransfer?.sends.length === 1 &&
          action.assetTransfer.receives.length === 0 &&
          Boolean(transfer) &&
          Boolean(transfer?.from.trim()) &&
          Boolean(transfer?.to.trim()) &&
          isExpectedTransferAsset &&
          new BigNumber(transfer?.amount ?? '').isFinite() &&
          new BigNumber(transfer?.amount ?? '').gt(0) &&
          transfer?.isNFT !== true &&
          (!transfer?.networkId || transfer.networkId === networkId) &&
          isSamePrimeInfiniNetworkAddress({
            networkId,
            first: action.assetTransfer?.from ?? '',
            second: accountAddress,
          }) &&
          isSamePrimeInfiniNetworkAddress({
            networkId,
            first: action.assetTransfer?.to ?? '',
            second: transfer?.to ?? '',
          });
        if (!isExpectedSingleAssetTransfer || !transfer) {
          throw new OneKeyLocalError({
            message: 'Infini payment transaction cannot be verified',
            autoToast: false,
          });
        }
        const transferClaim = {
          networkId,
          accountId,
          accountAddress,
          fromAddress: transfer.from,
          toAddress: transfer.to,
          contractAddress: transfer.tokenIdOnNetwork,
          amount: transfer.amount,
        };
        const quoteFailure = getPrimeInfiniPaymentValidationFailure({
          payment: latestPayment,
        });
        if (
          quoteFailure ||
          hasUnconfirmedPrimeInfiniPaymentWarnings({
            payment: latestPayment,
            confirmedWarningsFingerprint:
              beforeBroadcastAction.confirmedWarningsFingerprint,
          })
        ) {
          defaultLogger.prime.subscription.primeCryptoPaymentFlow({
            ...beforeBroadcastAction.flowContext,
            stage: 'broadcast',
            status: 'blocked',
            paymentSource: 'preflightRefresh',
            paymentId: latestPayment.paymentId,
            failureReason: quoteFailure ?? 'transferSnapshotChanged',
            remainingMs: latestPayment.expiresAt - Date.now(),
          });
          throw createPrimeInfiniPaymentValidationError(
            quoteFailure ?? 'transferSnapshotChanged',
          );
        }
        ensureBroadcastDeadline();
        if (
          !isPrimeInfiniPaymentPreBroadcastSnapshotSendable({
            payment: latestPayment,
            paymentCacheKey,
            transferClaim,
          })
        ) {
          throw new OneKeyLocalError({
            message: 'Infini payment session is unavailable before broadcast',
            data:
              !new BigNumber(transferClaim.amount).eq(
                latestPayment.amountDue,
              ) ||
              !isSamePrimeInfiniNetworkAddress({
                networkId,
                first: transferClaim.toAddress,
                second: latestPayment.address,
              })
                ? { paymentValidationFailure: 'transferSnapshotChanged' }
                : undefined,
            autoToast: false,
          });
        }
        const markedSession =
          await this.backgroundApi.simpleDb.prime.markInfiniPendingPaymentSessionSendStarted(
            {
              onekeyUserId: paymentCacheKey.onekeyUserId,
              paymentCacheKey,
              transferClaim,
              latestPayment,
              purchaseStatusSnapshot,
            },
          );
        infiniPaymentExpiresAt = markedSession.payment.expiresAt;
        effectiveBroadcastDeadline = Math.min(
          effectiveBroadcastDeadline ?? markedSession.payment.expiresAt,
          markedSession.payment.expiresAt,
        );
        await ensurePrimePaymentUserIsCurrent();
        ensureBroadcastDeadline();
        defaultLogger.prime.subscription.primeCryptoPaymentFlow({
          ...primeBroadcastDiagnosticContext,
          stage: 'sessionPersistence',
          status: 'succeeded',
          reason: 'primeBroadcastDiagV1:beforeBroadcastActionCompleted',
          sendStarted: markedSession.sendStarted,
          hasCompletedBeforeBroadcastAction: true,
          hasAttemptedBroadcast: false,
        });
      }

      let hasAttemptedBroadcast = false;
      const broadcastOnce = async () => {
        ensureBroadcastDeadline();
        if (!hasAttemptedBroadcast && primeBroadcastDiagnosticContext) {
          defaultLogger.prime.subscription.primeCryptoPaymentFlow({
            ...primeBroadcastDiagnosticContext,
            stage: 'broadcast',
            status: 'started',
            reason: 'primeBroadcastDiagV1:vaultBroadcast',
            sendStarted: true,
            hasCompletedBeforeBroadcastAction: true,
            hasAttemptedBroadcast: true,
          });
        }
        hasAttemptedBroadcast = true;
        return vault.broadcastTransaction({
          accountId,
          networkId,
          accountAddress,
          signedTx,
          rawTxType,
          tronResourceRentalInfo,
          gasAccountUiState,
          isPrivateSend,
          useDefaultRpc,
        });
      };

      // 90212 GasAccountAdmissionOverloaded is a transient, idempotent retry
      // signal. Prime + BFF guarantee that re-sending the same signedTx with
      // the same quoteId + idempotencyKey will not double-charge or consume
      // the quote, so we can deep-retry up to N times without re-signing and
      // without re-estimating. Only engage when the user actually picked the
      // gas account payer and we have a live quote.
      const isGasAccountSubmit =
        gasAccountUiState?.selectedPayer === 'gasAccount' &&
        !!gasAccountUiState.gasAccountQuote?.quoteId;

      // Register an AbortController against the UI-provided submitId so the
      // confirm page can break the retry sleep via
      // `serviceSend.abortGasAccountSubmit(submitId)`. Cleaned up in finally.
      let abortController: AbortController | undefined;
      if (isGasAccountSubmit && gasAccountSubmitId) {
        abortController = new AbortController();
        this.gasAccountSubmitAborters.set(gasAccountSubmitId, abortController);
      }

      const broadcastWithGasAccountRetry = async () => {
        let lastError: unknown;
        let emittedScheduled = false;
        const emitClearedIfNeeded = () => {
          if (emittedScheduled) {
            appEventBus.emit(
              EAppEventBusNames.GasAccountSubmitRetryCleared,
              undefined,
            );
          }
        };
        try {
          for (
            let attempt = 0;
            attempt <= MAX_GAS_ACCOUNT_RETRY_ATTEMPTS;
            attempt += 1
          ) {
            if (abortController?.signal.aborted) {
              throw new GasAccountSubmitCancelledError();
            }
            try {
              const result = await broadcastOnce();
              emitClearedIfNeeded();
              return result;
            } catch (error) {
              if (isGasAccountSubmitCancelledError(error)) {
                // abortableWait unwound mid-sleep; bubble straight up.
                emitClearedIfNeeded();
                throw error;
              }
              if (abortController?.signal.aborted) {
                emitClearedIfNeeded();
                throw new GasAccountSubmitCancelledError();
              }
              lastError = error;
              const code = getGasAccountErrorCode(error);
              const retryAfterSec = getGasAccountRetryAfterSec(error);
              const canRetry =
                attempt < MAX_GAS_ACCOUNT_RETRY_ATTEMPTS &&
                shouldDeepRetryGasAccount({ code, retryAfterSec });
              if (!canRetry) {
                emitClearedIfNeeded();
                throw error;
              }
              appEventBus.emit(
                EAppEventBusNames.GasAccountSubmitRetryScheduled,
                {
                  attempt: attempt + 1,
                  maxAttempts: MAX_GAS_ACCOUNT_RETRY_ATTEMPTS,
                  retryAfterSec: retryAfterSec as number,
                  scheduledAt: Date.now(),
                },
              );
              emittedScheduled = true;
              await abortableWait(
                (retryAfterSec as number) * 1000,
                abortController?.signal,
              );
            }
          }
          emitClearedIfNeeded();
          // Structurally unreachable — every loop iteration returns on success
          // or throws on exhaustion — but TS can't narrow `for` exit, so keep a
          // typed fallback for the linter.
          throw lastError instanceof Error
            ? lastError
            : new OneKeyLocalError(
                'Gas account broadcast failed after deep retry.',
              );
        } finally {
          if (gasAccountSubmitId) {
            this.gasAccountSubmitAborters.delete(gasAccountSubmitId);
          }
        }
      };

      // Gas account submit runs its own bounded deep-retry loop (3 × 90212).
      // We deliberately bypass the outer pRetry here: vault
      // checkShouldRetryBroadcastTx returns true for generic transient codes
      // (EVM 40001 SERVICE_BUSY, SOL BLOCK_HASH_NOT_FOUND, Algo follower-mode)
      // and would re-enter `broadcastWithGasAccountRetry` with its attempt
      // counter reset, amplifying the nominal 3-retry budget to
      // (pRetry.retries × inner.retries) ≈ 24 broadcasts and violating the
      // product contract with Prime/BFF on retry amplification.
      const runBroadcast = async () => {
        if (isGasAccountSubmit) {
          return broadcastWithGasAccountRetry();
        }
        return pRetry(broadcastOnce, {
          retries: vaultSettings.maxRetryBroadcastTxCount ?? 5,
          minTimeout:
            vaultSettings.minRetryBroadcastTxInterval ??
            timerUtils.getTimeDurationMs({ seconds: 3 }),
          shouldRetry: async (error) => {
            if (error instanceof InvoiceExpiredError) {
              return false;
            }
            return vault.checkShouldRetryBroadcastTx(error);
          },
        });
      };

      const { txid } = await runBroadcast().catch((error) => {
        if (primeBroadcastDiagnosticContext) {
          defaultLogger.prime.subscription.primeCryptoPaymentFlow({
            ...primeBroadcastDiagnosticContext,
            stage: 'broadcast',
            status: 'failed',
            reason: 'primeBroadcastDiagV1:vaultBroadcastResult',
            failureReason: hasAttemptedBroadcast
              ? 'broadcastRejected'
              : 'broadcastNotAttempted',
            sendStarted: true,
            hasCompletedBeforeBroadcastAction: true,
            hasAttemptedBroadcast,
            hasBroadcastTxId: false,
            isWithoutBroadcastTxIdAllowed: Boolean(
              vaultSettings.withoutBroadcastTxId,
            ),
          });
        }
        throw error;
      });
      const isBroadcastResultAccepted =
        Boolean(txid) || Boolean(vaultSettings.withoutBroadcastTxId);
      if (primeBroadcastDiagnosticContext) {
        defaultLogger.prime.subscription.primeCryptoPaymentFlow({
          ...primeBroadcastDiagnosticContext,
          stage: 'broadcast',
          status: isBroadcastResultAccepted ? 'succeeded' : 'failed',
          reason: 'primeBroadcastDiagV1:vaultBroadcastResult',
          failureReason: isBroadcastResultAccepted
            ? undefined
            : 'broadcastMissingTxId',
          sendStarted: true,
          hasCompletedBeforeBroadcastAction: true,
          hasAttemptedBroadcast,
          hasBroadcastTxId: Boolean(txid),
          isWithoutBroadcastTxIdAllowed: Boolean(
            vaultSettings.withoutBroadcastTxId,
          ),
        });
      }
      if (!txid) {
        if (vaultSettings.withoutBroadcastTxId) {
          return signedTx;
        }
        throw new OneKeyLocalError('Broadcast transaction failed.');
      }
      return { ...signedTx, txid };
    }

    return signedTx;
  }

  @backgroundMethod()
  @toastIfError()
  public async updateUnSignedTxBeforeSending({
    accountId,
    networkId,
    feeInfos: sendSelectedFeeInfos,
    nativeAmountInfo,
    unsignedTxs,
    tokenApproveInfo,
    nonceInfo,
    feeInfoEditable,
    tronResourceRentalInfo,
  }: ISendTxBaseParams & {
    unsignedTxs: IUnsignedTxPro[];
    tokenApproveInfo?: ITokenApproveInfo;
    feeInfos?: ISendSelectedFeeInfo[];
    nativeAmountInfo?: INativeAmountInfo;
    nonceInfo?: { nonce: number };
    feeInfoEditable?: boolean;
    tronResourceRentalInfo?: ITronResourceRentalInfo;
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
        feeInfoEditable,
        tronResourceRentalInfo,
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
      tronResourceRentalInfo,
      gasAccountUiState,
      gasAccountSubmitId,
      broadcastDeadline,
      beforeBroadcastAction,
      useDefaultRpc,
    } = params;

    const isMultiTxs = unsignedTxs.length > 1;
    if (beforeBroadcastAction && isMultiTxs) {
      throw new OneKeyLocalError({
        message: 'Infini payment supports exactly one transaction',
        autoToast: false,
      });
    }
    const isPrivateSend = transferPayload?.isPrivateSend === true;
    const vault = await vaultFactory.getVault({ networkId, accountId });

    // A Gas Account quote is bound to a single user tx (payloadHash + locked
    // nonce). In batch flows every iteration would otherwise reuse the same
    // quoteId/idempotencyKey. Private Send is always a single deposit
    // transfer, so its sponsor state passes through (OK-59993).
    const effectiveGasAccountUiState = isMultiTxs
      ? undefined
      : gasAccountUiState;
    // Only thread the submitId through when we're actually going to engage the
    // retry loop, to avoid registering a controller for paths that will never
    // abort it.
    const effectiveGasAccountSubmitId = isMultiTxs
      ? undefined
      : gasAccountSubmitId;

    // Replace (speed up / cancel) txs reuse the original pending tx's nonce.
    // Re-validate that nonce against the on-chain nonce at the last moment
    // before signing: if the original tx was already confirmed/replaced, abort
    // and clean up the stale local pending tx instead of broadcasting a doomed
    // tx (which the backend rejects with code 40024).
    if (replaceTxInfo && !isMultiTxs) {
      const replaceTargetNonce = unsignedTxs[0]?.nonce;
      if (!isNil(replaceTargetNonce)) {
        const { consumed } = await this.precheckReplaceTxNonceConsumed({
          accountId,
          networkId,
          targetNonce: replaceTargetNonce,
          useDefaultRpc,
        });
        if (consumed) {
          await this.cleanupStaleReplaceTxAndThrow({
            accountId,
            networkId,
            replaceHistoryId: replaceTxInfo.replaceHistoryId,
          });
        }
      }
    }

    const result: ISendTxOnSuccessData[] = [];
    for (let i = 0, len = unsignedTxs.length; i < len; i += 1) {
      let unsignedTx = unsignedTxs[i];
      const feeInfo = sendSelectedFeeInfos?.[i];
      if (
        !successfullySentTxs ||
        !unsignedTx.uuid ||
        !successfullySentTxs.includes(unsignedTx.uuid)
      ) {
        if (isMultiTxs && i > 0) {
          unsignedTx = await vault.refreshUnsignedTxBeforeBatchSign(unsignedTx);
        }
        const buildSignedTx = () =>
          signOnly && !beforeBroadcastAction
            ? this.signTransaction({
                unsignedTx,
                accountId,
                networkId,
                signOnly: true,
                stageFeeInfo: feeInfo,
              })
            : this.signAndSendTransaction({
                unsignedTx,
                networkId,
                accountId,
                signOnly: Boolean(signOnly),
                stageFeeInfo: feeInfo,
                tronResourceRentalInfo,
                gasAccountUiState: effectiveGasAccountUiState,
                gasAccountSubmitId: effectiveGasAccountSubmitId,
                broadcastDeadline,
                beforeBroadcastAction,
                transferPayload,
                isPrivateSend,
                useDefaultRpc,
              });
        let signedTx: Awaited<ReturnType<typeof buildSignedTx>>;
        try {
          signedTx = await buildSignedTx();
        } catch (error) {
          // Safety net for the residual race between the pre-broadcast nonce
          // check and the actual broadcast: the backend rejected the replace
          // because the nonce is already used. Clean up the stale pending tx and
          // surface a friendly message instead of the raw backend error.
          if (
            replaceTxInfo &&
            (this.isReplaceTxNonceAlreadyUsedServerError(error) ||
              this.isReplaceTxNonceAlreadyUsedRpcError(error))
          ) {
            await this.cleanupStaleReplaceTxAndThrow({
              accountId,
              networkId,
              replaceHistoryId: replaceTxInfo.replaceHistoryId,
            });
          }
          throw error;
        }
        const decodedTx = await this.buildDecodedTx({
          networkId,
          accountId,
          unsignedTx,
          feeInfo,
          transferPayload,
          saveToLocalHistory: true,
        });
        if (isPrivateSend) {
          decodedTx.payload = {
            value:
              transferPayload?.amountToSend ?? decodedTx.payload?.value ?? '',
            label:
              decodedTx.payload?.label ?? EOnChainHistoryTxType.PrivateSend,
            type: EOnChainHistoryTxType.PrivateSend,
            privateSend: {
              ...transferPayload?.privateSend,
              originalRecipient: transferPayload?.originalRecipient,
            },
          };
          decodedTx.actions = decodedTx.actions.map((action) =>
            action.assetTransfer
              ? {
                  ...action,
                  assetTransfer: {
                    ...action.assetTransfer,
                    isInternalSwap: false,
                  },
                }
              : action,
          );
          decodedTx.outputActions = decodedTx.outputActions?.map((action) =>
            action.assetTransfer
              ? {
                  ...action,
                  assetTransfer: {
                    ...action.assetTransfer,
                    isInternalSwap: false,
                  },
                }
              : action,
          );
        }

        const data = {
          signedTx,
          decodedTx,
          feeInfo: feeInfo?.feeInfo,
          approveInfo: unsignedTx.approveInfo,
        };
        const hasDeFiActionInfo = Boolean(
          (unsignedTx.payload as { defiActionInfo?: unknown } | undefined)
            ?.defiActionInfo,
        );

        // For batch approve+swap/staking: only return the swap/staking tx result
        // For bulk send and DeFi portfolio action batches: return all business tx results
        if (
          !isMultiTxs ||
          unsignedTx.swapInfo ||
          unsignedTx.stakingInfo ||
          unsignedTx.transfersInfo ||
          hasDeFiActionInfo
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
      throw new OneKeyLocalError('Get on-chain nonce failed.');
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

  // Re-validate a replace (speed up / cancel) tx's reused nonce against the
  // current on-chain nonce. Returns consumed=true when the target nonce has
  // already been used on-chain (original tx confirmed/replaced), meaning the
  // replacement would be rejected (backend code 40024, or a custom RPC node's
  // `nonce too low`).
  //
  // The nonce MUST be read from the same source the broadcast will use: when a
  // custom RPC is enabled for a built-in network (and the user has not opted
  // into the default RPC for this send), the tx is broadcast directly to that
  // node, whose nonce view can diverge from the wallet API. Reading the wallet
  // API nonce in that case could let the precheck pass while the node rejects
  // the broadcast with a raw error the backend-40024 catch does not recognize,
  // leaving the stale local pending uncleaned. Pass `useDefaultRpc` through so
  // the precheck mirrors the broadcast's RPC choice.
  //
  // Fail-open: any error (or non-nonce chain) returns consumed=false so a flaky
  // pre-check never blocks a legitimate replace; the backend 40024 is the safety
  // net. NEVER overwrite the nonce here — doing so would turn a replace into a
  // brand-new transaction.
  @backgroundMethod()
  public async precheckReplaceTxNonceConsumed({
    accountId,
    networkId,
    targetNonce,
    useDefaultRpc,
  }: {
    accountId: string;
    networkId: string;
    targetNonce: number;
    useDefaultRpc?: boolean;
  }): Promise<{ consumed: boolean; onChainNextNonce?: number }> {
    try {
      if (isNil(targetNonce)) {
        return { consumed: false };
      }
      const { nonceRequired } =
        await this.backgroundApi.serviceNetwork.getVaultSettings({ networkId });
      if (!nonceRequired) {
        return { consumed: false };
      }
      const onChainNextNonce = await this.fetchReplaceTxOnChainNextNonce({
        accountId,
        networkId,
        useDefaultRpc,
      });
      if (isNil(onChainNextNonce)) {
        return { consumed: false };
      }
      return {
        consumed: new BigNumber(targetNonce).lt(onChainNextNonce),
        onChainNextNonce,
      };
    } catch {
      return { consumed: false };
    }
  }

  // Read the on-chain nonce for the replace-tx precheck. This precheck needs the
  // CONFIRMED (latest) on-chain transaction count, NOT a "next usable" nonce:
  // the replace tx reuses the original pending tx's nonce, so it is only truly
  // consumed once the chain has confirmed that nonce.
  //
  // Source selection:
  // - Custom RPC enabled on a built-in network (and not bypassed via
  //   `useDefaultRpc`) -> read from that node so the precheck and the
  //   broadcast share one nonce view.
  // - Backend non-indexed networks (backendIndex === false) -> the wallet API
  //   has no index for these chains and proxies the node with the `pending`
  //   block tag, which counts the very pending tx being replaced (off-by-one).
  //   That made the precheck report a still-pending nonce as consumed and
  //   wrongly drop the pending tx (OK-57049), so the wallet API must NOT be
  //   used. And unless the broadcast itself goes to the custom RPC (first
  //   case), there is no trustworthy latest-nonce source either: the custom
  //   node is disabled, or the user explicitly bypassed it via `useDefaultRpc`
  //   because it is unusable — a lagging/forked bypassed node could misreport
  //   a still-replaceable pending as consumed and get it wrongly cleaned up.
  //   Skip the precheck explicitly (fail-open — broadcast-time backend 40024 /
  //   node `nonce too low` remains the safety net).
  // - Otherwise (backend-indexed networks) -> wallet API, whose indexed nonce
  //   reflects the confirmed count.
  //
  // Custom-RPC / network detection is defensive: only a positively
  // backend-indexed network may use the wallet API. If the index status cannot
  // be resolved, fail-open instead of risking the non-indexed wallet API's
  // pending-inclusive nonce false positive.
  private async fetchReplaceTxOnChainNextNonce({
    accountId,
    networkId,
    useDefaultRpc,
  }: {
    accountId: string;
    networkId: string;
    useDefaultRpc?: boolean;
  }): Promise<number | undefined> {
    let customRpcEnabled = false;
    try {
      const customRpcInfo =
        await this.backgroundApi.serviceCustomRpc.getCustomRpcForNetwork(
          networkId,
        );
      customRpcEnabled = Boolean(customRpcInfo?.rpc && customRpcInfo?.enabled);
    } catch {
      customRpcEnabled = false;
    }
    const broadcastViaCustomRpc = customRpcEnabled && !useDefaultRpc;

    if (!broadcastViaCustomRpc) {
      try {
        const network = await this.backgroundApi.serviceNetwork.getNetworkSafe({
          networkId,
        });
        if (network?.backendIndex === true) {
          const { nonce } =
            await this.backgroundApi.serviceAccountProfile.fetchAccountDetails({
              networkId,
              accountId,
              withNonce: true,
            });
          return isNil(nonce) ? undefined : nonce;
        }

        // Reaching here means the broadcast does NOT go through the custom RPC
        // (disabled, or bypassed via `useDefaultRpc`), and the network is not
        // positively known to be backend-indexed. For non-indexed networks the
        // wallet API's pending-inclusive nonce is exactly the OK-57049 false
        // positive; if the index status is missing or failed to load, choose
        // the same fail-open path and leave cleanup to broadcast-time 40024 /
        // node `nonce too low`.
        return undefined;
      } catch {
        return undefined;
      }
    }

    const vault = await vaultFactory.getVault({ networkId, accountId });
    const accountAddress =
      await this.backgroundApi.serviceAccount.getAccountAddressForApi({
        accountId,
        networkId,
      });
    const resp = await vault.fetchAccountDetailsByRpc({
      accountId,
      networkId,
      accountAddress,
      withNonce: true,
    });
    const rpcNonce = resp?.data?.data?.nonce;
    return isNil(rpcNonce) ? undefined : rpcNonce;
  }

  isReplaceTxNonceAlreadyUsedServerError(error: unknown): boolean {
    const e = error as { className?: string; code?: number } | undefined;
    return (
      e?.className === EOneKeyErrorClassNames.OneKeyServerApiError &&
      e?.code === SEND_TX_SERVER_ERROR_CODES.NONCE_ALREADY_USED
    );
  }

  // Custom-RPC counterpart to isReplaceTxNonceAlreadyUsedServerError. When a tx
  // is broadcast directly to a custom RPC node (built-in network with custom
  // RPC enabled), an already-consumed replace nonce surfaces as a raw JSON-RPC
  // error (`nonce too low`) rather than the backend 40024. Treat ONLY genuine
  // nonce-consumed messages as the cleanup trigger.
  //
  // Deliberately excludes `replacement transaction underpriced`: that means the
  // original tx is STILL pending and only the replacement fee was too low, so
  // the local pending must NOT be cleaned up.
  isReplaceTxNonceAlreadyUsedRpcError(error: unknown): boolean {
    const message = (
      (error as { message?: string } | undefined)?.message ?? ''
    ).toLowerCase();
    if (!message) {
      return false;
    }
    return (
      message.includes('nonce too low') ||
      message.includes('nonce is too low') ||
      message.includes('oldnonce')
    );
  }

  buildReplaceTxNonceConsumedError() {
    return new ReplaceTxNonceConsumedError({
      message: appLocale.intl.formatMessage({
        id: ETranslations.global_nonce_error_lower,
      }),
    });
  }

  // Drop the stale local pending tx (its nonce was already consumed on-chain)
  // and throw the friendly, localized replace-nonce-consumed error. Always
  // throws — shared by the pre-broadcast nonce check and the backend-40024
  // safety net so both paths clean up and surface the same message.
  private async cleanupStaleReplaceTxAndThrow({
    accountId,
    networkId,
    replaceHistoryId,
  }: {
    accountId: string;
    networkId: string;
    replaceHistoryId?: string;
  }): Promise<never> {
    await this.backgroundApi.serviceHistory.resolveStalePendingReplaceTx({
      accountId,
      networkId,
      replaceHistoryId,
    });
    throw this.buildReplaceTxNonceConsumedError();
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
      isInternalSwap,
      isInternalTransfer,
      disableMev,
      withoutNonce,
      withUuid,
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
        swapInfo,
        specifiedFeeRate,
        prevNonce,
        feeInfo,
      });
    }

    newUnsignedTx.isInternalSwap = isInternalSwap;
    newUnsignedTx.isInternalTransfer = isInternalTransfer;
    newUnsignedTx.disableMev = disableMev;

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

    if (transfersInfo) {
      newUnsignedTx.transfersInfo = transfersInfo;
    }

    const isNonceRequired = (
      await this.backgroundApi.serviceNetwork.getVaultSettings({
        networkId,
      })
    ).nonceRequired;

    // Refetch nonce when it's missing, zero, or any non-finite value (NaN /
    // malformed string like "0x"). The previous `nonce ?? 0` check missed
    // NaN — `BigNumber(NaN).isZero()` is false, so an NaN-corrupted nonce
    // would bypass refetch and be signed as 0 by the signing library
    // downstream. (OK-45750)
    const nonceBN = new BigNumber(newUnsignedTx.nonce ?? NaN);
    const nonceNeedsRefetch =
      isNil(newUnsignedTx.nonce) ||
      !nonceBN.isFinite() ||
      nonceBN.isZero() ||
      nonceBN.isNegative();
    if (isNonceRequired && nonceNeedsRefetch && !withoutNonce) {
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

    if (withUuid) {
      newUnsignedTx.uuid = generateUUID();
    }

    newUnsignedTx.accountId = accountId;
    newUnsignedTx.networkId = networkId;
    newUnsignedTx.indexedAccountId = account.indexedAccountId;

    return newUnsignedTx;
  }

  @backgroundMethod()
  @toastIfError()
  async signMessage({
    unsignedMessage,
    networkId,
    accountId,
    useNonBlockingKdf,
  }: {
    unsignedMessage?: IUnsignedMessage;
    networkId: string;
    accountId: string;
    useNonBlockingKdf?: boolean;
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
      throw new OneKeyLocalError('Invalid unsigned message');
    }

    const kdfParams = useNonBlockingKdf
      ? getPbkdf2KdfParamsForNonDbTxNoCache()
      : undefined;

    const { password, deviceParams } =
      await this.backgroundApi.servicePassword.promptPasswordVerifyByAccount({
        accountId,
        reason: EReasonForNeedPassword.CreateTransaction,
        kdfParams,
      });
    const signedMessage =
      await this.backgroundApi.serviceHardwareUI.withHardwareProcessing(
        async () => {
          const [_signedMessage] = await vault.keyring.signMessage({
            messages: [validUnsignedMessage],
            password,
            deviceParams,
            ...kdfParams,
          });
          return _signedMessage;
        },
        {
          deviceParams,
          debugMethodName: 'serviceSend.signMessage',
          stageConfirmContent:
            buildStageConfirmContentForMessage(validUnsignedMessage),
        },
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

    // Split txids into chunks to avoid timeout due to large data volume
    const chunkSize = 10;
    const txidsChunks = [];
    for (let i = 0; i < txids.length; i += chunkSize) {
      txidsChunks.push(txids.slice(i, i + chunkSize));
    }

    const concurrencyLimit = 5;
    const limit = pLimit(concurrencyLimit);

    // Process each chunk concurrently with retry mechanism
    const fetchChunk = async (chunk: string[]) => {
      const run = async () => {
        const resp = await client.post<{
          data: { transactionMap: Record<string, { rawTx: string }> };
        }>(
          '/wallet/v1/network/raw-transaction/list',
          {
            networkId,
            hashList: chunk,
          },
          {
            timeout: timerUtils.getTimeDurationMs({ minute: 1 }),
          },
        );
        return resp.data.data.transactionMap;
      };

      // Retry configuration: 5 retries with 3s interval
      return pRetry(run, {
        retries: 5,
        minTimeout: timerUtils.getTimeDurationMs({ seconds: 3 }),
        onFailedAttempt: (error) => {
          defaultLogger.transaction.send.rawTxFetchFailed({
            network: networkId,
            txids: chunk,
            error: error.message,
            attemptNumber: error.attemptNumber,
            retriesLeft: error.retriesLeft,
          });
        },
      });
    };

    const limitedFetchTasks = txidsChunks.map((chunk) =>
      limit(() => fetchChunk(chunk)),
    );

    const results = await Promise.all(limitedFetchTasks);

    const transactionMap: Record<string, { rawTx: string }> = {};
    results.forEach((result) => {
      Object.assign(transactionMap, result);
    });

    return transactionMap;
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
  async checkAddressBeforeSending({
    networkId,
    fromAddress,
    toAddress,
  }: {
    fromAddress?: string;
    networkId: string;
    toAddress: string;
  }) {
    const { isContract, isScam } =
      await this.backgroundApi.serviceAccountProfile.getAddressAccountBadge({
        networkId,
        fromAddress,
        toAddress,
      });
    if (isContract || isScam) {
      await new Promise<boolean>((resolve, reject) => {
        const promiseId = this.backgroundApi.servicePromise.createCallback({
          resolve,
          reject,
        });
        appEventBus.emit(EAppEventBusNames.CheckAddressBeforeSending, {
          promiseId,
          type: isScam ? 'scam' : 'contract',
        });
      });
    }
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

    // parse-transaction is scoped to the xpub that built this encoded tx,
    // so here we always use the caller's own account xpub (not the merged
    // set in OK-52897 — those are other derive paths whose inputs are not
    // in this encodedTx). Failure to resolve the xpub is non-fatal: the
    // backend parses the tx from encodedTx regardless, xpub is only used
    // as an additional identity hint for the interaction-history check.
    let xpub: string | undefined;
    try {
      xpub =
        (await this.backgroundApi.serviceAccount.getAccountXpub({
          accountId,
          networkId,
        })) || undefined;
    } catch (error) {
      console.warn(
        'ServiceSend.parseTransaction: failed to resolve xpub, continuing without it',
        error,
      );
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
  async validateMemo(params: {
    networkId: string;
    accountId?: string;
    memo: string;
    tokenAddress?: string;
  }) {
    const { networkId, accountId, memo, tokenAddress } = params;
    if (accountId) {
      const vault = await vaultFactory.getVault({ networkId, accountId });
      return vault.validateMemo(memo, tokenAddress);
    }

    return (await vaultFactory.getChainOnlyVault({ networkId })).validateMemo(
      memo,
      tokenAddress,
    );
  }

  @backgroundMethod()
  @toastIfError()
  async buildBulkSendUnsignedTxs(params: {
    networkId: string;
    accountId: string;
    transfersInfo: ITransferInfo[];
  }): Promise<{ unsignedTxs: IUnsignedTxPro[]; ataCount?: number }> {
    const { networkId, accountId, transfersInfo } = params;
    const vault = await vaultFactory.getVault({ networkId, accountId });

    const { encodedTxs, transfersInfoChunks, ataCount } =
      await vault.buildBulkSendEncodedTxs({ transfersInfo });

    const account = await this.backgroundApi.serviceAccount.getAccount({
      accountId,
      networkId,
    });

    const unsignedTxs: IUnsignedTxPro[] = [];
    for (let i = 0; i < encodedTxs.length; i += 1) {
      const unsignedTx = await vault.buildUnsignedTx({
        encodedTx: encodedTxs[i],
        transfersInfo: transfersInfoChunks[i],
      });
      // Ensure transfersInfo is set on the unsigned tx for all chains
      // (some vaults like SOL don't propagate it from buildUnsignedTx params)
      unsignedTx.transfersInfo = transfersInfoChunks[i];
      unsignedTx.accountId = accountId;
      unsignedTx.networkId = networkId;
      unsignedTx.indexedAccountId = account.indexedAccountId;
      unsignedTx.uuid = generateUUID();
      unsignedTxs.push(unsignedTx);
    }

    return { unsignedTxs, ataCount };
  }
}

export default ServiceSend;
