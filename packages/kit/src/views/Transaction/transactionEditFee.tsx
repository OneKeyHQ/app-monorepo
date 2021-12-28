import React, { useState } from 'react';

import { Column, Row, Toast } from 'native-base';
import { useIntl } from 'react-intl';

import {
  Box,
  Button,
  Divider,
  Form,
  Modal,
  SegmentedControl,
  Typography,
  useForm,
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
  const SelectFee = () => (
    <Box>
      <Typography.Body1>1111</Typography.Body1>
    </Box>
  );
  const isSmallScreen = ['SMALL', 'NORMAL'].includes(useUserDevice().size);
  const { control, handleSubmit } = useForm<FeeValues>();
  const onSubmit = handleSubmit((data) => {
    Toast.show({ title: 'data' });

    console.log(data);
  });
  const CustomFee = () => (
    <Form>
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
      <Box h="24px" />
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
      <Box h="24px" />
      <Form.Item
        label={intl.formatMessage({ id: 'content__gas_limit' })}
        control={control}
        name="gasLimit"
        defaultValue=""
      >
        <Form.Input w="100%" />
      </Form.Item>
      <Box h="24px" />
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

  const saveButton = () =>
    isSmallScreen ? (
      <Button
        flex={1}
        type="primary"
        size="lg"
        isDisabled={false}
        onPress={onSubmit}
      >
        <Typography.Body1Strong>
          {intl.formatMessage({ id: 'action__save' })}
        </Typography.Body1Strong>
      </Button>
    ) : (
      <Button type="primary" size="lg" isDisabled={false} onPress={onSubmit}>
        <Typography.Body1Strong>
          {intl.formatMessage({ id: 'action__save' })}
        </Typography.Body1Strong>
      </Button>
    );

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
            paddingX="24px"
            paddingY="16px"
          >
            {saveButton()}
          </Row>
        </Column>
      }
    >
      <Column flex="1">
        <SegmentedControl
          containerProps={{
            width: '100%',
          }}
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
        <Box height={isSmallScreen ? '100%' : '500px'} pt="32px">
          {segmentValue === '1' ? SelectFee() : CustomFee()}
        </Box>
      </Column>
    </Modal>
  );
};

export default TransactionEditFee;
