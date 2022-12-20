/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/naming-convention */
import { memo, useCallback, useEffect, useMemo, useState } from 'react';

import { useNavigation, useRoute } from '@react-navigation/native';
import BigNumber from 'bignumber.js';
import { cloneDeep, last } from 'lodash';
import { useIntl } from 'react-intl';

import {
  Box,
  Button,
  Center,
  Spinner,
  useForm,
  useToast,
} from '@onekeyhq/components';
import type { LocaleIds } from '@onekeyhq/components/src/locale';
import type { EIP1559Fee } from '@onekeyhq/engine/src/types/network';
import type { IEncodedTxBtc } from '@onekeyhq/engine/src/vaults/impl/btc/types';
import type { IEncodedTxEvm } from '@onekeyhq/engine/src/vaults/impl/evm/Vault';
import type {
  IFeeInfoSelectedType,
  IFeeInfoUnit,
} from '@onekeyhq/engine/src/vaults/types';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import backgroundApiProxy from '../../../../background/instance/backgroundApiProxy';
import { useActiveSideAccount } from '../../../../hooks';
import { useDisableNavigationAnimation } from '../../../../hooks/useDisableNavigationAnimation';
import { setFeePresetIndex } from '../../../../store/reducers/data';
import { BaseSendModal } from '../../components/BaseSendModal';
import { DecodeTxButtonTest } from '../../components/DecodeTxButtonTest';
import { ESendEditFeeTypes } from '../../enums';
import { SendRoutes } from '../../types';
import {
  IS_REPLACE_ROUTE_TO_FEE_EDIT,
  SEND_EDIT_FEE_PRICE_UP_RATIO,
} from '../../utils/sendConfirmConsts';
import { useFeeInfoPayload } from '../../utils/useFeeInfoPayload';

import { SendEditFeeCustomForm } from './SendEditFeeCustomForm';
import { SendEditFeeStandardForm } from './SendEditFeeStandardForm';
import { SendEditFeeStandardFormLite } from './SendEditFeeStandardFormLite';
import { SendEditFeeTabs } from './SendEditFeeTabs';

import type {
  ISendEditFeeValues,
  SendConfirmParams,
  SendRoutesParams,
} from '../../types';
import type { RouteProp } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';

type RouteProps = RouteProp<SendRoutesParams, SendRoutes.SendEditFee>;
type NavigationProps = StackNavigationProp<
  SendRoutesParams,
  SendRoutes.SendEditFee
>;

function selectMaxValue(
  currentValue: string | undefined,
  highPresetValue: string | undefined,
  times = 1,
) {
  const currentValueBN = new BigNumber(currentValue ?? '').times(times);
  const highPresetValueBN = new BigNumber(highPresetValue ?? '');
  if (highPresetValueBN.isNaN() && currentValueBN.isNaN()) {
    return '0';
  }
  if (highPresetValueBN.isNaN()) {
    return currentValueBN.toFixed();
  }
  if (currentValueBN.isNaN()) {
    return highPresetValueBN.toFixed();
  }
  return currentValueBN.isGreaterThan(highPresetValueBN)
    ? currentValueBN.toFixed()
    : highPresetValueBN.toFixed();
}

