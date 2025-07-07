import { useIntl } from 'react-intl';

import type { IPageScreenProps } from '@onekeyhq/components';
import { Form, Page, Select, useForm } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale/enum/translations';
import type {
  EModalBulkCopyAddressesRoutes,
  IModalBulkCopyAddressesParamList,
} from '@onekeyhq/shared/src/routes/bulkCopyAddresses';

function BulkCopyAddresses({
  route,
}: IPageScreenProps<
  IModalBulkCopyAddressesParamList,
  EModalBulkCopyAddressesRoutes.BulkCopyAddressesModal
>) {
  const intl = useIntl();
  const { walletId, networkId } = route.params;

  const form = useForm({
    defaultValues: {
      selectedWalletId: walletId,
      selectedNetworkId: networkId,
    },
    mode: 'onChange',
  });

  return (
    <Page>
      <Page.Header
        title={intl.formatMessage({
          id: ETranslations.global_bulk_copy_addresses,
        })}
      />
      <Page.Body px="$5">
        <Form form={form}>
          <Form.Field
            name="selectedWalletId"
            label={intl.formatMessage({
              id: ETranslations.global_wallet,
            })}
          >
            <Select
              title={intl.formatMessage({
                id: ETranslations.global_wallet,
              })}
              items={[]}
              value={form.watch('selectedWalletId')}
              onChange={(value) => form.setValue('selectedWalletId', value)}
            />
          </Form.Field>
          <Form.Field
            name="selectedNetworkId"
            label={intl.formatMessage({
              id: ETranslations.global_network,
            })}
          >
            <Select
              title={intl.formatMessage({
                id: ETranslations.global_network,
              })}
            />
          </Form.Field>
        </Form>
      </Page.Body>
    </Page>
  );
}

export default BulkCopyAddresses;
