/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/naming-convention */
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useNavigation, useRoute } from '@react-navigation/native';
import BigNumber from 'bignumber.js';
import { cloneDeep, last } from 'lodash';
import { useIntl } from 'react-intl';

import {
  Box,
  Button,
  Center,
  CheckBox,
  HStack,
  Spinner,
  Text,
  ToastManager,
  useForm,
  useIsVerticalLayout,
} from '@onekeyhq/components';
import type { LocaleIds } from '@onekeyhq/components/src/locale';
import type { EIP1559Fee } from '@onekeyhq/engine/src/types/network';
import type { IEncodedTxBtc } from '@onekeyhq/engine/src/vaults/impl/btc/types';
import type { IEncodedTxEvm } from '@onekeyhq/engine/src/vaults/impl/evm/Vault';
import type {
  IFeeInfoSelected,
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
import { SendModalRoutes } from '../../types';
import { getCustomFeeSpeedInfo } from '../../utils/getCustomFeeSpeedInfo';
import {
  FEE_INFO_POLLING_INTERVAL,
  IS_REPLACE_ROUTE_TO_FEE_EDIT,
  SEND_EDIT_FEE_PRICE_UP_RATIO,
} from '../../utils/sendConfirmConsts';
import { useBtcCustomFee } from '../../utils/useBtcCustomFee';
import { useCustomFee } from '../../utils/useCustomFee';
import { useFeeInfoPayload } from '../../utils/useFeeInfoPayload';
import { useSolCustomFee } from '../../utils/useSolCustomFee';

import { SendEditFeeCustomForm } from './SendEditFeeCustomForm';
import { SendEditFeeStandardForm } from './SendEditFeeStandardForm';
import { SendEditFeeStandardFormLite } from './SendEditFeeStandardFormLite';

import type {
  ISendEditFeeValues,
  SendConfirmParams,
  SendRoutesParams,
} from '../../types';
import type { RouteProp } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';

type RouteProps = RouteProp<SendRoutesParams, SendModalRoutes.SendEditFee>;
type NavigationProps = StackNavigationProp<
  SendRoutesParams,
  SendModalRoutes.SendEditFee
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

  const [blockNativeInit, setBlockNativeInit] = useState(false);
  const [saveCustom, setSaveCustom] = useState(false);
  const [currentCustom, setCurrentCustom] = useState<IFeeInfoUnit | null>(null);
  const customFeeSynced = useRef<boolean>(false);
  const radioValueInit = useRef<boolean>(false);
  const [feeType, setFeeType] = useState<ESendEditFeeTypes>(
    ESendEditFeeTypes.standard,
  );
  const [radioValue, setRadioValue] = useState('');

  const intl = useIntl();

  const isVertical = useIsVerticalLayout();

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
      ignoreFetchFeeCalling: oldSendConfirmParams?.ignoreFetchFeeCalling,
      useFeeInTx: oldSendConfirmParams?.feeInfoUseFeeInTx,
      forBatchSend,
      pollingInterval: FEE_INFO_POLLING_INTERVAL,
      shouldStopPolling: feeType === ESendEditFeeTypes.advanced,
    });

  const isEIP1559Fee = feeInfoPayload?.info?.eip1559;
  const isBtcForkChain = feeInfoPayload?.info?.isBtcForkChain;
  const isSolChain = feeInfoPayload?.info?.isSolChain;

  useEffect(() => {
    debugLogger.sendTx.info('SendEditFee  >>>>  ', feeInfoPayload, encodedTx);
  }, [encodedTx, feeInfoPayload]);

  const title = useMemo(() => {
    let key: LocaleIds = 'action__edit_fee';

    if (resendActionInfo?.type === 'speedUp') {
      key = 'form__accelerated_transaction';
    }
    if (resendActionInfo?.type === 'cancel') {
      key = 'form__cancelled_transaction';
    }
    if (feeType === ESendEditFeeTypes.advanced) {
      key = 'title__custom';
    }
    return intl.formatMessage({ id: key });
  }, [intl, resendActionInfo?.type, feeType]);

  // const isSmallScreen = useIsVerticalLayout();
  const useFormReturn = useForm<ISendEditFeeValues>({
    mode: 'onBlur',
    reValidateMode: 'onBlur',
  });
  const {
    handleSubmit,
    setValue,
    trigger: formTrigger,
    formState,
    watch,
  } = useFormReturn;

  const currentFeeType = useMemo<IFeeInfoSelectedType>(
    () =>
      feeType === ESendEditFeeTypes.advanced || radioValue === 'custom'
        ? 'custom'
        : 'preset',
    [feeType, radioValue],
  );

  const watchBtcFeeRate = watch('feeRate');
  const watchComputeUnitPrice = watch('computeUnitPrice');
  const { btcTxFee } = useBtcCustomFee({
    networkId,
    accountId,
    encodedTx,
    feeRate: watchBtcFeeRate,
    feeType: currentFeeType,
  });
  const { solLimit, solPrice } = useSolCustomFee({
    networkId,
    accountId,
    computeUnitPrice: watchComputeUnitPrice,
    feeType: currentFeeType,
    encodedTx,
  });
  const { customFee, updateCustomFee } = useCustomFee(networkId);

  const onSubmit = handleSubmit(async (data) => {
    let type = currentFeeType;
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

    const feeInfoSelected: IFeeInfoSelected = {
      type,
      preset: radioValue || '1',
    };

    const custom = {
      eip1559: isEIP1559Fee,
      limit: data.gasLimit || '0',
      waitingSeconds: 0,
      similarToPreset: '0',
      ...(isEIP1559Fee
        ? { price1559: priceInfo as EIP1559Fee }
        : { price: priceInfo as string }),
      ...(isBtcForkChain ? { feeRate: data.feeRate } : {}),
      ...(isSolChain ? { computeUnitPrice: data.computeUnitPrice } : {}),
    };

    if (type === 'custom') {
      feeInfoSelected.custom = custom;

      const { customSimilarToPreset, customWaitingSeconds } =
        getCustomFeeSpeedInfo({
          custom: feeInfoSelected.custom,
          prices: feeInfoPayload?.info.prices ?? [],
          waitingSeconds: feeInfoPayload?.info.waitingSeconds ?? [],
          isEIP1559Fee,
        });

      feeInfoSelected.custom.similarToPreset = customSimilarToPreset;
      feeInfoSelected.custom.waitingSeconds = customWaitingSeconds;

      if (isBtcForkChain) {
        feeInfoSelected.custom.isBtcForkChain = isBtcForkChain;
        if (data.feeRate) {
          feeInfoSelected.custom.btcFee = parseInt(btcTxFee || '0');
        }
      }

      if (isSolChain) {
        feeInfoSelected.custom.isSolChain = isSolChain;
        feeInfoSelected.custom.limit = solLimit;
        feeInfoSelected.custom.limitForDisplay = solLimit;
        feeInfoSelected.custom.price = solPrice;
      }

      setCurrentCustom(feeInfoSelected.custom);
    }

    if (feeType === ESendEditFeeTypes.advanced) {
      if (saveCustom) {
        const customFeeToUpdate = {
          ...custom,
          feeRate: isSolChain ? custom.computeUnitPrice : custom.feeRate,
        };
        updateCustomFee(customFeeToUpdate);
      } else {
        updateCustomFee(null);
      }
    }

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
      return navigation.replace(SendModalRoutes.SendConfirm, sendConfirmParams);
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
            feeInfoValue: custom,
          }),
        });
      } catch (e: any) {
        console.error(e);
        const { key: errorKey = '' } = e;
        if (errorKey === 'form__amount_invalid') {
          ToastManager.show({
            title: intl.formatMessage(
              { id: 'form__amount_invalid' },
              { 0: '' },
            ),
          });
        }
        return;
      }
    }

    const toRouteName = prevRouteName || SendModalRoutes.SendConfirm;
    if (IS_REPLACE_ROUTE_TO_FEE_EDIT) {
      // navigation.navigate() with `merge=true` will fail in firefox
      return navigation.replace(toRouteName, params);
    }

    if (type === 'preset') {
      backgroundApiProxy.dispatch(
        setFeePresetIndex({ networkId, index: radioValue }),
      );
    }

    if (feeType === ESendEditFeeTypes.advanced) {
      setRadioValue('custom');
      setFeeType(ESendEditFeeTypes.standard);
      return;
    }

    return navigation.navigate({
      merge: true,
      name: toRouteName,
      params,
    });
  });

  const setFormValuesFromFeeInfo = useCallback(
    (feeInfoValue: IFeeInfoUnit) => {
      const { price, limit, price1559 } = feeInfoValue;
      if (isEIP1559Fee) {
        const priceInfo = price1559 as EIP1559Fee;
        setValue('baseFee', new BigNumber(priceInfo.baseFee).toFixed());
        setValue(
          'maxFeePerGas',
          new BigNumber(priceInfo.maxFeePerGas)
            .times(autoConfirmAfterFeeSaved ? SEND_EDIT_FEE_PRICE_UP_RATIO : 1)
            .toFixed(),
        );
        setValue(
          'maxPriorityFeePerGas',
          new BigNumber(priceInfo.maxPriorityFeePerGas)
            .times(autoConfirmAfterFeeSaved ? SEND_EDIT_FEE_PRICE_UP_RATIO : 1)
            .toFixed(),
        );
      } else {
        setValue('gasPrice', new BigNumber(price ?? 0).toFixed());
      }

      if (isBtcForkChain) {
        if (feeInfoValue.feeRate) {
          setValue('feeRate', feeInfoValue.feeRate);
        } else {
          setValue(
            'feeRate',
            new BigNumber(price ?? 0)
              .shiftedBy(feeInfoPayload.info.feeDecimals ?? 8)
              .toFixed(),
          );
        }
      }
      if (isSolChain) {
        if (feeInfoValue.computeUnitPrice || feeInfoValue.feeRate) {
          setValue(
            'computeUnitPrice',
            feeInfoValue.computeUnitPrice || feeInfoValue.feeRate || '0',
          );
        }
      }

      setValue('gasLimit', new BigNumber(limit ?? 0).toFixed());
    },
    [
      isEIP1559Fee,
      isBtcForkChain,
      isSolChain,
      setValue,
      autoConfirmAfterFeeSaved,
      feeInfoPayload?.info.feeDecimals,
    ],
  );

  useEffect(() => {
    if (
      !feeInfoPayload ||
      feeType !== ESendEditFeeTypes.standard ||
      (parseFloat(radioValue) < 0 && radioValue !== 'custom') ||
      !radioValue
    ) {
      return;
    }

    if (radioValue === 'custom' && currentCustom) {
      setFormValuesFromFeeInfo(currentCustom);
    } else {
      const { limit, price, price1559, eip1559, feeRate, computeUnitPrice } =
        getSelectedFeeInfoUnit({
          info: feeInfoPayload.info,
          index: radioValue,
        });

      if (!currentCustom) {
        setFormValuesFromFeeInfo({
          price,
          price1559,
          limit,
          isBtcForkChain,
          isSolChain,
          eip1559,
          feeRate,
          computeUnitPrice,
        });
      }
    }
  }, [
    currentCustom,
    customFee,
    feeInfoPayload,
    feeType,
    getSelectedFeeInfoUnit,
    isBtcForkChain,
    isEIP1559Fee,
    isSolChain,
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
    const type = selected?.type ?? 'preset';

    if (!feeInfoPayload) {
      return;
    }

    if (feeInfoPayload && type === 'preset') {
      let presetValue = selected?.preset || '1';
      // preset fix / presetFix
      if (feeInfoPayload?.info?.prices?.length < 2) {
        presetValue = '0';
      }
      if (!radioValueInit.current) {
        radioValueInit.current = true;
        setRadioValue(presetValue);
      }
    } else if (type === 'custom') {
      const customValues = currentCustom ?? cloneDeep(selected?.custom ?? {});
      if (customValues) {
        if (!radioValueInit.current) {
          radioValueInit.current = true;
          setRadioValue('custom');
        }
        setCurrentCustom(customValues);
        setFormValuesFromFeeInfo(customValues);
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
            const eip1559Price = customValues.price1559 as EIP1559Fee;
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

          setFeeType(ESendEditFeeTypes.advanced);
        }
      }
    }
  }, [
    autoConfirmAfterFeeSaved,
    currentCustom,
    feeInfoPayload,
    feeInfoPayload?.selected,
    feeInfoPayload?.selected.type,
    oldSendConfirmParams?.actionType,
    setFormValuesFromFeeInfo,
    setValue,
  ]);

  useEffect(() => {
    setSaveCustom(!!customFee);
    if (
      !customFeeSynced.current &&
      customFee !== undefined &&
      feeInfoPayload &&
      feeInfoPayload?.selected.type !== 'custom'
    ) {
      if (customFee) {
        setCurrentCustom({
          ...customFee,
          limit: feeInfoPayload?.info.limit,
        });
      }
      customFeeSynced.current = true;
    }
  }, [customFee, feeInfoPayload]);

  let content = (
    <Center w="full" py={16}>
      <Spinner size="lg" />
    </Center>
  );

  if (feeType && !feeInfoLoading) {
    const customFeeForm = (
      <SendEditFeeCustomForm
        blockNativeInit={blockNativeInit}
        setBlockNativeInit={setBlockNativeInit}
        accountId={accountId}
        networkId={networkId}
        autoConfirmAfterFeeSaved={autoConfirmAfterFeeSaved}
        feeInfoPayload={feeInfoPayload}
        useFormReturn={useFormReturn}
        saveCustom={saveCustom}
        setSaveCustom={setSaveCustom}
        encodedTx={encodedTx}
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
        currentFeeType={currentFeeType}
        currentCustom={currentCustom}
        value={radioValue}
        onChange={(value) => {
          if (value === 'custom') {
            if (currentCustom && radioValue !== 'custom') {
              setRadioValue(value);
            } else {
              setFeeType(ESendEditFeeTypes.advanced);
            }
          } else {
            setRadioValue(value);
          }
        }}
      />
    );
    content = feeInfoPayload ? (
      <Box>
        {feeType === ESendEditFeeTypes.standard ? presetFeeForm : customFeeForm}
      </Box>
    ) : (
      <Box>{customFeeForm}</Box>
    );
    if (feeInfoPayload?.info?.customDisabled) {
      content = <Box>{presetFeeForm}</Box>;
    }
  }

  const isLargeModal =
    !isVertical &&
    !feeInfoLoading &&
    feeType === ESendEditFeeTypes.advanced &&
    blockNativeInit;

  const buttonDisabled = useMemo(() => {
    if (feeInfoLoading) {
      return true;
    }
    if (isBtcForkChain || feeType === ESendEditFeeTypes.advanced) {
      return !formState.isValid;
    }
    return false;
  }, [isBtcForkChain, formState.isValid, feeType, feeInfoLoading]);

  return (
    <BaseSendModal
      size={isLargeModal ? '2xl' : 'xs'}
      networkId={networkId}
      accountId={accountId}
      height="598px"
      trigger={trigger}
      primaryActionTranslationId={
        feeType === ESendEditFeeTypes.advanced
          ? 'action__save'
          : 'action__apply'
      }
      primaryActionProps={{
        isDisabled: buttonDisabled,
      }}
      onPrimaryActionPress={() => onSubmit()}
      hideSecondaryAction
      onModalClose={() => {
        oldSendConfirmParams?.onModalClose?.();
      }}
      onBackActionPress={() => {
        if (feeType === ESendEditFeeTypes.advanced) {
          setFeeType(ESendEditFeeTypes.standard);
        } else if (navigation?.canGoBack?.()) {
          navigation.goBack();
        }
      }}
      header={title}
      footer={
        isLargeModal ? (
          <HStack
            justifyContent="space-between"
            alignItems="center"
            paddingY={4}
            paddingX={6}
            borderTopWidth={1}
            borderTopColor="border-subdued"
          >
            <CheckBox
              onChange={(isSelected) => setSaveCustom(isSelected)}
              isChecked={saveCustom}
            >
              <Text typography="Body2Strong">
                {intl.formatMessage({
                  id: 'action__save_as_default_for_custom',
                })}
              </Text>
            </CheckBox>
            <Button
              isDisabled={!formState.isValid}
              onPress={() => onSubmit()}
              type="primary"
            >
              {intl.formatMessage({ id: 'action__save' })}
            </Button>
          </HStack>
        ) : undefined
      }
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
