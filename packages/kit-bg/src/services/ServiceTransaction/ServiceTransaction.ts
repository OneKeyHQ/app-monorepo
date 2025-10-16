import { isNil } from 'lodash';

import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
import { TX_RISKY_LEVEL_SCAM } from '@onekeyhq/shared/src/walletConnect/constant';
import {
  EHostSecurityLevel,
  type IHostSecurity,
} from '@onekeyhq/shared/types/discovery';
import type {
  IVerifyTxDappInfoResult,
  IVerifyTxFeeInfoResult,
  IVerifyTxParams,
  IVerifyTxParseInfoResult,
  IVerifyTxResponse,
  IVerifyTxTask,
} from '@onekeyhq/shared/types/tx';

import ServiceBase from '../ServiceBase';

const DEFAULT_VERIFY_TASKS: IVerifyTxTask[] = [
  'feeInfo',
  'dappInfo',
  'parseInfo',
];

@backgroundClass()
class ServiceTransaction extends ServiceBase {
  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
  }

  @backgroundMethod()
  async verifyTransaction(params: IVerifyTxParams): Promise<IVerifyTxResponse> {
    const {
      verifyTxTasks = DEFAULT_VERIFY_TASKS,
      autoToastVerifyError = true,
      skipVerifyError = false,
      ...rest
    } = params;

    let txFeeInfoVerifyResult = {
      checked: false,
      skipReason: 'non in tasks',
    } as IVerifyTxFeeInfoResult;

    let txDappInfoVerifyResult = {
      checked: false,
      skipReason: 'non in tasks',
    } as IVerifyTxDappInfoResult;

    let txParseInfoVerifyResult = {
      checked: false,
      skipReason: 'non in tasks',
    } as IVerifyTxParseInfoResult;

    for (const task of verifyTxTasks) {
      switch (task) {
        case 'feeInfo':
          txFeeInfoVerifyResult = await this.verifyTransactionFeeInfo({
            autoToastVerifyError,
            skipVerifyError,
            ...rest,
          });
          break;
        case 'dappInfo':
          txDappInfoVerifyResult = await this.verifyTransactionDappInfo({
            autoToastVerifyError,
            skipVerifyError,
            ...rest,
          });
          break;
        case 'parseInfo':
          txParseInfoVerifyResult = await this.verifyTransactionParseInfo({
            autoToastVerifyError,
            skipVerifyError,
            ...rest,
          });
          break;
        default:
      }
    }

    return {
      txFeeInfoVerifyResult,
      txDappInfoVerifyResult,
      txParseInfoVerifyResult,
    };
  }

  @backgroundMethod()
  async verifyTransactionFeeInfo(
    params: Omit<IVerifyTxParams, 'verifyTxTasks'>,
  ): Promise<IVerifyTxFeeInfoResult> {
    const {
      networkId,
      accountId,
      encodedTx,
      verifyTxFeeInfoParams,
      skipVerifyError,
      autoToastVerifyError,
    } = params;

    if (
      !verifyTxFeeInfoParams ||
      isNil(verifyTxFeeInfoParams.feeAmount) ||
      isNil(verifyTxFeeInfoParams.feeTokenSymbol)
    ) {
      return {
        checked: false,
        skipReason: 'Missing fee info params',
      };
    }

    const { feeAmount, feeTokenSymbol, doubleConfirm } = verifyTxFeeInfoParams;

    const accountAddress =
      await this.backgroundApi.serviceAccount.getAccountAddressForApi({
        accountId,
        networkId,
      });
    const isFeeInfoOverflow =
      await this.backgroundApi.serviceSend.preCheckIsFeeInfoOverflow({
        encodedTx,
        feeAmount,
        feeTokenSymbol,
        networkId,
        accountAddress,
      });

    if (isFeeInfoOverflow) {
      if (doubleConfirm) {
        try {
          await new Promise<boolean>((resolve, reject) => {
            const promiseId = this.backgroundApi.servicePromise.createCallback({
              resolve,
              reject,
            });
            appEventBus.emit(EAppEventBusNames.doubleConfirmTxFeeInfo, {
              promiseId,
            });
          });
          return {
            checked: true,
            isFeeInfoOverflow,
          };
        } catch (e) {
          throw new OneKeyLocalError({
            message: appLocale.intl.formatMessage({
              id: ETranslations.fee_alert_dialog_description,
            }),
            autoToast: autoToastVerifyError,
          });
        }
      } else if (!skipVerifyError) {
        throw new OneKeyLocalError({
          message: appLocale.intl.formatMessage({
            id: ETranslations.fee_alert_dialog_description,
          }),
          autoToast: autoToastVerifyError,
        });
      }
    }

    return {
      checked: true,
      isFeeInfoOverflow,
    };
  }

  @backgroundMethod()
  async verifyTransactionDappInfo(
    params: Omit<IVerifyTxParams, 'verifyTxTasks'>,
  ): Promise<IVerifyTxDappInfoResult> {
    const { verifyTxDappInfoParams, skipVerifyError, autoToastVerifyError } =
      params;
    if (
      !verifyTxDappInfoParams ||
      !verifyTxDappInfoParams.sourceInfo ||
      !verifyTxDappInfoParams.sourceInfo.origin
    )
      return {
        checked: false,
        skipReason: 'Missing dapp source info',
        urlSecurityInfo: {} as IHostSecurity,
      };
    const urlSecurityInfo =
      await this.backgroundApi.serviceDiscovery.checkUrlSecurity({
        url: origin,
        from: 'app',
      });

    if (urlSecurityInfo.level === EHostSecurityLevel.High && !skipVerifyError) {
      throw new OneKeyLocalError({
        message: appLocale.intl.formatMessage({
          id: ETranslations.explore_malicious_dapp,
        }),
        autoToast: autoToastVerifyError,
      });
    }
    return {
      checked: true,
      urlSecurityInfo,
    };
  }

  @backgroundMethod()
  async verifyTransactionParseInfo(
    params: Omit<IVerifyTxParams, 'verifyTxTasks'>,
  ): Promise<IVerifyTxParseInfoResult> {
    const {
      accountId,
      networkId,
      encodedTx,
      skipVerifyError,
      autoToastVerifyError,
    } = params;
    const resp =
      await this.backgroundApi.serviceSignatureConfirm.parseTransaction({
        networkId,
        accountId,
        encodedTx,
      });

    if (resp.parsedTx.to.riskLevel >= TX_RISKY_LEVEL_SCAM && !skipVerifyError) {
      throw new OneKeyLocalError({
        message: appLocale.intl.formatMessage({
          id: ETranslations.send_label_scam,
        }),
        autoToast: autoToastVerifyError,
      });
    }

    return {
      checked: true,
      to: resp.parsedTx.to,
    };
  }
}

export default ServiceTransaction;
