/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/naming-convention */
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import BigNumber from 'bignumber.js';
import { cloneDeep, first, last } from 'lodash';
import { Column, Row } from 'native-base';
import { UseFormReturn } from 'react-hook-form';
import { useIntl } from 'react-intl';

import {
  Box,
  Button,
  Center,
  Form,
  Modal,
  RadioFee,
  SegmentedControl,
  Spinner,
  Typography,
  useForm,
  useIsVerticalLayout,
  useSafeAreaInsets,
} from '@onekeyhq/components';
import {
  OneKeyError,
  OneKeyErrorClassNames,
  OneKeyValidatorError,
} from '@onekeyhq/engine/src/errors';
import { EIP1559Fee } from '@onekeyhq/engine/src/types/network';
import { IEncodedTxEvm } from '@onekeyhq/engine/src/vaults/impl/evm/Vault';
import {
  IFeeInfo,
  IFeeInfoPayload,
  IFeeInfoSelectedType,
  IFeeInfoUnit,
} from '@onekeyhq/engine/src/vaults/types';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import { FormatCurrencyNative } from '../../components/Format';
import { useActiveWalletAccount } from '../../hooks/redux';
import { useDisableNavigationAnimation } from '../../hooks/useDisableNavigationAnimation';
import { useFormOnChangeDebounced } from '../../hooks/useFormOnChangeDebounced';

import { DecodeTxButtonTest } from './DecodeTxButtonTest';
import { SendRoutes, SendRoutesParams } from './types';
import {
  calculateTotalFeeNative,
  calculateTotalFeeRange,
  useFeeInfoPayload,
} from './useFeeInfoPayload';

import type { StackNavigationProp } from '@react-navigation/stack';

type FeeValues = {
  gasPrice: string;
  gasLimit: string;
  maxPriorityFeePerGas: string;
  maxFeePerGas: string;
  baseFee: string;
  totalFee: string;
};

enum FeeType {
  standard = 'standard',
  advanced = 'advanced',
}

type RouteProps = RouteProp<SendRoutesParams, SendRoutes.SendEditFee>;
type NavigationProps = StackNavigationProp<
  SendRoutesParams,
  SendRoutes.SendEditFee
>;

const PRICE_UP_RATIO = 1.1;

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

export function FeeSpeedLabel({ index }: { index: number | string }) {
  const intl = useIntl();
  const indexInt = parseInt(index as string, 10);
  let title = `🚅  ${intl.formatMessage({ id: 'content__fast' })}`;
  if (indexInt === 0) {
    title = `🚗  ${intl.formatMessage({ id: 'content__normal' })}`;
  }
  if (indexInt === 1) {
    title = `🚅  ${intl.formatMessage({ id: 'content__fast' })}`;
  }
  if (indexInt === 2) {
    title = `🚀  ${intl.formatMessage({ id: 'content__rapid' })}`;
  }
  return <>{title}</>;
}

export function FeeSpeedTime({ index }: { index: number | string }) {
  const intl = useIntl();
  const indexInt = parseInt(index as string, 10);
  let title = intl.formatMessage({ id: 'content__likely_less_than_15s' });
  if (indexInt === 0) {
    title = intl.formatMessage({ id: 'content__maybe_in_30s' });
  }
  if (indexInt === 1) {
    title = intl.formatMessage({ id: 'content__likely_less_than_15s' });
  }
  if (indexInt === 2) {
    title = intl.formatMessage({ id: 'content__very_likely_less_than_15s' });
  }
  return <>{title}</>;
}

function printError(error: OneKeyError | any) {
  const e = error as OneKeyError;
  console.error({
    message: e.message,
    key: e.key,
    info: e.info,
    className: e.className,
  });
}

function FeeTipsWarning({ message }: { message: string }) {
  if (!message) {
    return null;
  }
  return (
    <Typography.Caption color="text-warning">{message}</Typography.Caption>
  );
}

