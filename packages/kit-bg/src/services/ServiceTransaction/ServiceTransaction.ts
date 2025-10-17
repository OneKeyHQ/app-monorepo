import { Semaphore } from 'async-mutex';
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
  IVerifyTxDappInfoParams,
  IVerifyTxDappInfoResult,
  IVerifyTxFeeInfoParams,
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
  private verifyMutex = new Semaphore(1);

  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
  }

  @backgroundMethod()
  async verifyTransaction(params: IVerifyTxParams): Promise<IVerifyTxResponse> {
    return this.verifyMutex.runExclusive(async () => {
      const {
        verifyTxTasks = DEFAULT_VERIFY_TASKS,
        autoToastVerifyError = true,
        skipVerifyError = false,
        ...rest
      } = params;

      const verifyPromises = verifyTxTasks.map(async (task) => {
        switch (task) {
          case 'feeInfo':
            return {
              task,
              result: await this.verifyTransactionFeeInfo({
                autoToastVerifyError,
                skipVerifyError,
                ...rest,
              }),
            };
          case 'dappInfo':
            return {
              task,
              result: await this.verifyTransactionDappInfo({
                autoToastVerifyError,
                skipVerifyError,
                ...rest,
              }),
            };
          case 'parseInfo':
            return {
              task,
              result: await this.verifyTransactionParseInfo({
                autoToastVerifyError,
                skipVerifyError,
                ...rest,
              }),
            };
          default:
            return { task, result: null };
        }
      });

      const results = await Promise.all(verifyPromises);

      const response: IVerifyTxResponse = {
        txFeeInfoVerifyResult: { checked: false, skipReason: 'not in tasks' },
        txDappInfoVerifyResult: {
          checked: false,
          skipReason: 'not in tasks',
          urlSecurityInfo: {} as IHostSecurity,
        },
        txParseInfoVerifyResult: { checked: false, skipReason: 'not in tasks' },
      };

      results.forEach(({ task, result }) => {
        if (result) {
          switch (task) {
            case 'feeInfo':
              response.txFeeInfoVerifyResult = result;
              break;
            case 'dappInfo':
              response.txDappInfoVerifyResult = result;
              break;
            case 'parseInfo':
              response.txParseInfoVerifyResult = result;
              break;
            default:
              break;
          }
        }
      });

      return response;
    });
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

    const validationError = this.validateFeeInfoParams(verifyTxFeeInfoParams);
    if (validationError) {
      return {
        checked: false,
        skipReason: validationError,
      };
    }

    const { feeAmount, feeTokenSymbol, doubleConfirm } = verifyTxFeeInfoParams!;

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
            userConfirmed: true,
          };
        } catch (e) {
          if (!skipVerifyError) {
            throw new OneKeyLocalError({
              message: appLocale.intl.formatMessage({
                id: ETranslations.fee_alert_dialog_description,
              }),
              autoToast: autoToastVerifyError,
            });
          }
          return {
            checked: true,
            isFeeInfoOverflow,
            userConfirmed: false,
          };
        }
      } else {
        if (!skipVerifyError) {
          throw new OneKeyLocalError({
            message: appLocale.intl.formatMessage({
              id: ETranslations.fee_alert_dialog_description,
            }),
            autoToast: autoToastVerifyError,
          });
        }
        return {
          checked: true,
          isFeeInfoOverflow,
        };
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

    const validationError = this.validateDappInfoParams(verifyTxDappInfoParams);
    if (validationError) {
      return {
        checked: false,
        skipReason: validationError,
        urlSecurityInfo: {} as IHostSecurity,
      };
    }

    const { origin } = verifyTxDappInfoParams!.sourceInfo!;
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

  private validateFeeInfoParams(
    params: IVerifyTxFeeInfoParams | undefined,
  ): string | null {
    if (!params) return 'Missing fee info params';
    if (isNil(params.feeAmount)) return 'Missing fee amount';
    if (isNil(params.feeTokenSymbol)) return 'Missing fee token symbol';
    return null;
  }

  private validateDappInfoParams(
    params: IVerifyTxDappInfoParams | undefined,
  ): string | null {
    if (!params) return 'Missing dapp info params';
    if (!params.sourceInfo) return 'Missing dapp source info';
    if (!params.sourceInfo.origin) return 'Missing dapp origin';
    return null;
  }
}

export default ServiceTransaction;
