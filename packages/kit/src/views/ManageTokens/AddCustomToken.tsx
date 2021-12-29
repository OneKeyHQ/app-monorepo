import React, { FC } from 'react';

import { Form, Modal, useForm } from '@onekeyhq/components';

type AddCustomTokenValues = {
  address: string;
  symbol: string;
  decimal: string;
};

type AddCustomTokenProps = {
  visible: boolean;
  defaultValues: AddCustomTokenValues;
  onSubmit?: (values: AddCustomTokenValues) => void;
  onClose?: () => void;
};

const AddCustomToken: FC<AddCustomTokenProps> = ({
  visible,
  defaultValues,
  onSubmit,
  onClose,
}) => {
  const { control, handleSubmit } = useForm<AddCustomTokenValues>({
    defaultValues,
  });
  const onPress = handleSubmit((data) => onSubmit?.(data));
  return (
    <Modal
      visible={visible}
      header="Add Custom Token"
      onClose={onClose}
      onPrimaryActionPress={() => {
        onPress();
      }}
    >
      <Form>
        <Form.Item name="address" label="Contract Address" control={control}>
          <Form.Input placeholder="network name" />
        </Form.Item>
        <Form.Item name="symbol" label="Token Symbol" control={control}>
          <Form.Input placeholder="network name" />
        </Form.Item>
        <Form.Item name="decimal" label="Decimal" control={control}>
          <Form.Input placeholder="network name" />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default AddCustomToken;
