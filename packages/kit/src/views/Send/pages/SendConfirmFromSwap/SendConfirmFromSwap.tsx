import { useCallback, useEffect, useRef } from 'react';

import { useRoute } from '@react-navigation/core';
import { StackActions, useNavigation } from '@react-navigation/native';
import { AppState } from 'react-native';

import { Page, Spinner, Stack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import type {
  EModalSendRoutes,
  IModalSendParamList,
} from '@onekeyhq/shared/src/routes';
import { EModalSignatureConfirmRoutes } from '@onekeyhq/shared/src/routes';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { waitAsync } from '@onekeyhq/shared/src/utils/promiseUtils';
import type {
  IFeeInfoUnit,
  IGasEIP1559,
  IGasLegacy,
} from '@onekeyhq/shared/types/fee';
import type { ISendTxOnSuccessData } from '@onekeyhq/shared/types/tx';

import type { RouteProp } from '@react-navigation/core';
import type { StackActionType } from '@react-navigation/native';

function SendConfirmFromSwap() {
  const pendingAction = useRef<StackActionType>(undefined);
  const navigation = useNavigation();
  const appNavigation = useAppNavigation();

  const navigationToNext = useRef(false);

  const route =
    useRoute<
      RouteProp<IModalSendParamList, EModalSendRoutes.SendConfirmFromSwap>
    >();

  const { networkId, accountId, unsignedTxs, onSuccess, onFail, onCancel } =
    route.params;

  const signatureConfirmRoute = EModalSignatureConfirmRoutes.TxConfirm;

  const handleConfirmMultiTxsOnHwOrExternal = useCallback(
    async (
      multiTxsFeeResult:
        | {
            common: {
              baseFee: string | undefined;
              feeDecimals: number;
              feeSymbol: string;
              nativeDecimals: number;
              nativeSymbol: string;
              nativeTokenPrice: number | undefined;
            };
            txFees: {
              gas: IGasLegacy[];
              gasEIP1559: IGasEIP1559[];
            }[];
          }
        | undefined,
    ) => {
      let prevTxFeeInfo: IFeeInfoUnit | undefined;

      for (let i = 0, len = unsignedTxs.length; i < len; i += 1) {
        const unsignedTx = unsignedTxs[i];
        if (multiTxsFeeResult) {
          unsignedTx.feesInfo = {
            common: multiTxsFeeResult.common,
            gas: multiTxsFeeResult.txFees[i].gas,
            gasEIP1559: multiTxsFeeResult.txFees[i].gasEIP1559,
          };
        } else if (prevTxFeeInfo) {
          unsignedTx.feeInfo = prevTxFeeInfo;
        }
        const isLastTx = i === len - 1;
        const isFirstTx = i === 0;

        if (!isFirstTx) {
          await waitAsync(300);
        }

        const result: ISendTxOnSuccessData[] = await new Promise((resolve) => {
          appNavigation.push(signatureConfirmRoute, {
            ...route.params,
            popStack: false,
            unsignedTxs: [unsignedTx],
            onSuccess: (data: ISendTxOnSuccessData[]) => {
              if (isLastTx) {
                appNavigation.pop();
                onSuccess?.(data);
              }
              resolve(data);
            },
            onFail: (error: Error) => {
              appNavigation.pop();
              onFail?.(error);
            },
            onCancel: () => {
              appNavigation.pop();
              onCancel?.();
            },
          });
        });

        if (result && result.length > 0 && result[0].feeInfo) {
          prevTxFeeInfo = result[0].feeInfo;
        }
      }
    },
    [
      unsignedTxs,
      appNavigation,
      signatureConfirmRoute,
      route.params,
      onSuccess,
      onFail,
      onCancel,
    ],
  );

  const navigationToSendConfirm = useCallback(async () => {
    let action: any;
    let batchEstimateButSingleConfirm = false;
    const isMultiTxs = unsignedTxs.length > 1;
    if (
      isMultiTxs &&
      (accountUtils.isHwAccount({ accountId }) ||
        accountUtils.isExternalAccount({ accountId }))
    ) {
      batchEstimateButSingleConfirm = true;
      const vaultSettings =
        await backgroundApiProxy.serviceNetwork.getVaultSettings({
          networkId,
        });
      if (vaultSettings.supportBatchEstimateFee?.[networkId]) {
        try {
          const encodedTxList = unsignedTxs.map((tx) => tx.encodedTx);
          const multiTxsFeeResult =
            await backgroundApiProxy.serviceGas.batchEstimateFee({
              accountId,
              networkId,
              encodedTxs: encodedTxList,
            });
          navigationToNext.current = true;
          if (multiTxsFeeResult.txFees.length === unsignedTxs.length) {
            await handleConfirmMultiTxsOnHwOrExternal(multiTxsFeeResult);
          } else {
            await handleConfirmMultiTxsOnHwOrExternal(undefined);
          }
        } catch (e) {
          await handleConfirmMultiTxsOnHwOrExternal(undefined);
        }
      } else {
        await handleConfirmMultiTxsOnHwOrExternal(undefined);
      }
    }

    navigationToNext.current = true;

    if (!batchEstimateButSingleConfirm) {
      action = StackActions.replace(signatureConfirmRoute, {
        ...route.params,
        // @ts-ignore
        _disabledAnimationOfNavigate: true,
      });
    }

    if (action) {
      if (AppState.currentState === 'active') {
        setTimeout(() => navigation.dispatch(action));
      } else {
        pendingAction.current = action;
      }
    }
  }, [
    accountId,
    handleConfirmMultiTxsOnHwOrExternal,
    navigation,
    networkId,
    route.params,
    signatureConfirmRoute,
    unsignedTxs,
  ]);

  const handleOnClose = () => {
    if (!navigationToNext.current) {
      onCancel?.();
    }
  };

  useEffect(() => {
    void navigationToSendConfirm();
  }, [navigation, navigationToSendConfirm, route.params, unsignedTxs]);

  return (
    <Page onClose={handleOnClose}>
      <Page.Body>
        <Stack h="100%" justifyContent="center" alignContent="center">
          <Spinner size="large" />
        </Stack>
      </Page.Body>
    </Page>
  );
}
export default SendConfirmFromSwap;
