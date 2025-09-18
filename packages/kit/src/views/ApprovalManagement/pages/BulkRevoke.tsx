import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useRoute } from '@react-navigation/core';
import BigNumber from 'bignumber.js';
import { isUndefined } from 'lodash';
import { type IntlShape, useIntl } from 'react-intl';

import {
  Accordion,
  Alert,
  Dialog,
  NumberSizeableText,
  Page,
  SizableText,
  Stack,
  XStack,
  YStack,
  getCurrentVisibilityState,
  onVisibilityStateChange,
} from '@onekeyhq/components';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { EOneKeyErrorClassNames } from '@onekeyhq/shared/src/errors/types/errorTypes';
import type {
  IOneKeyError,
  IOneKeyRpcError,
} from '@onekeyhq/shared/src/errors/types/errorTypes';
import { isHardwareInterruptErrorByCode } from '@onekeyhq/shared/src/errors/utils/deviceErrorUtils';
import errorUtils from '@onekeyhq/shared/src/errors/utils/errorUtils';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  EModalApprovalManagementRoutes,
  IModalApprovalManagementParamList,
} from '@onekeyhq/shared/src/routes/approvalManagement';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import {
  ERevokeProgressState,
  ERevokeTxStatus,
  type IRevokeTxStatus,
} from '@onekeyhq/shared/types/approval';
import type {
  IFeeInfoUnit,
  ISendSelectedFeeInfo,
} from '@onekeyhq/shared/types/fee';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { usePromiseResult } from '../../../hooks/usePromiseResult';
import { calculateFeeForSend } from '../../../utils/gasFee';
import BulkRevokeItem from '../components/BulkRevokeItem';

import type { RouteProp } from '@react-navigation/core';

function getConfirmText({
  intl,
  progressState,
}: {
  intl: IntlShape;
  progressState: ERevokeProgressState;
}) {
  if (progressState === ERevokeProgressState.Finished) {
    return intl.formatMessage({
      id: ETranslations.global_finish,
    });
  }

  return progressState === ERevokeProgressState.InProgress
    ? intl.formatMessage({
        id: ETranslations.global_pause,
      })
    : intl.formatMessage({
        id: ETranslations.global_resume,
      });
}

