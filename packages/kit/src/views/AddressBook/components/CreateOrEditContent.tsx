import { type FC, useCallback } from 'react';

import { useIntl } from 'react-intl';

import {
  Form,
  Icon,
  IconButton,
  Input,
  Page,
  SizableText,
  XStack,
  useForm,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  AddressInput,
  type IAddressInputValue,
} from '@onekeyhq/kit/src/components/AddressInput';
import { ChainSelectorInput } from '@onekeyhq/kit/src/components/ChainSelectorInput';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import type { IAddressItem } from '../type';

type ICreateOrEditContentProps = {
  title?: string;
  item: IAddressItem;
  onSubmit: (item: IAddressItem) => Promise<void>;
  onRemove?: (item: IAddressItem) => void;
};

type IFormValues = Omit<IAddressItem, 'address'> & {
  address: IAddressInputValue;
};

export const CreateOrEditContent: FC<ICreateOrEditContentProps> = ({
  title,
  item,
  onSubmit,
  onRemove,
}) => {
  const intl = useIntl();
  const form = useForm<IFormValues>({
    defaultValues: {
      id: item.id,
      networkId: item.networkId,
      name: item.name,
      address: { raw: item.address, resolved: '' } as IAddressInputValue,
    },
    mode: 'onChange',
    reValidateMode: 'onChange',
  });

  const headerRight = useCallback(
    () =>
      onRemove ? (
        <IconButton
          icon="DeleteOutline"
          variant="tertiary"
          onPress={() => onRemove(item)}
          testID="address-form-remove"
        />
      ) : null,
    [onRemove, item],
  );

  const networkId = form.watch('networkId');
  const pending = form.watch('address.pending');

  const onSave = useCallback(
    async (values: IFormValues) => {
      await onSubmit?.({
        id: values.id,
        name: values.name,
        networkId: values.networkId,
        address: values.address.resolved ?? '',
      });
    },
    [onSubmit],
  );

  return (
    <Page>
      <Page.Header title={title} headerRight={headerRight} />
      <Page.Body p="$4">
        <Form form={form}>
          <Form.Field
            label={intl.formatMessage({
              id: ETranslations.address_book_add_address_chain,
            })}
            name="networkId"
            rules={{ required: true }}
          >
            <ChainSelectorInput />
          </Form.Field>
          <Form.Field
            label={intl.formatMessage({
              id: ETranslations.address_book_add_address_name,
            })}
            name="name"
            rules={{
              required: {
                value: true,
                message: intl.formatMessage({
                  id: ETranslations.address_book_add_address_name_empty_error,
                }),
              },
              maxLength: {
                value: 24,
                message: intl.formatMessage(
                  {
                    id: ETranslations.address_book_add_address_name_length_erro,
                  },
                  { 'num': 24 },
                ),
              },
              validate: async (text) => {
                const searched =
                  await backgroundApiProxy.serviceAddressBook.findItem({
                    name: text,
                  });
                if (!searched || item.id === searched.id) {
                  return undefined;
                }
                return intl.formatMessage({
                  id: ETranslations.address_book_add_address_name_exists,
                });
              },
            }}
            testID="address-form-name-field"
          >
            <Input
              placeholder={intl.formatMessage({
                id: ETranslations.address_book_add_address_name_required,
              })}
              testID="address-form-name"
            />
          </Form.Field>
          <Form.Field
            label={intl.formatMessage({
              id: ETranslations.address_book_add_address_address,
            })}
            name="address"
            rules={{
              validate: async (output: IAddressInputValue) => {
                if (output.pending) {
                  return;
                }
                if (!output.resolved) {
                  return (
                    output.validateError?.message ??
                    intl.formatMessage({
                      id: ETranslations.address_book_add_address_address_invalid_error,
                    })
                  );
                }
                const searched =
                  await backgroundApiProxy.serviceAddressBook.findItem({
                    address: output.resolved,
                  });
                if (!searched || item.id === searched.id) {
                  return undefined;
                }
                return intl.formatMessage({
                  id: ETranslations.address_book_add_address_address_exists,
                });
              },
            }}
            description={
              networkId.startsWith('evm--') ? (
                <XStack alignItems="center" mt="$1">
                  <Icon size="$4" name="CheckRadioSolid" />
                  <SizableText size="$bodyMd" ml="$1">
                    {intl.formatMessage({
                      id: ETranslations.address_book_add_address_add_to_evm_chains,
                    })}
                  </SizableText>
                </XStack>
              ) : null
            }
            testID="address-form-address-field"
          >
            <AddressInput
              networkId={networkId}
              placeholder={intl.formatMessage({
                id: ETranslations.address_book_add_address_address,
              })}
              autoError={false}
              testID="address-form-address"
              enableNameResolve
            />
          </Form.Field>
        </Form>
      </Page.Body>
      <Page.Footer
        onConfirmText={intl.formatMessage({
          id: ETranslations.address_book_add_address_button_save,
        })}
        confirmButtonProps={{
          variant: 'primary',
          loading: form.formState.isSubmitting,
          disabled: !form.formState.isValid || pending,
          onPress: form.handleSubmit(onSave),
          testID: 'address-form-save',
        }}
      />
    </Page>
  );
};