export type ICustomFeeFormProps = {
  feeInfoPayload: IFeeInfoPayload | null;
  useFormReturn: UseFormReturn<FeeValues, any>;
  autoConfirmAfterFeeSaved: boolean | undefined;
};
function CustomFeeForm(props: ICustomFeeFormProps) {
  const { feeInfoPayload, useFormReturn, autoConfirmAfterFeeSaved } = props;
  const { control, getValues } = useFormReturn;
  const intl = useIntl();
  const [totalFeeRange, setTotalFeeRange] = useState({
    max: '0',
    min: '0',
  });
  const selectedFeeInfo = feeInfoPayload?.selected;

  const feeSymbol = feeInfoPayload?.info?.symbol || '';
  const isEIP1559Fee = feeInfoPayload?.info?.eip1559;
  const lastPresetFeeInfo = last(feeInfoPayload?.info?.prices ?? []);
  const fistPresetFeeInfo = first(feeInfoPayload?.info?.prices ?? []);
  const isSmallScreen = useIsVerticalLayout();
  const { networkId } = useActiveWalletAccount();

  const [gasLimitTip, setGasLimitTip] = useState<string | undefined>(undefined);
  const [gasPriceTip, setGasPriceTip] = useState<string | undefined>(undefined);
  const [maxPriorityFeeTip, setMaxPriorityFeeTip] = useState<
    string | undefined
  >(undefined);
  const [maxFeeTip, setMaxFeeTip] = useState<string | undefined>(undefined);

  const updateTotalFeeRange = useCallback(() => {
    let feeRange;
    if (isEIP1559Fee) {
      feeRange = calculateTotalFeeRange({
        eip1559: true,
        limit: getValues('gasLimit'),
        price: {
          baseFee: getValues('baseFee'),
          maxFeePerGas: getValues('maxFeePerGas'),
          maxPriorityFeePerGas: getValues('maxPriorityFeePerGas'),
        },
      });
    } else {
      feeRange = calculateTotalFeeRange({
        limit: getValues('gasLimit'),
        price: getValues('gasPrice'),
      });
    }
    setTotalFeeRange(feeRange);
  }, [getValues, isEIP1559Fee]);

  useFormOnChangeDebounced<FeeValues>({
    useFormReturn,
    revalidate: true,
    onChange: updateTotalFeeRange,
  });

  useEffect(() => {
    updateTotalFeeRange();
  }, [updateTotalFeeRange]);

  return (
    <Form mt={8}>
      {isEIP1559Fee && (
        <Form.Item
          label={`${intl.formatMessage({
            id: 'content__base_fee',
          })} (${feeSymbol})`}
          control={control}
          name="baseFee"
          defaultValue=""
          formControlProps={{ isReadOnly: true }}
        >
          <Form.Input
            w="100%"
            rightText=""
            size={isSmallScreen ? 'xl' : undefined}
          />
        </Form.Item>
      )}
      {isEIP1559Fee && (
        <Form.Item
          label={`${intl.formatMessage({
            id: 'content__max_priority_fee',
          })} (${feeSymbol})`}
          control={control}
          name="maxPriorityFeePerGas"
          defaultValue=""
          rules={{
            validate: async (value) => {
              const lowFee = fistPresetFeeInfo as EIP1559Fee;
              const highFee = lastPresetFeeInfo as EIP1559Fee;

              // getValues
              try {
                await backgroundApiProxy.validator.validateMaxPriortyFee({
                  networkId,
                  value,
                  lowValue: lowFee?.maxPriorityFeePerGas,
                  highValue: highFee?.maxPriorityFeePerGas,
                  minValue:
                    autoConfirmAfterFeeSaved && selectedFeeInfo?.custom?.price
                      ? new BigNumber(
                          (
                            selectedFeeInfo?.custom?.price as
                              | EIP1559Fee
                              | undefined
                          )?.maxPriorityFeePerGas as string,
                        )
                          .times(PRICE_UP_RATIO)
                          .toFixed()
                      : '0',
                });
                setMaxPriorityFeeTip(undefined);
              } catch (error) {
                printError(error);
                const e = error as OneKeyError;

                if (
                  e?.className === OneKeyErrorClassNames.OneKeyValidatorError
                ) {
                  setMaxPriorityFeeTip(undefined);
                  return intl.formatMessage(
                    {
                      id: e.key as any,
                    },
                    e.info,
                  );
                }
                if (e?.className === OneKeyErrorClassNames.OneKeyValidatorTip) {
                  setMaxPriorityFeeTip(
                    intl.formatMessage(
                      {
                        id: e.key as any,
                      },
                      e.info,
                    ),
                  );
                }
              }
              return true;
            },
          }}
          helpText={
            maxPriorityFeeTip && <FeeTipsWarning message={maxPriorityFeeTip} />
          }
        >
          <Form.NumberInput
            rightText=""
            size={isSmallScreen ? 'xl' : undefined}
          />
        </Form.Item>
      )}
      {isEIP1559Fee && (
        <Form.Item
          label={`${intl.formatMessage({
            id: 'content__max_fee',
          })} (${feeSymbol})`}
          control={control}
          name="maxFeePerGas"
          defaultValue=""
          rules={{
            validate: async (value) => {
              const lowFee = fistPresetFeeInfo as EIP1559Fee;
              const highFee = lastPresetFeeInfo as EIP1559Fee;
              try {
                await backgroundApiProxy.validator.validateMaxFee({
                  networkId,
                  maxPriorityFee: getValues('maxPriorityFeePerGas'),
                  value,
                  lowValue: lowFee?.maxFeePerGas,
                  highValue: highFee?.maxFeePerGas,
                  minValue:
                    autoConfirmAfterFeeSaved && selectedFeeInfo?.custom?.price
                      ? new BigNumber(
                          (
                            selectedFeeInfo?.custom?.price as
                              | EIP1559Fee
                              | undefined
                          )?.maxFeePerGas as string,
                        )
                          .times(PRICE_UP_RATIO)
                          .toFixed()
                      : '0',
                });
                setMaxFeeTip(undefined);
              } catch (error) {
                printError(error);
                const e = error as OneKeyValidatorError;
                if (
                  e?.className === OneKeyErrorClassNames.OneKeyValidatorError
                ) {
                  setMaxFeeTip(undefined);
                  return intl.formatMessage(
                    {
                      id: e.key as any,
                    },
                    e.info,
                  );
                }

                if (e?.className === OneKeyErrorClassNames.OneKeyValidatorTip) {
                  setMaxFeeTip(
                    intl.formatMessage(
                      {
                        id: e.key as any,
                      },
                      e.info,
                    ),
                  );
                }
              }
              return true;
            },
          }}
          helpText={maxFeeTip && <FeeTipsWarning message={maxFeeTip} />}
        >
          <Form.NumberInput
            rightText=""
            size={isSmallScreen ? 'xl' : undefined}
          />
        </Form.Item>
      )}

      {!isEIP1559Fee && (
        <Form.Item
          label={intl.formatMessage({ id: 'content__gas_price' })}
          control={control}
          name="gasPrice"
          rules={{
            validate: async (value) => {
              const lowValue = fistPresetFeeInfo as string;
              const highValue = lastPresetFeeInfo as string;
              try {
                await backgroundApiProxy.validator.validateGasPrice({
                  networkId,
                  value,
                  minValue:
                    autoConfirmAfterFeeSaved && selectedFeeInfo?.custom?.price
                      ? new BigNumber(selectedFeeInfo?.custom?.price as string)
                          .times(PRICE_UP_RATIO)
                          .toFixed()
                      : '0',
                  lowValue,
                  highValue,
                });
                setGasPriceTip(undefined);
              } catch (error) {
                printError(error);
                const e = error as OneKeyError;
                if (
                  e?.className === OneKeyErrorClassNames.OneKeyValidatorError
                ) {
                  setGasPriceTip(undefined);
                  return intl.formatMessage(
                    {
                      id: e.key as any,
                    },
                    e.info,
                  );
                }
                if (e?.className === OneKeyErrorClassNames.OneKeyValidatorTip) {
                  setGasPriceTip(
                    intl.formatMessage(
                      {
                        id: e.key as any,
                      },
                      e.info,
                    ),
                  );
                }
              }
              return true;
            },
          }}
          defaultValue=""
          helpText={gasPriceTip && <FeeTipsWarning message={gasPriceTip} />}
        >
          <Form.NumberInput
            size={isSmallScreen ? 'xl' : undefined}
            decimal={3}
          />
        </Form.Item>
      )}

      <Form.Item
        label={intl.formatMessage({ id: 'content__gas_limit' })}
        control={control}
        name="gasLimit"
        rules={{
          validate: async (value) => {
            const limitCalculated = feeInfoPayload?.info?.limit;
            try {
              await backgroundApiProxy.validator.validateGasLimit({
                networkId,
                value,
                highValue: limitCalculated,
              });
              setGasLimitTip(undefined);
            } catch (error) {
              printError(error);
              const e = error as OneKeyError;

              if (e?.className === OneKeyErrorClassNames.OneKeyValidatorError) {
                setGasLimitTip(undefined);
                return intl.formatMessage(
                  {
                    id: e.key as any,
                  },
                  e.info,
                );
              }
              if (e?.className === OneKeyErrorClassNames.OneKeyValidatorTip) {
                setGasLimitTip(
                  intl.formatMessage(
                    {
                      id: e.key as any,
                    },
                    e.info,
                  ),
                );
              }
            }
            return true;
          },
        }}
        defaultValue=""
        helpText={gasLimitTip && <FeeTipsWarning message={gasLimitTip} />}
      >
        <Form.NumberInput size={isSmallScreen ? 'xl' : undefined} />
      </Form.Item>

      <Form.Item
        name="totalFee"
        control={control}
        label={intl.formatMessage({ id: 'content__fee' })}
      >
        <Typography.Body2 color="text-subdued">
          {totalFeeRange.min === totalFeeRange.max
            ? totalFeeRange.max
            : `${totalFeeRange.min} - ${totalFeeRange.max}`}{' '}
          {feeSymbol}
        </Typography.Body2>
      </Form.Item>
    </Form>
  );
}

