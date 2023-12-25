import { useCallback } from 'react';

import {
  Form,
  Heading,
  Input,
  Page,
  Popover,
  SizableText,
  Stack,
  TextArea,
  useForm,
} from '@onekeyhq/components';
import { HeaderIconButton } from '@onekeyhq/components/src/layouts/Navigation/Header';

import useAppNavigation from '../../../hooks/useAppNavigation';
import { EReceivePages } from '../router/type';

export function LightingInvoice() {
  const form = useForm();
  const navigation = useAppNavigation();
  const currency = '$';

  const handleCreateInvoicePress = useCallback(() => {
    navigation.push(EReceivePages.QrCode);
  }, [navigation]);

  const headerRight = () => (
    <Popover
      title="Lightning Invoice"
      renderTrigger={
        <Stack>
          <HeaderIconButton icon="QuestionmarkOutline" />
        </Stack>
      }
      renderContent={
        <Stack py="$4" px="$5">
          <Heading size="$headingMd">Why Specify an Amount?</Heading>
          <SizableText mt="$1">
            Entering an amount ensures your invoice works correctly with most
            wallets and exchanges, preventing transaction errors.
          </SizableText>
        </Stack>
      }
    />
  );

  return (
    <Page>
      <Page.Header title="Lighting Invoice" headerRight={headerRight} />
      <Page.Body px="$5">
        <Form form={form}>
          <Form.Field
            label="Amount"
            name="amount"
            description={`${currency}0.00`}
          >
            <Input
              placeholder="Enter amount"
              size="large"
              keyboardType="number-pad"
              addOns={[
                {
                  label: 'sats',
                },
              ]}
            />
          </Form.Field>
          <Form.Field
            label="Description"
            description="Enter a brief description for the payment. This helps the recipient identify and record the transaction."
            name="description"
            optional
          >
            <TextArea
              size="large"
              placeholder="e.g., Coffee purchase, Invoice #12345"
            />
          </Form.Field>
        </Form>
      </Page.Body>
      <Page.Footer
        onConfirm={handleCreateInvoicePress}
        onConfirmText="Create Invoice"
      />
    </Page>
  );
}