function ScreenSendEditFee({ ...rest }) {
  const { trigger } = rest;
  const intl = useIntl();
  const toast = useToast();
  const navigation = useNavigation<NavigationProps>();
  const route = useRoute<RouteProps>();
  // autoConfirmAfterFeeSaved=true speedUp & cancel
  const {
    encodedTx,
    autoConfirmAfterFeeSaved,
    resendActionInfo,
    sendConfirmParams: oldSendConfirmParams,
    networkId,
    accountId,
    forBatchSend,
  } = route.params;
  const { network } = useActiveSideAccount({
    networkId,
    accountId,
  });

  const title = useMemo(() => {
    let key: LocaleIds = 'action__edit_fee';

    if (resendActionInfo?.type === 'speedUp') {
      key = 'form__accelerated_transaction';
    }
    if (resendActionInfo?.type === 'cancel') {
      key = 'form__cancelled_transaction';
    }
    return intl.formatMessage({ id: key });
  }, [intl, resendActionInfo?.type]);

  useDisableNavigationAnimation({
    condition: !!autoConfirmAfterFeeSaved,
  });

  const encodedTxForFeeInfo = useMemo(() => {
    if (autoConfirmAfterFeeSaved) {
      const tx = cloneDeep(encodedTx) as IEncodedTxEvm;
      // delete origin tx limit when speedUp or cancel,
      //      force rpc api to re-calculate latest limit
      delete tx.gasLimit;
      delete tx.gas;
      return tx;
    }
    return encodedTx as IEncodedTxEvm;
  }, [autoConfirmAfterFeeSaved, encodedTx]);
  const { feeInfoPayload, feeInfoLoading, getSelectedFeeInfoUnit } =
    useFeeInfoPayload({
      networkId,
      accountId,
      encodedTx: encodedTxForFeeInfo,
      fetchAnyway: true,
      forBatchSend,
    });
  const isEIP1559Fee = feeInfoPayload?.info?.eip1559;

  useEffect(() => {
    debugLogger.sendTx.info('SendEditFee  >>>>  ', feeInfoPayload, encodedTx);
  }, [encodedTx, feeInfoPayload]);

  const [feeType, setFeeType] = useState<ESendEditFeeTypes>(
    ESendEditFeeTypes.standard,
  );
  const [radioValue, setRadioValue] = useState('');

  // const isSmallScreen = useIsVerticalLayout();
  const useFormReturn = useForm<ISendEditFeeValues>({
    mode: 'onBlur',
    reValidateMode: 'onBlur',
  });
  const { handleSubmit, setValue, trigger: formTrigger } = useFormReturn;

  const onSubmit = handleSubmit(async (data) => {
    let type: IFeeInfoSelectedType =
      feeType === ESendEditFeeTypes.advanced ? 'custom' : 'preset';
    // const values = getValues();
    if (!radioValue && type === 'preset') {
      type = 'custom';
    }
    let priceInfo: string | EIP1559Fee = data.gasPrice || '0';
    if (isEIP1559Fee) {
      priceInfo = {
        baseFee: data.baseFee || '0',
        maxPriorityFeePerGas: data.maxPriorityFeePerGas || '0',
        maxFeePerGas: data.maxFeePerGas || '0',
      };
    }
    const feeInfoSelected = {
      type,
      preset: radioValue || '1',
      custom: {
        eip1559: isEIP1559Fee,
        price: priceInfo,
        limit: data.gasLimit || '0',
      },
    };
    debugLogger.sendTx.info('SendEditFee Confirm >>>> ', feeInfoSelected);
    const { routes, index } = navigation.getState();
    const prevRouteName = routes[index - 1]?.name;

    // SpeedUp, Cancel
    if (autoConfirmAfterFeeSaved) {
      const sendConfirmParams: SendConfirmParams = {
        ...oldSendConfirmParams,
        networkId,
        accountId,
        encodedTx,
        resendActionInfo: route.params.resendActionInfo,
        feeInfoSelected,
        autoConfirmAfterFeeSaved,
        feeInfoUseFeeInTx: false,
        feeInfoEditable: true,
      };
      return navigation.replace(SendRoutes.SendConfirm, sendConfirmParams);
    }

    const params = {
      ...oldSendConfirmParams,
      networkId,
      accountId,
      feeInfoSelected,
      autoConfirmAfterFeeSaved,
    };
    if (network?.settings?.isUTXOModel) {
      try {
        Object.assign(params, {
          encodedTx: await backgroundApiProxy.engine.attachFeeInfoToEncodedTx({
            networkId,
            accountId,
            encodedTx: encodedTx as IEncodedTxBtc,
            feeInfoValue: feeInfoSelected.custom,
          }),
        });
      } catch (e: any) {
        console.error(e);
        const { key: errorKey = '' } = e;
        if (errorKey === 'form__amount_invalid') {
          toast.show({
            title: intl.formatMessage(
              { id: 'form__amount_invalid' },
              { 0: '' },
            ),
          });
        }
        return;
      }
    }

    const toRouteName = prevRouteName || SendRoutes.SendConfirm;
    if (IS_REPLACE_ROUTE_TO_FEE_EDIT) {
      // navigation.navigate() with `merge=true` will fail in firefox
      return navigation.replace(toRouteName, params);
    }

    if (type === 'preset') {
      backgroundApiProxy.dispatch(
        setFeePresetIndex({ networkId, index: radioValue }),
      );
    }

    return navigation.navigate({
      merge: true,
      name: toRouteName,
      params,
    });
  });

  const setFormValuesFromFeeInfo = useCallback(
    (feeInfoValue: IFeeInfoUnit) => {
      const { price, limit } = feeInfoValue;
      if (isEIP1559Fee) {
        const priceInfo = price as EIP1559Fee;
        setValue('baseFee', priceInfo.baseFee);
        setValue('maxFeePerGas', priceInfo.maxFeePerGas);
        setValue('maxPriorityFeePerGas', priceInfo.maxPriorityFeePerGas);
      } else {
        setValue('gasPrice', (price as string) ?? '');
      }
      setValue('gasLimit', limit ?? '');
    },
    [isEIP1559Fee, setValue],
  );

  useEffect(() => {
    if (
      !feeInfoPayload ||
      feeType !== ESendEditFeeTypes.standard ||
      parseFloat(radioValue) < 0 ||
      !radioValue
    ) {
      return;
    }
    const { limit, price } = getSelectedFeeInfoUnit({
      info: feeInfoPayload.info,
      index: radioValue,
    });
    setFormValuesFromFeeInfo({ price, limit });
  }, [
    feeInfoPayload,
    feeType,
    getSelectedFeeInfoUnit,
    isEIP1559Fee,
    radioValue,
    setFormValuesFromFeeInfo,
    setValue,
  ]);

  useEffect(() => {
    if (feeType === ESendEditFeeTypes.advanced) {
      formTrigger();
    }
  }, [feeType, formTrigger]);

  useEffect(() => {
    const selected = feeInfoPayload?.selected;
    let type = selected?.type ?? 'preset';
    if (
      !feeInfoPayload ||
      !feeInfoPayload?.info?.prices?.length ||
      autoConfirmAfterFeeSaved
    ) {
      type = 'custom';
    }
    if (feeInfoPayload && type === 'preset') {
      let presetValue = selected?.preset || '1';
      // preset fix / presetFix
      if (feeInfoPayload?.info?.prices?.length < 2) {
        presetValue = '0';
      }
      setRadioValue(presetValue);
      setFeeType(ESendEditFeeTypes.standard);
    } else if (type === 'custom') {
      const customValues = cloneDeep(selected?.custom ?? {});
      setFeeType(ESendEditFeeTypes.advanced);
      if (customValues) {
        // build fee customValues for speedUp & cancel tx
        if (autoConfirmAfterFeeSaved) {
          const actionType = oldSendConfirmParams?.actionType;
          const highPriceData = last(feeInfoPayload?.info?.prices ?? []);
          const originalTxFeeLimit = customValues.limit;
          const rpcEstimateFeeLimit = feeInfoPayload?.info?.limit;
          customValues.limit = selectMaxValue(
            originalTxFeeLimit,
            rpcEstimateFeeLimit,
            1,
          );
          if (actionType === 'cancel') {
            customValues.limit = selectMaxValue(
              '21000', // cancel action do NOT select originalTxFeeLimit
              rpcEstimateFeeLimit,
              1,
            );
          }

          if (customValues?.eip1559) {
            const eip1559Price = customValues.price as EIP1559Fee;
            if (eip1559Price) {
              const highPriceInfo = highPriceData as EIP1559Fee | undefined;
              eip1559Price.baseFee =
                highPriceInfo?.baseFee ?? eip1559Price.baseFee;
              eip1559Price.maxFeePerGas = selectMaxValue(
                eip1559Price.maxFeePerGas,
                highPriceInfo?.maxFeePerGas,
                SEND_EDIT_FEE_PRICE_UP_RATIO,
              );
              eip1559Price.maxPriorityFeePerGas = selectMaxValue(
                eip1559Price.maxPriorityFeePerGas,
                highPriceInfo?.maxPriorityFeePerGas,
                SEND_EDIT_FEE_PRICE_UP_RATIO,
              );
            }
          } else {
            const highPriceInfo = highPriceData as string;
            customValues.price = selectMaxValue(
              customValues.price as string,
              highPriceInfo,
              SEND_EDIT_FEE_PRICE_UP_RATIO,
            );
          }
        }
        setFormValuesFromFeeInfo(customValues);
      }
    }
  }, [
    autoConfirmAfterFeeSaved,
    feeInfoPayload,
    feeInfoPayload?.selected,
    feeInfoPayload?.selected.type,
    oldSendConfirmParams?.actionType,
    setFormValuesFromFeeInfo,
    setValue,
  ]);

  let content = (
    <Center w="full" py={16}>
      <Spinner size="lg" />
    </Center>
  );

  if (feeType && !feeInfoLoading) {
    const customFeeForm = (
      <SendEditFeeCustomForm
        accountId={accountId}
        networkId={networkId}
        autoConfirmAfterFeeSaved={autoConfirmAfterFeeSaved}
        feeInfoPayload={feeInfoPayload}
        useFormReturn={useFormReturn}
      />
    );
    const presetFeeForm = forBatchSend ? (
      <SendEditFeeStandardFormLite
        feeInfoPayload={feeInfoPayload}
        value={radioValue}
        onChange={(value) => {
          setRadioValue(value);
        }}
      />
    ) : (
      <SendEditFeeStandardForm
        accountId={accountId}
        networkId={networkId}
        feeInfoPayload={feeInfoPayload}
        value={radioValue}
        onChange={(value) => {
          setRadioValue(value);
        }}
      />
    );
    content = feeInfoPayload ? (
      <>
        <SendEditFeeTabs
          type={feeType}
          onChange={(value) => {
            setFeeType(
              value === 0
                ? ESendEditFeeTypes.standard
                : ESendEditFeeTypes.advanced,
            );
          }}
        />
        <Box>
          {feeType === ESendEditFeeTypes.standard
            ? presetFeeForm
            : customFeeForm}
        </Box>
      </>
    ) : (
      <Box>{customFeeForm}</Box>
    );
    if (feeInfoPayload?.info?.customDisabled) {
      content = <Box>{presetFeeForm}</Box>;
    }
  }

  return (
    <BaseSendModal
      networkId={networkId}
      accountId={accountId}
      height="598px"
      trigger={trigger}
      primaryActionTranslationId="action__apply"
      primaryActionProps={{
        isDisabled: feeInfoLoading,
      }}
      onPrimaryActionPress={() => onSubmit()}
      hideSecondaryAction
      onModalClose={() => {
        oldSendConfirmParams?.onModalClose?.();
      }}
      header={title}
      scrollViewProps={{
        children: (
          <>
            {content}
            <DecodeTxButtonTest
              networkId={networkId}
              accountId={accountId}
              encodedTx={encodedTx}
            />
            {platformEnv.isDev && (
              <Button
                onPress={() => {
                  useFormReturn.setValue('maxPriorityFeePerGas', '0.00001');
                  useFormReturn.setValue('maxFeePerGas', '0.00001');
                  useFormReturn.setValue('gasPrice', '0.00001');
                  setFeeType(ESendEditFeeTypes.advanced);
                }}
              >
                Fill 0 Fee
              </Button>
            )}
          </>
        ),
      }}
    />
  );
}

const SendEditFee = memo(ScreenSendEditFee);
export { SendEditFee };
