import React, { FC } from 'react';

import { useIntl } from 'react-intl';

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
  const intl = useIntl();
  return (
    <Modal
      visible={visible}
      header={intl.formatMessage({
        id: 'action__add_custom_tokens',
        defaultMessage: 'Add Custom Token',
      })}
      hideSecondaryAction
      primaryActionTranslationId="action__add"
      onClose={onClose}
      onPrimaryActionPress={() => {
        onPress();
      }}
    >
      <Form>
        <Form.Item
          name="address"
          label={intl.formatMessage({
            id: 'transaction__contract_address',
            defaultMessage: 'Contract Address',
          })}
          control={control}
        >
          <Form.Textarea
            placeholder={intl.formatMessage({
              id: 'form__enter_or_paste_contract_address',
              defaultMessage: 'Enter or paste contract address',
            })}
          />
        </Form.Item>
        <Form.Item
          name="symbol"
          label={intl.formatMessage({
            id: 'form__token_symbol',
            defaultMessage: 'Token Symbol',
          })}
          control={control}
        >
          <Form.Input />
        </Form.Item>
        <Form.Item
          name="decimal"
          label={intl.formatMessage({
            id: 'form_decimal',
            defaultMessage: 'Decimal',
          })}
          control={control}
        >
          <Form.Input />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default AddCustomToken;
