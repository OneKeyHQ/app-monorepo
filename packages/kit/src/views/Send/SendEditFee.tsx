/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/naming-convention */
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { useNavigation, useRoute } from '@react-navigation/core';
import { RouteProp } from '@react-navigation/native';
import { Column, Row } from 'native-base';
import { Control, UseFormWatch } from 'react-hook-form';
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
  useIsVerticalLayout,
  useSafeAreaInsets,
} from '@onekeyhq/components';
import {
  OneKeyErrorClassNames,
  OneKeyValidatorError,
  OneKeyValidatorTip,
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
import { useActiveWalletAccount } from '../../hooks/redux';

import { SendRoutes, SendRoutesParams } from './types';
import {
  calculateTotalFeeNative,
  calculateTotalFeeRange,
  useFeeInfoPayload,
} from './useFeeInfoPayload';

import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

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
type NavigationProps = NativeStackNavigationProp<
  SendRoutesParams,
  SendRoutes.SendEditFee
>;

export function FeeSpeedLabel({ index }: { index: number | string }) {
  const intl = useIntl();
  const indexInt = parseInt(index as string, 10);
  let title = `🚗️  ${intl.formatMessage({ id: 'content__normal' })}`;
  if (indexInt === 0) {
    title = `🛴  ${intl.formatMessage({ id: 'content__slow' })}`;
  }
  if (indexInt === 1) {
    title = `🚗️  ${intl.formatMessage({ id: 'content__normal' })}`;
  }
  if (indexInt === 2) {
    title = `🚀  ${intl.formatMessage({ id: 'content__fast' })}`;
  }
  return <>{title}</>;
}

const CustomFeeForm = ({
  feeInfoPayload,
  control,
  watch,
  selectIndex,
}: {
  feeInfoPayload: IFeeInfoPayload | null;
  control: Control<FeeValues>;
  watch: UseFormWatch<FeeValues>;
  selectIndex: string;
}) => {
  const intl = useIntl();
  const feeSymbol = feeInfoPayload?.info?.symbol || '';
  const isEIP1559Fee = feeInfoPayload?.info?.eip1559;
  const formValues = watch();
  const isSmallScreen = useIsVerticalLayout();
  const { networkId } = useActiveWalletAccount();

  const [gasLimitTip, setGasLimitTip] = useState('');
  const [maxFeeTip, setMaxFeeTip] = useState('');
  const [maxPriorityFeeTip, setMaxPriorityFeeTip] = useState('');

  useEffect(() => {
    async function validateGasLimit() {
      try {
        await backgroundApiProxy.validator.validateGasLimit(
          networkId,
          formValues.gasLimit,
          feeInfoPayload?.info?.limit ?? 21000,
        );
      } catch (error) {
        const e = error as OneKeyValidatorTip;
        if (e?.className === OneKeyErrorClassNames.OneKeyValidatorTip) {
          setGasLimitTip(e.key);
          return;
        }
      }
      setGasLimitTip('');
    }
    validateGasLimit();
  }, [feeInfoPayload?.info?.limit, formValues.gasLimit, networkId]);

  useEffect(() => {
    async function validateMaxFee() {
      try {
        const fee = feeInfoPayload?.info?.prices[
          selectIndex as unknown as number
        ] as EIP1559Fee;
        await backgroundApiProxy.validator.validateMaxFee(
          networkId,
          formValues.maxFeePerGas,
          formValues.maxPriorityFeePerGas,
          fee.maxFeePerGas,
        );
      } catch (error) {
        const e = error as OneKeyValidatorTip;
        if (e?.className === OneKeyErrorClassNames.OneKeyValidatorTip) {
          setMaxFeeTip(e.key);
          return;
        }
      }
      setMaxFeeTip('');
    }
    validateMaxFee();
  }, [
    feeInfoPayload?.info?.prices,
    formValues.maxFeePerGas,
    formValues.maxPriorityFeePerGas,
    networkId,
    selectIndex,
  ]);

  useEffect(() => {
    async function validateMaxPriortyFee() {
      try {
        const fee = feeInfoPayload?.info?.prices[
          selectIndex as unknown as number
        ] as EIP1559Fee;
        await backgroundApiProxy.validator.validateMaxPriortyFee(
          networkId,
          formValues.maxPriorityFeePerGas,
          fee.maxPriorityFeePerGas,
        );
      } catch (error) {
        const e = error as OneKeyValidatorTip;
        if (e?.className === OneKeyErrorClassNames.OneKeyValidatorTip) {
          setMaxPriorityFeeTip(e.key);
          return;
        }
      }
      setMaxPriorityFeeTip('');
    }
    validateMaxPriortyFee();
  }, [
    feeInfoPayload?.info?.prices,
    formValues.maxFeePerGas,
    formValues.maxPriorityFeePerGas,
    networkId,
    selectIndex,
  ]);

  // MIN: (baseFee + maxPriorityFeePerGas) * limit
  // MAX: maxFeePerGas * limit
  /*
  baseFee: "0.000004248"
  maxFeePerGas: "36.66000144"
  maxPriorityFeePerGas: "36.65999719128"
   */

  let totalFeeRange = calculateTotalFeeRange({
    limit: formValues.gasLimit,
    price: formValues.gasPrice,
  });
  if (isEIP1559Fee) {
    totalFeeRange = calculateTotalFeeRange({
      eip1559: true,
      limit: formValues.gasLimit,
      price: {
        baseFee: formValues.baseFee,
        maxFeePerGas: formValues.maxFeePerGas,
        maxPriorityFeePerGas: formValues.maxPriorityFeePerGas,
      },
    });
  }
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
          rules={{
            required: intl.formatMessage({
              id: 'form__gas_limit_invalid_min',
            }),
          }}
          formControlProps={{ isReadOnly: true }}
        >
          <Form.Input
            w="100%"
            rightText="-"
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
            required: intl.formatMessage({
              id: 'form__max_priority_fee_invalid_min',
            }),
            validate: async (value) => {
              try {
                await backgroundApiProxy.validator.validateMaxPriortyFee(
                  networkId,
                  value,
                );
              } catch (error) {
                const e = error as OneKeyValidatorError;
                if (
                  e?.className === OneKeyErrorClassNames.OneKeyValidatorError
                ) {
                  return intl.formatMessage({
                    id: e.key as any,
                  });
                }

                return intl.formatMessage({
                  id: 'form__max_priority_fee_invalid_min',
                });
              }
              return true;
            },
          }}
          helpText={() => {
            if (maxPriorityFeeTip !== '') {
              return intl.formatMessage({
                id: maxPriorityFeeTip as any,
              });
            }
            return '';
          }}
        >
          <NumberInput
            w="100%"
            rightText="-"
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
            required: intl.formatMessage({
              id: 'form__max_fee_invalid_too_low',
            }),
            validate: async (value) => {
              try {
                await backgroundApiProxy.validator.validateMaxFee(
                  networkId,
                  value,
                  formValues.maxPriorityFeePerGas,
                );
              } catch (error) {
                const e = error as OneKeyValidatorError;
                if (
                  e?.className === OneKeyErrorClassNames.OneKeyValidatorError
                ) {
                  return intl.formatMessage({
                    id: e.key as any,
                  });
                }

                return intl.formatMessage({
                  id: 'form__max_fee_invalid_too_low',
                });
              }
              return true;
            },
          }}
          helpText={() => {
            if (maxFeeTip !== '') {
              return intl.formatMessage({
                id: maxFeeTip as any,
              });
            }
            return '';
          }}
        >
          <NumberInput
            w="100%"
            rightText="-"
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
          required: intl.formatMessage({
            id: 'form__gas_limit_invalid_min',
          }),
          validate: async (value) => {
            try {
              await backgroundApiProxy.validator.validateGasLimit(
                networkId,
                value,
                feeInfoPayload?.info?.limit ?? 21000,
              );
            } catch (error) {
              const e = error as OneKeyValidatorError;
              if (e?.className === OneKeyErrorClassNames.OneKeyValidatorError) {
                return intl.formatMessage({
                  id: e.key as any,
                });
              }

              return intl.formatMessage({ id: 'form__gas_limit_invalid_min' });
            }

            return true;
          },
        }}
        defaultValue=""
        helpText={() => {
          if (gasLimitTip !== '') {
            return intl.formatMessage({ id: gasLimitTip as any });
          }
          return '';
        }}
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
};

