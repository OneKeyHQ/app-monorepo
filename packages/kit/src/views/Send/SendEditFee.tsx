/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/naming-convention */
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { first, last } from 'lodash';
import { Column, Row } from 'native-base';
import { Control, UseFormGetValues, UseFormWatch } from 'react-hook-form';
import { useIntl } from 'react-intl';

import {
  Box,
  Button,
  Center,
  Form,
  Modal,
  NumberInput,
  RadioFee,
  SegmentedControl,
  Spinner,
  Typography,
  useForm,
  useFormState,
  useIsVerticalLayout,
  useSafeAreaInsets,
} from '@onekeyhq/components';
import {
  OneKeyError,
  OneKeyErrorClassNames,
  OneKeyValidatorError,
} from '@onekeyhq/engine/src/errors';
import { EIP1559Fee } from '@onekeyhq/engine/src/types/network';
import {
  IFeeInfo,
  IFeeInfoPayload,
  IFeeInfoSelectedType,
  IFeeInfoUnit,
} from '@onekeyhq/engine/src/types/vault';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import { FormatCurrencyNative } from '../../components/Format';
import { useDebounce } from '../../hooks';
import { useActiveWalletAccount } from '../../hooks/redux';

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
  control: Control<FeeValues>;
  watch: UseFormWatch<FeeValues>;
  getValues: UseFormGetValues<FeeValues>;
};
function CustomFeeForm(props: ICustomFeeFormProps) {
  const { feeInfoPayload, control, watch, getValues } = props;
  const intl = useIntl();
  const feeSymbol = feeInfoPayload?.info?.symbol || '';
  const isEIP1559Fee = feeInfoPayload?.info?.eip1559;
  const lastPresetFeeInfo = last(feeInfoPayload?.info?.prices ?? []);
  const fistPresetFeeInfo = first(feeInfoPayload?.info?.prices ?? []);
  // TODO remove
  const formValues = watch();
  const isSmallScreen = useIsVerticalLayout();
  const { networkId } = useActiveWalletAccount();

  const [gasLimitTip, setGasLimitTip] = useState<string | undefined>(undefined);
  const [maxPriorityFeeTip, setMaxPriorityFeeTip] = useState<
    string | undefined
  >(undefined);
  const [maxFeeTip, setMaxFeeTip] = useState<string | undefined>(undefined);

  // MIN: (baseFee + maxPriorityFeePerGas) * limit
  // MAX: maxFeePerGas * limit
  /*
  baseFee: "0.000004248"
  maxFeePerGas: "36.66000144"
  maxPriorityFeePerGas: "36.65999719128"
   */

  const totalFeeRange = useMemo(() => {
    if (isEIP1559Fee) {
      return calculateTotalFeeRange({
        eip1559: true,
        limit: formValues.gasLimit,
        price: {
          baseFee: formValues.baseFee,
          maxFeePerGas: formValues.maxFeePerGas,
          maxPriorityFeePerGas: formValues.maxPriorityFeePerGas,
        },
      });
    }
    return calculateTotalFeeRange({
      limit: formValues.gasLimit,
      price: formValues.gasPrice,
    });
  }, [
    formValues.baseFee,
    formValues.gasLimit,
    formValues.gasPrice,
    formValues.maxFeePerGas,
    formValues.maxPriorityFeePerGas,
    isEIP1559Fee,
  ]);

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
                await backgroundApiProxy.validator.validateMaxPriortyFee(
                  networkId,
                  value,
                  lowFee?.maxPriorityFeePerGas,
                  highFee?.maxPriorityFeePerGas,
                );
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
          <NumberInput
            w="100%"
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
                await backgroundApiProxy.validator.validateMaxFee(
                  networkId,
                  value,
                  getValues('maxPriorityFeePerGas'),
                  lowFee?.maxFeePerGas,
                  highFee?.maxFeePerGas,
                );
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
          <NumberInput
            w="100%"
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
            required: intl.formatMessage({ id: 'content__gas_price' }),
          }}
          defaultValue=""
        >
          <NumberInput
            w="100%"
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
              await backgroundApiProxy.validator.validateGasLimit(
                networkId,
                value,
                limitCalculated,
              );
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
        <NumberInput w="100%" size={isSmallScreen ? 'xl' : undefined} />
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
        const totalFee = max;
        const totalFeeNative = calculateTotalFeeNative({
          amount: totalFee,
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
  React.useLayoutEffect(() => {
    // disable animation if auto navigate
    if (autoConfirmAfterFeeSaved) {
      navigation.setOptions({
        // animation: 'none', // for native
        animationEnabled: false, // for web
      });
    }
  }, [navigation, autoConfirmAfterFeeSaved]);
  const { feeInfoPayload, feeInfoLoading, getSelectedFeeInfoUnit } =
    useFeeInfoPayload({
      encodedTx,
      fetchAnyway: true,
    });
  const isEIP1559Fee = feeInfoPayload?.info?.eip1559;

  useEffect(() => {
    debugLogger.sendTx('SendEditFee  >>>>  ', feeInfoPayload, encodedTx);
  }, [encodedTx, feeInfoPayload]);

  const [feeType, setFeeType] = useState<FeeType | null>(null);
  const [radioValue, setRadioValue] = useState('');

  const isSmallScreen = useIsVerticalLayout();
  const { control, handleSubmit, setValue, watch, getValues } =
    useForm<FeeValues>({
      mode: 'onBlur',
      reValidateMode: 'onBlur',
    });
  const { isValid } = useFormState({ control });
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const isValidDebounced = useDebounce(isValid, 300);
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
    const selected = feeInfoPayload?.selected;
    let type = selected?.type ?? 'preset';
    if (!feeInfoPayload || !feeInfoPayload?.info?.prices?.length) {
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
      const customValues = selected?.custom ?? {};
      setFeeType(FeeType.advanced);
      if (customValues) {
        setFormValuesFromFeeInfo(customValues);
      }
    }
  }, [
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
        feeInfoPayload={feeInfoPayload}
        control={control}
        watch={watch}
        getValues={getValues}
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
        children: content,
      }}
    />
  );
}

export default ScreenSendEditFee;
