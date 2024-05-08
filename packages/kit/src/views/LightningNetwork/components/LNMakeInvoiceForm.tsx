import { useMemo } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import { Form, Input, TextArea } from '@onekeyhq/components';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { usePromiseResult } from '../../../hooks/usePromiseResult';

import type { UseFormReturn } from 'react-hook-form';
import type { MessageDescriptor } from 'react-intl';

export type IMakeInvoiceFormValues = {
  amount: string;
  description: string;
  requestFrom: string;
};

export type IMakeInvoiceFormProps = {
  accountId: string;
  networkId: string;
  useFormReturn: UseFormReturn<IMakeInvoiceFormValues, any>;
  amount?: number;
  minimumAmount?: number;
  maximumAmount?: number;
  origin: string;
  descriptionLabelId?: MessageDescriptor['id'];
  memo?: string;
  isWebln?: boolean;
  amountReadOnly?: boolean;
};

function LNMakeInvoiceForm(props: IMakeInvoiceFormProps) {
  const {
    networkId,
    useFormReturn,
    amount,
    minimumAmount,
    maximumAmount,
    descriptionLabelId,
    memo,
    isWebln,
    amountReadOnly,
  } = props;
  const intl = useIntl();
  const content = useMemo(() => 'Hello World', []);

  const { result: invoiceConfig } = usePromiseResult(
    () =>
      backgroundApiProxy.serviceLightning.getInvoiceConfig({
        networkId,
      }),
    [networkId],
  );

  const minAmount = new BigNumber(minimumAmount ?? 0).toNumber();
  const maxAmount = new BigNumber(maximumAmount ?? 0).toNumber();

  const amountRules = useMemo(() => {
    let max;
    if (
      maxAmount &&
      maxAmount > 0 &&
      maxAmount > minAmount &&
      maxAmount < Number(invoiceConfig?.maxReceiveAmount)
    ) {
      max = maxAmount;
    }
    return {
      min: {
        value: minAmount,
        message: intl.formatMessage(
          {
            id: 'form__field_too_small',
          },
          {
            0: minAmount,
          },
        ),
      },
      max: max
        ? {
            value: max,
            message: intl.formatMessage(
              {
                id: 'form__field_too_large',
              },
              {
                0: max,
              },
            ),
          }
        : undefined,
      pattern: {
        value: /^[0-9]*$/,
        message: intl.formatMessage({
          id: 'form__field_only_integer',
        }),
      },
      validate: (value: number) => {
        // allow unspecified amount
        if (minAmount <= 0 && !value) return;
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
    };
  }, [minAmount, maxAmount, invoiceConfig, intl]);

  const amountLabelAddon = useMemo(() => {
    if (Number(amount) > 0 || (minAmount > 0 && minAmount === maxAmount)) {
      return;
    }
    if (minAmount > 0 && maxAmount > 0) {
      return intl.formatMessage(
        { id: 'form__between_int_and_int_sats' },
        {
          min: minAmount,
          max:
            maxAmount < minAmount
              ? invoiceConfig?.maxReceiveAmount
              : Math.min(maxAmount, Number(invoiceConfig?.maxReceiveAmount)),
        },
      );
    }
  }, [amount, minAmount, maxAmount, invoiceConfig, intl]);

  return (
    <Form form={useFormReturn}>
      <Form.Field
        label={intl.formatMessage({
          id: 'content__amount',
        })}
        name="amount"
        rules={amountRules}
        labelAddon={amountLabelAddon}
        // TODO: price
        // description="$40"
      >
        <Input
          readOnly={amountReadOnly}
          placeholder={intl.formatMessage({ id: 'form__enter_amount' })}
          flex={1}
          addOns={[
            {
              label: intl.formatMessage({ id: 'form__sats__units' }),
            },
          ]}
        />
      </Form.Field>
      <Form.Field
        label={intl.formatMessage({
          id: descriptionLabelId ?? 'form__description',
        })}
        name="description"
        rules={{
          maxLength: {
            value: 40,
            message: intl.formatMessage(
              { id: 'msg_description_can_be_up_to_int_characters' },
              { 0: '40' },
            ),
          },
        }}
        defaultValue=""
      >
        <TextArea editable={!memo} />
      </Form.Field>
    </Form>
  );
}

export default LNMakeInvoiceForm;