export type IStandardFeeProps = {
  feeInfoPayload: IFeeInfoPayload | null;
  value: string;
  onChange: (v: string) => void;
};
function StandardFee({ feeInfoPayload, value, onChange }: IStandardFeeProps) {
  const gasList = useMemo(
    () => feeInfoPayload?.info?.prices ?? [],
    [feeInfoPayload?.info?.prices],
  );
  const gasItems = useMemo(() => {
    if (!gasList) return [];
    const isEIP1559Fee = feeInfoPayload?.info?.eip1559;
    if (isEIP1559Fee) {
      return gasList.map((gas, index) => {
        // const gasInfo = gas as EIP1559Fee;
        const { min, max } = calculateTotalFeeRange({
          eip1559: true,
          limit: feeInfoPayload?.info?.limit,
          price: gas,
        });
        const minFee = min;
        const totalFeeNative = calculateTotalFeeNative({
          amount: max,
          info: feeInfoPayload?.info,
        });

        const minFeeNative = calculateTotalFeeNative({
          amount: minFee,
          info: feeInfoPayload?.info,
        });

        return {
          value: index.toString(),
          title: <FeeSpeedLabel index={index} />,
          titleSecond: <FeeSpeedTime index={index} />,
          describe: (
            <FormatCurrencyNative
              value={minFeeNative}
              render={(ele) => <>~ {!minFeeNative ? '-' : ele}</>}
            />
          ),
          describeSecond: (
            <FormatCurrencyNative
              value={totalFeeNative}
              render={(ele) => <>Max Fee: {!totalFeeNative ? '-' : ele}</>}
            />
          ),
          describeThird: `${totalFeeNative}${
            feeInfoPayload.info.nativeSymbol ?? ''
          }`,
        };
      });
    }

    return gasList.map((gas, index) => {
      const totalFee = calculateTotalFeeRange({
        limit: feeInfoPayload?.info?.limit,
        price: gas,
      }).max;
      const totalFeeNative = calculateTotalFeeNative({
        amount: totalFee,
        info: feeInfoPayload?.info as IFeeInfo,
      });

      return {
        value: index.toString(),
        title: <FeeSpeedLabel index={index} />,
        titleSecond: <FeeSpeedTime index={index} />,
        describe: (
          <FormatCurrencyNative
            value={totalFeeNative}
            render={(ele) => <>~ {!totalFeeNative ? '-' : ele}</>}
          />
        ),
        describeSecond: `${totalFeeNative}${
          feeInfoPayload?.info?.nativeSymbol ?? ''
        }`,
      };
    });
  }, [feeInfoPayload?.info, gasList]);

  return (
    <RadioFee
      padding="0px"
      mt={5}
      items={gasItems}
      name="standard fee group"
      value={value}
      onChange={onChange}
    />
  );
}

