import React, { useMemo, useState } from 'react';

import { Column, Row } from 'native-base';
import { Control } from 'react-hook-form';
import { useIntl } from 'react-intl';

import {
  Box,
  Button,
  Form,
  Modal,
  RadioFee,
  SegmentedControl,
  useForm,
  useIsVerticalLayout,
  useSafeAreaInsets,
} from '@onekeyhq/components';
import { EIP1559Fee } from '@onekeyhq/engine/src/types/network';
import { useGas } from '@onekeyhq/kit/src/hooks';

type FeeValues = {
  maxPriorityFee: string;
  maxFee: string;
  gasLimit: string;
  baseFee: string;
};

enum FeeType {
  standard = 'standard',
  advanced = 'advanced',
}

const CustomFeeForm = ({ control }: { control: Control<FeeValues> }) => {
  const intl = useIntl();

  return (
    <Form mt={8}>
      <Form.Item
        label={`${intl.formatMessage({
          id: 'content__max_priority_fee',
        })}(Gwei)`}
        control={control}
        name="maxPriorityFee"
        defaultValue=""
        rules={{
          required: intl.formatMessage({
            id: 'form__max_priority_fee_invalid_min',
          }),
        }}
      >
        <Form.Input w="100%" rightText="0.12USD" />
      </Form.Item>
      <Form.Item
        label={`${intl.formatMessage({ id: 'content__max_fee' })}(Gwei)`}
        control={control}
        name="maxFee"
        defaultValue=""
        rules={{
          required: intl.formatMessage({
            id: 'form__max_fee_invalid_too_low',
          }),
        }}
      >
        <Form.Input w="100%" rightText="0.12USD" />
      </Form.Item>
      <Form.Item
        label={intl.formatMessage({ id: 'content__gas_limit' })}
        control={control}
        name="gasLimit"
        defaultValue=""
      >
        <Form.Input w="100%" />
      </Form.Item>
      <Form.Item
        label={`${intl.formatMessage({ id: 'content__base_fee' })}(Gwei)`}
        control={control}
        name="baseFee"
        defaultValue="62"
        rules={{
          required: intl.formatMessage({
            id: 'form__gas_limit_invalid_min',
          }),
        }}
      >
        <Form.Input w="100%" rightText="0.12USD" />
      </Form.Item>
    </Form>
  );
};

const StandardFee = ({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) => {
  const { data: gasList } = useGas();
  const intl = useIntl();

  const gasItems = useMemo(() => {
    if (!gasList) return [];
    const isEIP1559Fee = gasList?.every((gas) => typeof gas === 'object');
    if (isEIP1559Fee) {
      const [slow, normal, fast] = gasList as EIP1559Fee[];
      return [
        {
          value: '0',
          title: intl.formatMessage({ id: 'content__fast' }),
          titleSecond: '-',
          describe: `${slow.maxFeePerGas} GWEI`,
          describeSecond: 'Max Fee: 127 GWEI',
        },
        {
          value: '1',
          title: intl.formatMessage({ id: 'content__normal' }),
          titleSecond: '-',
          describe: `${normal.maxFeePerGas} GWEI`,
          describeSecond: 'Max Fee: 127 GWEI',
        },
        {
          value: '2',
          title: intl.formatMessage({ id: 'content__slow' }),
          titleSecond: '-',
          describe: `${fast.maxFeePerGas} GWEI`,
          describeSecond: 'Max Fee: 127 GWEI',
        },
      ];
    }
    if (gasList.length === 1) {
      const normal = gasList[0] as string;
      return [
        {
          value: '1',
          title: intl.formatMessage({ id: 'content__normal' }),
          titleSecond: '-',
          describe: `${normal}`,
          describeSecond: '-',
        },
      ];
    }

    if (gasList.length === 1) {
      return gasList.map((gas, index) => ({
        value: index.toString(),
        title: intl.formatMessage({ id: 'content__normal' }),
        titleSecond: '-',
        describe: gas as string,
        describeSecond: '-',
      }));
    }
    return [];
  }, [gasList, intl]);

  return (
    <RadioFee
      padding="0px"
      mt={5}
      items={gasItems}
      defaultValue="1"
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

  const [feeType, setFeeType] = useState<FeeType>(FeeType.standard);
  const [radioValue, setValue] = useState('1');

  const isSmallScreen = useIsVerticalLayout();
  const { control, handleSubmit } = useForm<FeeValues>();
  const onSubmit = handleSubmit((data) => {
    console.log(data);
  });

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
          size={isSmallScreen ? 'lg' : 'base'}
          isDisabled={false}
          onPress={onSubmit}
        >
          {intl.formatMessage({ id: 'action__save' })}
        </Button>
      </Row>
    </Column>
  );

  const content = (
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
            value={radioValue}
            onChange={(value) => {
              setValue(value);
            }}
          />
        ) : (
          <CustomFeeForm control={control} />
        )}
      </Box>
    </>
  );

  return (
    <Modal
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
