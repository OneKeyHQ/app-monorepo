import { useMemo } from 'react';

import { useRoute } from '@react-navigation/core';
import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  Form,
  Input,
  Page,
  TextArea,
  YStack,
  useForm,
} from '@onekeyhq/components';
import type {
  EModalReceiveRoutes,
  IModalReceiveParamList,
} from '@onekeyhq/shared/src/routes';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { usePromiseResult } from '../../../hooks/usePromiseResult';

import type { RouteProp } from '@react-navigation/core';

type IFormValues = {
  amount: string;
  description: string;
};

function CreateInvoice() {
  const intl = useIntl();
  const form = useForm<IFormValues>();
  const route =
    useRoute<
      RouteProp<
        IModalReceiveParamList,
        EModalReceiveRoutes.LightningCreateInvoice
      >
    >();
  const { isTestnet } = route.params;

  const { result: invoiceConfig } = usePromiseResult(
    () => backgroundApiProxy.serviceLightning.getInvoiceConfig({ isTestnet }),
    [isTestnet],
  );

  return (
    <Page>
      <Page.Header title="Lightning Invoice" />
      <Page.Body>
        <YStack p="$5">
          <Form form={form}>
            <Form.Field
              label="Amount"
              name="amount"
              description="$0.00"
              rules={{
                min: {
                  value: 0,
                  message: intl.formatMessage(
                    {
                      id: 'form__field_too_small',
                    },
                    {
                      0: 0,
                    },
                  ),
                },
                pattern: {
                  value: /^[0-9]*$/,
                  message: intl.formatMessage({
                    id: 'form__field_only_integer',
                  }),
                },
                validate: (value) => {
                  // allow unspecified amount
                  if (!value) return;

                  const valueBN = new BigNumber(value);
                  if (!valueBN.isInteger()) {
                    return intl.formatMessage({
                      id: 'form__field_only_integer',
                    });
                  }
                  if (
                    invoiceConfig?.maxReceiveAmount &&
                    valueBN.isGreaterThan(invoiceConfig?.maxReceiveAmount)
                  ) {
                    return intl.formatMessage(
                      {
                        id: 'msg_receipt_amount_should_be_less_than_int_sats',
                      },
                      {
                        0: invoiceConfig?.maxReceiveAmount,
                      },
                    );
                  }
                },
              }}
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
            <Form.Field label="Description" name="description">
              <TextArea size="large" placeholder="OneKey invoice" />
            </Form.Field>
          </Form>
        </YStack>
      </Page.Body>
      <Page.Footer
        onConfirmText="Connect"
        onCancelText="Cancel"
        onConfirm={() => console.log('onConfirm')}
        onCancel={() => console.log('onCancel')}
      />
    </Page>
  );
}

export default CreateInvoice;