export type IEditFeeTabsProps = {
  type: FeeType;
  onChange: (type: string) => void;
};
function EditFeeTabs({ onChange, type }: IEditFeeTabsProps) {
  const intl = useIntl();
  return (
    <SegmentedControl
      options={[
        {
          label: intl.formatMessage({ id: 'content__standard' }),
          value: FeeType.standard,
        },
        {
          label: intl.formatMessage({ id: 'content__advanced' }),
          value: FeeType.advanced,
        },
      ]}
      defaultValue={type}
      onChange={onChange}
    />
  );
}

function ScreenSendEditFee({ ...rest }) {
  const { trigger } = rest;
  const intl = useIntl();
  const navigation = useNavigation<NavigationProps>();
  const route = useRoute<RouteProps>();
  const { encodedTx, autoConfirmAfterFeeSaved } = route.params;

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
      encodedTx: encodedTxForFeeInfo,
      fetchAnyway: true,
    });
  const isEIP1559Fee = feeInfoPayload?.info?.eip1559;

  useEffect(() => {
    debugLogger.sendTx('SendEditFee  >>>>  ', feeInfoPayload, encodedTx);
  }, [encodedTx, feeInfoPayload]);

  const [feeType, setFeeType] = useState<FeeType | null>(null);
  const [radioValue, setRadioValue] = useState('');

  const isSmallScreen = useIsVerticalLayout();
  const useFormReturn = useForm<FeeValues>({
    mode: 'onBlur',
    reValidateMode: 'onBlur',
  });
  const { handleSubmit, setValue, trigger: formTrigger } = useFormReturn;
  const onSubmit = handleSubmit((data) => {
    let type: IFeeInfoSelectedType =
      feeType === FeeType.advanced ? 'custom' : 'preset';
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
    debugLogger.sendTx('SendEditFee Confirm >>>> ', feeInfoSelected);
    const { routes, index } = navigation.getState();
    const prevRouteName = routes[index - 1]?.name;

    if (autoConfirmAfterFeeSaved) {
      return navigation.replace(SendRoutes.SendConfirm, {
        encodedTx,
        actionType: 'cancel',
        feeInfoSelected,
        autoConfirmAfterFeeSaved,
      });
    }

    return navigation.navigate({
      merge: true,
      name: prevRouteName || SendRoutes.SendConfirm,
      params: {
        feeInfoSelected,
        autoConfirmAfterFeeSaved,
      },
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
      feeType !== FeeType.standard ||
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
    if (feeType === FeeType.advanced) {
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
      setFeeType(FeeType.standard);
    } else if (type === 'custom') {
      const customValues = cloneDeep(selected?.custom ?? {});
      setFeeType(FeeType.advanced);
      if (customValues) {
        if (autoConfirmAfterFeeSaved) {
          const highPriceData = last(feeInfoPayload?.info?.prices ?? []);
          // TODO set limit to feeInfoPayload?.info?.limit (21000 in L1) if cancel action
          customValues.limit = selectMaxValue(
            customValues.limit,
            feeInfoPayload?.info?.limit,
            1,
          );
          if (customValues?.eip1559) {
            const eip1559Price = customValues.price as EIP1559Fee;
            if (eip1559Price) {
              const highPriceInfo = highPriceData as EIP1559Fee | undefined;
              eip1559Price.baseFee =
                highPriceInfo?.baseFee ?? eip1559Price.baseFee;
              eip1559Price.maxFeePerGas = selectMaxValue(
                eip1559Price.maxFeePerGas,
                highPriceInfo?.maxFeePerGas,
                PRICE_UP_RATIO,
              );
              eip1559Price.maxPriorityFeePerGas = selectMaxValue(
                eip1559Price.maxPriorityFeePerGas,
                highPriceInfo?.maxPriorityFeePerGas,
                PRICE_UP_RATIO,
              );
            }
          } else {
            const highPriceInfo = highPriceData as string;
            customValues.price = selectMaxValue(
              customValues.price as string,
              highPriceInfo,
              PRICE_UP_RATIO,
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
    setFormValuesFromFeeInfo,
    setValue,
  ]);

  const { bottom } = useSafeAreaInsets();
  const footer = (
    <Column>
      <Row
        justifyContent="flex-end"
        alignItems="center"
        px={{ base: 4, md: 6 }}
        pt={4}
        pb={4 + bottom}
        borderTopWidth={1}
        borderTopColor="border-subdued"
      >
        <Button
          flexGrow={isSmallScreen ? 1 : 0}
          type="primary"
          size={isSmallScreen ? 'xl' : 'base'}
          isDisabled={false}
          onPress={onSubmit}
        >
          {intl.formatMessage({ id: 'action__save' })}
        </Button>
      </Row>
    </Column>
  );

  let content = (
    <Center w="full" py={16}>
      <Spinner size="lg" />
    </Center>
  );

  if (feeType && !feeInfoLoading) {
    const customFeeForm = (
      <CustomFeeForm
        autoConfirmAfterFeeSaved={autoConfirmAfterFeeSaved}
        feeInfoPayload={feeInfoPayload}
        useFormReturn={useFormReturn}
      />
    );
    content = feeInfoPayload ? (
      <>
        <EditFeeTabs
          type={feeType}
          onChange={(value) => {
            setFeeType(value as FeeType);
          }}
        />
        <Box>
          {feeType === FeeType.standard ? (
            <StandardFee
              feeInfoPayload={feeInfoPayload}
              value={radioValue}
              onChange={(value) => {
                setRadioValue(value);
              }}
            />
          ) : (
            customFeeForm
          )}
        </Box>
      </>
    ) : (
      <>
        <Box>{customFeeForm}</Box>
      </>
    );
  }

  return (
    <Modal
      height="598px"
      trigger={trigger}
      primaryActionTranslationId="action__confirm"
      secondaryActionTranslationId="action__reject"
      header={intl.formatMessage({ id: 'action__edit_fee' })}
      footer={footer}
      scrollViewProps={{
        children: (
          <>
            {content}
            <DecodeTxButtonTest encodedTx={encodedTx} />
          </>
        ),
      }}
    />
  );
}

export default ScreenSendEditFee;
