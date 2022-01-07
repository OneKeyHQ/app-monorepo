import React, { useState } from 'react';

import { Column, Row } from 'native-base';
import { useIntl } from 'react-intl';

import {
  Box,
  Button,
  Divider,
  Form,
  Modal,
  RadioFee,
  SegmentedControl,
  useForm,
  useSafeAreaInsets,
  useUserDevice,
} from '@onekeyhq/components';

type FeeValues = {
  maxPriorityFee: string;
  maxFee: string;
  gasLimit: string;
  baseFee: string;
};

const TransactionEditFee = ({ ...rest }) => {
  const { trigger } = rest;
  const intl = useIntl();
  const [segmentValue, setSegmentValue] = useState('1');
  const [radioValue, setValue] = useState('1');

  const SelectFee = () => (
    <RadioFee
      padding="0px"
      mt={5}
      items={[
        {
          value: '1',
          title: 'Fast',
          titleSecond: '30 sec',
          describe: '64.61 GWEI',
          describeSecond: 'Max Fee: 127 GWEI',
        },
        {
          value: '2',
          title: 'Normal',
          titleSecond: '5 min',
          describe: '64.61 GWEI',
          describeSecond: 'Max Fee: 127 GWEI',
        },
        {
          value: '3',
          title: 'Slow',
          titleSecond: '10 min',
          describe: '64.61 GWEI',
          describeSecond: 'Max Fee: 127 GWEI',
        },
      ]}
      defaultValue="1"
      name="group1"
      value={radioValue}
      onChange={(value) => {
        setValue(value);
      }}
    />
  );
  const isSmallScreen = ['SMALL', 'NORMAL'].includes(useUserDevice().size);
  const { control, handleSubmit } = useForm<FeeValues>();
  const onSubmit = handleSubmit((data) => {
    console.log(data);
  });
  const CustomFee = () => (
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

  const saveButton = () => (
    <Button
      flexGrow={isSmallScreen ? 1 : 0}
      type="primary"
      size={isSmallScreen ? 'lg' : 'base'}
      isDisabled={false}
      onPress={onSubmit}
    >
      {intl.formatMessage({ id: 'action__save' })}
    </Button>
  );
  const { bottom } = useSafeAreaInsets();

  return (
    <Modal
      trigger={trigger}
      primaryActionTranslationId="Confirm"
      secondaryActionTranslationId="Reject"
      header={intl.formatMessage({ id: 'action__edit_fee' })}
      footer={
        <Column>
          <Divider />
          <Row
            justifyContent="flex-end"
            alignItems="center"
            px={{ base: 4, md: 6 }}
            pt={4}
            pb={4 + bottom}
          >
            {saveButton()}
          </Row>
        </Column>
      }
      scrollViewProps={{
        children: (
          <>
            <SegmentedControl
              options={[
                {
                  label: intl.formatMessage({ id: 'content__standard' }),
                  value: '1',
                },
                {
                  label: intl.formatMessage({ id: 'content__advanced' }),
                  value: '2',
                },
              ]}
              defaultValue="1"
              onChange={(value) => {
                setSegmentValue(value);
              }}
            />
            {/* <Box height={isSmallScreen ? '100%' : '500px'}>
            {segmentValue === '1' ? SelectFee() : CustomFee()}
          </Box> */}
            <Box>{segmentValue === '1' ? SelectFee() : CustomFee()}</Box>
          </>
        ),
      }}
    />
  );
};

export default TransactionEditFee;
