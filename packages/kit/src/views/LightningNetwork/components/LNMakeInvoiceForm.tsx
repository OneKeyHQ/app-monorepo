import { useMemo } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import { Form, Input, TextArea } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

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
    amountReadOnly,
  } = props;
  const intl = useIntl();

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
            id: ETranslations.dapp_connect_amount_should_be_at_least,
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
                id: ETranslations.dapp_connect_amount_should_not_exceed,
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
          id: ETranslations.send_field_only_integer,
        }),
      },
      validate: (value: number) => {
        // allow unspecified amount
        if (minAmount <= 0 && !value) return;
        const valueBN = new BigNumber(value);
        if (!valueBN.isInteger()) {
          return intl.formatMessage({
            id: ETranslations.send_field_only_integer,
          });
        }

        if (
          invoiceConfig?.maxReceiveAmount &&
          valueBN.isGreaterThan(invoiceConfig?.maxReceiveAmount)
        ) {
          return intl.formatMessage(
            {
              id: ETranslations.dapp_connect_amount_should_not_exceed,
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
        { id: ETranslations.dapp_connect_sats_between },
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
          id: ETranslations.send_amount,
        })}
        name="amount"
        rules={amountRules}
        labelAddon={amountLabelAddon}
        // TODO: price
        // description="$40"
      >
        <Input
          editable={!amountReadOnly}
          readonly={amountReadOnly}
          placeholder={intl.formatMessage({
            id: ETranslations.dapp_connect_enter_amount,
          })}
          flex={1}
          addOns={[
            {
              label: intl.formatMessage({ id: ETranslations.global_sats }),
            },
          ]}
        />
      </Form.Field>
      <Form.Field
        label={intl.formatMessage({
          id: descriptionLabelId ?? ETranslations.global_description,
        })}
        name="description"
        rules={{
          maxLength: {
            value: 40,
            message: intl.formatMessage(
              {
                id: ETranslations.dapp_connect_msg_description_can_be_up_to_int_characters,
              },
              { number: '40' },
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