const StandardFee = ({
  feeInfoPayload,
  value,
  onChange,
}: {
  feeInfoPayload: IFeeInfoPayload | null;
  value: string;
  onChange: (v: string) => void;
}) => {
  const feeSymbol = feeInfoPayload?.info?.symbol || '';
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
          titleSecond: ``,
          describe: (
            <FormatCurrencyNative
              value={minFeeNative}
              render={(ele) => (
                <Typography.Body2 mt={1} color="text-subdued">
                  ~ {!minFeeNative ? '-' : ele}
                </Typography.Body2>
              )}
            />
          ),
          describeSecond: (
            <FormatCurrencyNative
              value={totalFeeNative}
              render={(ele) => (
                <Typography.Body2 mt={1} color="text-subdued">
                  Max Fee: {!totalFeeNative ? '-' : ele}
                </Typography.Body2>
              )}
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
        titleSecond: `≈ ${totalFee} ${feeSymbol}`,
        describe: `${gas as string} ${feeSymbol}`,
        describeSecond: (
          <FormatCurrencyNative
            value={totalFeeNative}
            render={(ele) => (
              <Typography.Body2 mt={1} color="text-subdued">
                {!totalFeeNative ? '-' : ele}
              </Typography.Body2>
            )}
          />
        ),
      };
    });
  }, [feeInfoPayload?.info, feeSymbol, gasList]);

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
};

const EditFeeTabs = ({
  onChange,
  type,
}: {
  type: FeeType;
  onChange: (type: string) => void;
}) => {
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
};
const TransactionEditFee = ({ ...rest }) => {
  const { trigger } = rest;
  const intl = useIntl();
  const navigation = useNavigation<NavigationProps>();
  const route = useRoute<RouteProps>();
  const { encodedTx, backRouteName } = route.params;
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
  const { control, handleSubmit, setValue, watch } = useForm<FeeValues>({
    reValidateMode: 'onBlur',
  });
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
    if (backRouteName) {
      navigation.navigate({
        merge: true,
        name: backRouteName,
        params: {
          feeInfoSelected,
        },
      });
    }
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
        selectIndex={radioValue}
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
};

export default TransactionEditFee;
