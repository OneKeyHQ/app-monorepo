import { type FC, useCallback } from 'react';

import { useIntl } from 'react-intl';

import {
  Button,
  Form,
  IconButton,
  Input,
  Page,
  Select,
  Stack,
  useForm,
} from '@onekeyhq/components';
import {
  AddressInput,
  type IAddressInputValue,
} from '@onekeyhq/kit/src/common/components/AddressInput';
import { mockPresetNetworksList } from '@onekeyhq/kit-bg/src/mock';

import type { IAddressItem } from '../type';

type ICreateOrEditContentProps = {
  title?: string;
  item: IAddressItem;
  onSubmit: (item: IAddressItem) => void;
  onRemove?: (item: IAddressItem) => void;
};

const mockItemsNetworks = mockPresetNetworksList.map((item) => ({
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
        <IconButton icon="DeleteOutline" onPress={() => onRemove(item)} />
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
            <Select items={mockItemsNetworks} title="网络" />
          </Form.Field>
          <Form.Field label="Name" name="name" rules={{ required: true }}>
            <Input placeholder="Required" />
          </Form.Field>
          <Form.Field label="Address" name="address" rules={{ required: true }}>
            <AddressInput
              networkId={networkId}
              placeholder="Address"
              enableNameResolve={false}
            />
          </Form.Field>
        </Form>
      </Page.Body>
      <Page.Footer>
        <Stack p="$5">
          <Button
            disabled={!form.formState.isValid}
            onPress={form.handleSubmit(onSave)}
          >
            {intl.formatMessage({ id: 'action__save' })}
          </Button>
        </Stack>
      </Page.Footer>
    </Page>
  );
};
