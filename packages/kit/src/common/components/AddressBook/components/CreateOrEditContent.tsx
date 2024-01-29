import { type FC, useCallback } from 'react';

import { useIntl } from 'react-intl';

import {
  Button,
  Form,
  Icon,
  IconButton,
  Input,
  Page,
  Select,
  SizableText,
  Stack,
  XStack,
  useForm,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  AddressInput,
  type IAddressInputValue,
} from '@onekeyhq/kit/src/common/components/AddressInput';
import { getPresetNetworks } from '@onekeyhq/shared/src/config/presetNetworks';

import type { IAddressItem } from '../type';

type ICreateOrEditContentProps = {
  title?: string;
  item: IAddressItem;
  onSubmit: (item: IAddressItem) => void;
  onRemove?: (item: IAddressItem) => void;
};

const mockItemsNetworks = getPresetNetworks().map((item) => ({
  value: item.id,
  label: item.name,
}));

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
  });

  const headerRight = useCallback(
    () =>
      onRemove ? (
        <IconButton
          icon="DeleteOutline"
          onPress={() => onRemove(item)}
          testID="address-form-remove"
        />
      ) : null,
    [onRemove, item],
  );

  const networkId = form.watch('networkId');

  const onSave = useCallback(
    (values: IFormValues) =>
      onSubmit?.({
        id: values.id,
        name: values.name,
        networkId: values.networkId,
        address: values.address.resolved ?? '',
      }),
    [onSubmit],
  );

  return (
    <Page>
      <Page.Header title={title} headerRight={headerRight} />
      <Page.Body p="$4">
        <Form form={form}>
          <Form.Field
            label="Network"
            name="networkId"
            rules={{ required: true }}
          >
            <Select
              items={mockItemsNetworks}
              title="Networks"
              testID="address-form-network"
            />
          </Form.Field>
          <Form.Field
            label="Name"
            name="name"
            rules={{
              required: true,
              validate: async (text) => {
                const searched =
                  await backgroundApiProxy.serviceAddressBook.findItem({
                    name: text,
                  });
                if (!searched || item.id === searched.id) {
                  return undefined;
                }
                return 'The name already exists.';
              },
            }}
          >
            <Input placeholder="Required" testID="address-form-name" />
          </Form.Field>
          <Form.Field
            label="Address"
            name="address"
            rules={{
              validate: async (output: IAddressInputValue) => {
                if (!output.resolved) {
                  return 'Invalid address';
                }
                const searched =
                  await backgroundApiProxy.serviceAddressBook.findItem({
                    address: output.resolved,
                  });
                if (!searched || item.id === searched.id) {
                  return undefined;
                }
                return 'The address already exists.';
              },
            }}
            description={
              networkId.startsWith('evm--') ? (
                <XStack alignItems="center" mt="$1">
                  <Icon size="$4" name="CheckRadioSolid" />
                  <SizableText size="$bodyMd" ml="$1">
                    Also add to additional EVM-compatible Chains
                  </SizableText>
                </XStack>
              ) : null
            }
          >
            <AddressInput
              networkId={networkId}
              placeholder="Address"
              testID="address-form-address"
              enableNameResolve
            />
          </Form.Field>
        </Form>
      </Page.Body>
      <Page.Footer>
        <Stack p="$5">
          <Button
            variant="primary"
            loading={form.formState.isSubmitting}
            disabled={!form.formState.isValid}
            onPress={form.handleSubmit(onSave)}
            testID="address-form-save"
          >
            {intl.formatMessage({ id: 'action__save' })}
          </Button>
        </Stack>
      </Page.Footer>
    </Page>
  );
};
