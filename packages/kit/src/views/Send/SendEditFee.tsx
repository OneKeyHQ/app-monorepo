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
  RadioFee,
  SegmentedControl,
  Spinner,
  Typography,
  useForm,
  useIsVerticalLayout,
  useSafeAreaInsets,
} from '@onekeyhq/components';
import { EIP1559Fee } from '@onekeyhq/engine/src/types/network';
import {
  IFeeInfo,
  IFeeInfoPayload,
  IFeeInfoSelectedType,
  IFeeInfoUnit,
} from '@onekeyhq/engine/src/types/vault';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import { FormatCurrencyNative } from '../../components/Format';

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
  let title = intl.formatMessage({ id: 'content__normal' });
  if (indexInt === 0) {
    title = intl.formatMessage({ id: 'content__slow' });
  }
  if (indexInt === 1) {
    title = intl.formatMessage({ id: 'content__normal' });
  }
  if (indexInt === 2) {
    title = intl.formatMessage({ id: 'content__fast' });
  }
  return <>{title}</>;
}

const CustomFeeForm = ({
  feeInfoPayload,
  control,
  watch,
}: {
  feeInfoPayload: IFeeInfoPayload | null;
  control: Control<FeeValues>;
  watch: UseFormWatch<FeeValues>;
}) => {
  const intl = useIntl();
  const feeSymbol = feeInfoPayload?.info?.symbol || '';
  const isEIP1559Fee = feeInfoPayload?.info?.eip1559;
  const formValues = watch();

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
          <Form.Input w="100%" rightText="-" />
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
          }}
        >
          <Form.Input w="100%" rightText="-" />
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
          }}
        >
          <Form.Input w="100%" rightText="-" />
        </Form.Item>
      )}

      {!isEIP1559Fee && (
        <Form.Item
          label={intl.formatMessage({ id: 'content__gas_price' })}
          control={control}
          name="gasPrice"
          // TODO required rules
          defaultValue=""
        >
          <Form.Input w="100%" />
        </Form.Item>
      )}

      <Form.Item
        label={intl.formatMessage({ id: 'content__gas_limit' })}
        control={control}
        name="gasLimit"
        // TODO required rules
        defaultValue=""
      >
        <Form.Input w="100%" />
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
  const gasList = feeInfoPayload?.info?.prices ?? [];
  const gasItems = useMemo(() => {
    if (!gasList) return [];
    const isEIP1559Fee = feeInfoPayload?.info?.eip1559;
    if (isEIP1559Fee) {
      return gasList.map((gas, index) => {
        const gasInfo = gas as EIP1559Fee;
        return {
          value: index.toString(),
          title: <FeeSpeedLabel index={index} />,
          titleSecond: `Base: ${gasInfo.baseFee}`,
          describe: `${gasInfo.maxFeePerGas} ${feeSymbol}`,
          describeSecond: `Max Priority: ${gasInfo.maxPriorityFeePerGas} ${feeSymbol}`,
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
  const { feeInfoPayload, getSelectedFeeInfoUnit } = useFeeInfoPayload({
    encodedTx,
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
    let priceInfo: string | EIP1559Fee = data.gasPrice;
    if (isEIP1559Fee) {
      priceInfo = {
        baseFee: data.baseFee,
        maxPriorityFeePerGas: data.maxPriorityFeePerGas,
        maxFeePerGas: data.maxFeePerGas,
      };
    }
    const feeInfoSelected = {
      type,
      preset: radioValue || '1',
      custom: {
        eip1559: isEIP1559Fee,
        price: priceInfo,
        limit: data.gasLimit,
      },
    };
    debugLogger.sendTx('SendEditFee Confirm >>>> ', feeInfoSelected);
    navigation.navigate({
      merge: true,
      name: backRouteName as typeof SendRoutes.SendConfirm,
      params: {
        feeInfoSelected,
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
    if (!feeInfoPayload) {
      return;
    }
    const selected = feeInfoPayload?.selected;
    const type = selected?.type ?? 'preset';
    if (type === 'preset') {
      let presetValue = selected?.preset || '1';
      // preset fix / presetFix
      if (feeInfoPayload?.info?.prices?.length < 2) {
        presetValue = '0';
      }
      setRadioValue(presetValue);
      setFeeType(FeeType.standard);
    }
    if (type === 'custom') {
      const customValues = selected?.custom;
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
    <Center h="full" w="full">
      <Spinner size="lg" />
    </Center>
  );
  if (feeInfoPayload && feeType) {
    content = (
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
            <CustomFeeForm
              feeInfoPayload={feeInfoPayload}
              control={control}
              watch={watch}
            />
          )}
        </Box>
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
