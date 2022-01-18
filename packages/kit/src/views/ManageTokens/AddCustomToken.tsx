import React, { FC, useEffect } from 'react';

import { useIntl } from 'react-intl';

import {
  Form,
  Icon,
  KeyboardDismissView,
  Modal,
  Pressable,
  useForm,
} from '@onekeyhq/components';

import { getClipboard } from '../../utils/ClipboardUtils';

import { ManageTokenModalRoutes, ManageTokenRoutesParams } from './types';

import type { NativeStackScreenProps } from '@react-navigation/native-stack';

type NavigationProps = NativeStackScreenProps<
  ManageTokenRoutesParams,
  ManageTokenModalRoutes.AddCustomTokenModal
>;

type AddCustomTokenValues = {
  address: string;
  symbol: string;
  decimal: string;
};

export const AddCustomToken: FC<NavigationProps> = ({ route }) => {
  const intl = useIntl();
  const address = route.params?.address;
  const { control, handleSubmit, setValue } = useForm<AddCustomTokenValues>({
    defaultValues: { address: '', symbol: '', decimal: '' },
  });
  const onSubmit = handleSubmit((data) => console.log(data));
  useEffect(() => {
    if (address) {
      setValue('address', address);
    }
  }, [address, setValue]);

  return (
    <Modal
      header={intl.formatMessage({
        id: 'action__add_custom_tokens',
        defaultMessage: 'Add Custom Token',
      })}
      hidePrimaryAction
      secondaryActionTranslationId="action__add"
      onSecondaryActionPress={() => {
        onSubmit();
      }}
      secondaryActionProps={{ type: 'primary' }}
    >
      <KeyboardDismissView>
        <Form>
          <Form.Item
            name="address"
            label={intl.formatMessage({
              id: 'transaction__contract_address',
              defaultMessage: 'Contract Address',
            })}
            control={control}
            labelAddon={
              <Pressable
                onPress={() => {
                  getClipboard().then((text) => setValue('address', text));
                }}
              >
                <Icon size={16} name="ClipboardSolid" />
              </Pressable>
            }
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
              id: 'form__decimal',
              defaultMessage: 'Decimal',
            })}
            control={control}
          >
            <Form.Input />
          </Form.Item>
        </Form>
      </KeyboardDismissView>
    </Modal>
  );
};

export default AddCustomToken;