function BulkRevoke() {
  const intl = useIntl();
  const route =
    useRoute<
      RouteProp<
        IModalApprovalManagementParamList,
        EModalApprovalManagementRoutes.BulkRevoke
      >
    >();

  const { unsignedTxs, contractMap } = route.params;

  const navigation = useAppNavigation();

  const [settings] = useSettingsPersistAtom();

  const [revokeTxsStatusMap, setRevokeTxsStatusMap] = useState<
    Record<string, IRevokeTxStatus>
  >({});

  const [progressState, setProgressState] = useState<ERevokeProgressState>(
    ERevokeProgressState.InProgress,
  );

  const [currentProcessIndex, setCurrentProcessIndex] = useState(0);

  const isAborted = useRef(false);
  const progressStateRef = useRef(progressState);

  const waitUntilInProgress: () => Promise<boolean> = useCallback(async () => {
    if (
      progressStateRef.current === ERevokeProgressState.InProgress ||
      isAborted.current
    )
      return Promise.resolve(true);
    await timerUtils.wait(1000);
    return waitUntilInProgress();
  }, [isAborted]);

  const { succeededTxCount, skippedTxCount, failedTxCount, totalFeeFiat } =
    useMemo(() => {
      let _succeededTxCount = 0;
      let _skippedTxCount = 0;
      let _failedTxCount = 0;
      let _totalFeeFiat = new BigNumber(0);

      Object.values(revokeTxsStatusMap).forEach((status) => {
        if (status.status === ERevokeTxStatus.Succeeded) {
          _succeededTxCount += 1;
          _totalFeeFiat = _totalFeeFiat.plus(status.feeFiat ?? 0);
        } else if (status.status === ERevokeTxStatus.Skipped) {
          _skippedTxCount += 1;
        } else if (status.status === ERevokeTxStatus.Failed) {
          _failedTxCount += 1;
        }
      });

      return {
        succeededTxCount: _succeededTxCount,
        skippedTxCount: _skippedTxCount,
        failedTxCount: _failedTxCount,
        totalFeeFiat: _totalFeeFiat.toFixed(),
      };
    }, [revokeTxsStatusMap]);

  usePromiseResult(async () => {
    for (let i = 0; i < unsignedTxs?.length; i += 1) {
      const tx = unsignedTxs[i];

      setCurrentProcessIndex(i);

      if (accountUtils.isWatchingAccount({ accountId: tx.accountId ?? '' })) {
        setRevokeTxsStatusMap((prev) => ({
          ...prev,
          [tx.uuid ?? '']: {
            status: ERevokeTxStatus.Skipped,
            skippedReason: intl.formatMessage({
              id: ETranslations.wallet_error_trade_with_watched_account,
            }),
          },
        }));
        // eslint-disable-next-line no-continue
        continue;
      }

      if (isAborted.current) {
        break;
      }

      await waitUntilInProgress();
      const uuid = tx.uuid ?? '';

      try {
        if (!uuid || !tx.networkId || !tx.accountId) {
          throw new OneKeyLocalError(
            `params missing: uuid: ${uuid}, networkId: ${
              tx.networkId ?? ''
            }, accountId: ${tx.accountId ?? ''}`,
          );
        }

        setRevokeTxsStatusMap((prev) => ({
          ...prev,
          [uuid]: {
            status: ERevokeTxStatus.Processing,
          },
        }));

        const accountAddress =
          await backgroundApiProxy.serviceAccount.getAccountAddressForApi({
            networkId: tx.networkId,
            accountId: tx.accountId,
          });

        if (isAborted.current) {
          break;
        }
        await waitUntilInProgress();

        const { encodedTx, estimateFeeParams } =
          await backgroundApiProxy.serviceGas.buildEstimateFeeParams({
            accountId: tx.accountId,
            networkId: tx.networkId,
            encodedTx: tx.encodedTx,
          });

        const resp = await backgroundApiProxy.serviceGas.estimateFee({
          accountId: tx.accountId,
          networkId: tx.networkId,
          encodedTx,
          accountAddress,
        });

        const feeInfo: IFeeInfoUnit = {
          common: {
            baseFee: resp.common.baseFee,
            feeDecimals: resp.common.feeDecimals,
            feeSymbol: resp.common.feeSymbol,
            nativeDecimals: resp.common.nativeDecimals,
            nativeSymbol: resp.common.nativeSymbol,
            nativeTokenPrice: resp.common.nativeTokenPrice,
          },
          gas: resp.gas?.[1] ?? resp.gas?.[0],
          gasEIP1559: resp.gasEIP1559?.[1] ?? resp.gasEIP1559?.[0],
          feeTron: resp.feeTron?.[1] ?? resp.feeTron?.[0],
        };

        const feeResult = calculateFeeForSend({
          feeInfo,
          nativeTokenPrice: resp.common.nativeTokenPrice ?? 0,
          txSize: tx.txSize,
          estimateFeeParams,
        });
        if (isAborted.current) {
          break;
        }
        await waitUntilInProgress();

        const isFeeInfoOverflow =
          await backgroundApiProxy.serviceSend.preCheckIsFeeInfoOverflow({
            encodedTx: tx.encodedTx,
            feeAmount: feeResult.totalNative,
            feeTokenSymbol: feeInfo.common.nativeSymbol,
            networkId: tx.networkId,
            accountAddress,
          });

        if (isAborted.current) {
          break;
        }
        await waitUntilInProgress();

        if (isFeeInfoOverflow) {
          setRevokeTxsStatusMap((prev) => ({
            ...prev,
            [uuid]: {
              status: ERevokeTxStatus.Skipped,
              skippedReason: intl.formatMessage({
                id: ETranslations.fee_alert_dialog_description,
              }),
            },
          }));
          // eslint-disable-next-line no-continue
          continue;
        }

        let updatedTx = tx;

        if (isUndefined(tx.nonce)) {
          const nonce = await backgroundApiProxy.serviceSend.getNextNonce({
            accountId: tx.accountId,
            networkId: tx.networkId,
            accountAddress,
          });
          updatedTx = await backgroundApiProxy.serviceSend.updateUnsignedTx({
            networkId: tx.networkId,
            accountId: tx.accountId,
            unsignedTx: tx,
            nonceInfo: { nonce },
            feeInfo,
          });
        }
        if (isAborted.current) {
          break;
        }
        await waitUntilInProgress();

        const sendSelectedFeeInfo: ISendSelectedFeeInfo = {
          feeInfo,
          total: feeResult.total,
          totalNative: feeResult.totalNative,
          totalFiat: feeResult.totalFiat,
          totalNativeForDisplay: feeResult.totalNativeForDisplay,
          totalFiatForDisplay: feeResult.totalFiatForDisplay,
        };

        const result =
          await backgroundApiProxy.serviceSend.batchSignAndSendTransaction({
            accountId: tx.accountId,
            networkId: tx.networkId,
            unsignedTxs: [updatedTx],
            feeInfos: [sendSelectedFeeInfo],
            transferPayload: undefined,
          });

        if (isAborted.current) {
          break;
        }
        await waitUntilInProgress();

        setRevokeTxsStatusMap((prev) => ({
          ...prev,
          [uuid]: {
            status: ERevokeTxStatus.Succeeded,
            txId: result[0].signedTx.txid,
            feeBalance: feeResult.totalNativeForDisplay,
            feeSymbol: resp.common.nativeSymbol,
            feeFiat: feeResult.totalFiatForDisplay,
          },
        }));
      } catch (error: unknown) {
        let passphraseEnabled;
        let deviceCommunicationError;

        if (
          isHardwareInterruptErrorByCode({
            error: error as IOneKeyError,
          })
        ) {
          i -= 1;
          deviceCommunicationError = true;
          setProgressState(ERevokeProgressState.Paused);
          progressStateRef.current = ERevokeProgressState.Paused;
          setRevokeTxsStatusMap((prev) => ({
            ...prev,
            [uuid]: {
              status: ERevokeTxStatus.Paused,
            },
          }));
        }

        if (
          errorUtils.isErrorByClassName({
            error,
            className: EOneKeyErrorClassNames.DeviceNotOpenedPassphrase,
          })
        ) {
          const p = (error as IOneKeyError).payload as
            | {
                connectId: string;
                deviceId: string;
              }
            | undefined;
          passphraseEnabled = await new Promise((resolve) => {
            Dialog.show({
              title: intl.formatMessage({
                id: ETranslations.passphrase_disabled_dialog_title,
              }),
              description: intl.formatMessage({
                id: ETranslations.passphrase_disabled_dialog_desc,
              }),
              onConfirmText: intl.formatMessage({
                id: ETranslations.global_enable,
              }),
              onCancel: (close) => {
                void close();
                resolve(false);
              },
              onConfirm: async () => {
                try {
                  await backgroundApiProxy.serviceHardware.setPassphraseEnabled(
                    {
                      walletId: '',
                      connectId: p?.connectId,
                      featuresDeviceId: p?.deviceId,
                      passphraseEnabled: true,
                    },
                  );
                  resolve(true);
                  i -= 1;
                } catch {
                  resolve(false);
                }
              },
            });
          });
        }

        if (!passphraseEnabled && !deviceCommunicationError) {
          setRevokeTxsStatusMap((prev) => ({
            ...prev,
            [uuid]: {
              status: ERevokeTxStatus.Failed,
              skippedReason:
                (error as { data: { data: IOneKeyRpcError } }).data?.data?.res
                  ?.error?.message ??
                (error as Error).message ??
                error,
            },
          }));
        }
      }
    }
    setProgressState(ERevokeProgressState.Finished);
  }, [unsignedTxs, waitUntilInProgress, intl]);

  const renderBulkRevokeAlert = useCallback(() => {
    return (
      <Stack pb="$2" px="$5">
        <Alert
          icon="InfoCircleOutline"
          title={intl.formatMessage({
            id: ETranslations.wallet_approval_bulk_revoke_alert,
          })}
          type="warning"
        />
      </Stack>
    );
  }, [intl]);

  const renderBulkRevokeList = useCallback(() => {
    return (
      <Stack flex={1} pb="$5">
        <Accordion
          overflow="hidden"
          width="100%"
          type="multiple"
          defaultValue={[]}
        >
          {unsignedTxs?.map((tx) => (
            <BulkRevokeItem
              key={tx.uuid ?? ''}
              unsignedTx={tx}
              revokeTxsStatusMap={revokeTxsStatusMap}
              contractMap={contractMap}
            />
          ))}
        </Accordion>
      </Stack>
    );
  }, [unsignedTxs, revokeTxsStatusMap, contractMap]);

  useEffect(() => {
    progressStateRef.current = progressState;
  }, [progressState]);

  useEffect(() => {
    const handleVisibilityStateChange = (visible: boolean) => {
      if (
        visible === false &&
        progressState === ERevokeProgressState.InProgress
      ) {
        setProgressState(ERevokeProgressState.Paused);
        setRevokeTxsStatusMap((prev) => ({
          ...prev,
          [unsignedTxs[currentProcessIndex].uuid ?? '']: {
            status: ERevokeTxStatus.Paused,
          },
        }));
      }
    };
    handleVisibilityStateChange(getCurrentVisibilityState());
    const removeSubscription = onVisibilityStateChange(
      handleVisibilityStateChange,
    );
    return removeSubscription;
  }, [currentProcessIndex, unsignedTxs, progressState]);

  const handleOnConfirm = useCallback(() => {
    if (progressState === ERevokeProgressState.Finished) {
      navigation.popStack();
      return;
    }

    if (progressState === ERevokeProgressState.InProgress) {
      setProgressState(ERevokeProgressState.Paused);
      setRevokeTxsStatusMap((prev) => ({
        ...prev,
        [unsignedTxs[currentProcessIndex].uuid ?? '']: {
          status: ERevokeTxStatus.Paused,
        },
      }));
    } else {
      setProgressState(ERevokeProgressState.InProgress);
      setRevokeTxsStatusMap((prev) => ({
        ...prev,
        [unsignedTxs[currentProcessIndex].uuid ?? '']: {
          status: ERevokeTxStatus.Processing,
        },
      }));
    }
  }, [progressState, navigation, currentProcessIndex, unsignedTxs]);

  return (
    <Page
      scrollEnabled
      onClose={() => {
        if (progressState !== ERevokeProgressState.Finished) {
          isAborted.current = true;
          setProgressState(ERevokeProgressState.Aborted);
        }
      }}
    >
      <Page.Header
        title={intl.formatMessage({
          id: ETranslations.wallet_approval_bulk_revoke,
        })}
      />
      <Page.Body>
        {renderBulkRevokeAlert()}
        {renderBulkRevokeList()}
      </Page.Body>
      <Page.Footer>
        <Page.FooterActions
          onCancel={
            progressState === ERevokeProgressState.Finished
              ? undefined
              : () => {
                  isAborted.current = true;
                  setProgressState(ERevokeProgressState.Aborted);
                  navigation.popStack();
                }
          }
          onConfirm={handleOnConfirm}
          onConfirmText={getConfirmText({
            intl,
            progressState,
          })}
        >
          <YStack
            gap="$1"
            $md={{
              width: '100%',
              pb: '$2.5',
            }}
          >
            <XStack
              alignItems="center"
              gap="$2"
              $md={{
                justifyContent: 'space-between',
              }}
            >
              <SizableText size="$bodyMd" color="$textSubdued">
                {intl.formatMessage({
                  id: ETranslations.global_process,
                })}
              </SizableText>
              <SizableText size="$bodyMdMedium">
                {`${currentProcessIndex + 1}/${
                  unsignedTxs?.length ?? 0
                } (${succeededTxCount} ${intl.formatMessage({
                  id: ETranslations.wallet_approval_bulk_revoke_status_succeeded,
                })}, ${failedTxCount} ${intl.formatMessage({
                  id: ETranslations.wallet_approval_bulk_revoke_status_failed,
                })}, ${skippedTxCount} ${intl.formatMessage({
                  id: ETranslations.wallet_approval_bulk_revoke_status_skipped,
                })})`}
              </SizableText>
            </XStack>
            {progressState === ERevokeProgressState.Finished ? (
              <XStack
                alignItems="center"
                $md={{
                  justifyContent: 'space-between',
                }}
                gap="$2"
              >
                <SizableText size="$bodyMd" color="$textSubdued">
                  {intl.formatMessage({
                    id: ETranslations.wallet_approval_bulk_revoke_total_gas,
                  })}
                </SizableText>
                <NumberSizeableText
                  size="$bodyMdMedium"
                  formatter="value"
                  formatterOptions={{
                    currency: settings.currencyInfo.symbol,
                  }}
                >
                  {totalFeeFiat ?? '-'}
                </NumberSizeableText>
              </XStack>
            ) : null}
          </YStack>
        </Page.FooterActions>
      </Page.Footer>
    </Page>
  );
}

export default BulkRevoke;
