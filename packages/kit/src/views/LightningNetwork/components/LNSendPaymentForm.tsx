import { useMemo } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import { Form, Input, TextArea } from '@onekeyhq/components';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { usePromiseResult } from '../../../hooks/usePromiseResult';

import type { UseFormReturn } from 'react-hook-form';
import type { MessageDescriptor } from 'react-intl';

export type ISendPaymentFormValues = {
  amount: string;
  description: string;
  requestFrom: string;
  comment: string;
};

export type ISendPaymentFormProps = {
  accountId: string;
  networkId: string;
  useFormReturn: UseFormReturn<ISendPaymentFormValues, any>;
  amount?: number;
  minimumAmount?: number;
  maximumAmount?: number;
  descriptionLabelId?: MessageDescriptor['id'];
  memo?: string;
  commentAllowedLength?: number;
  metadata?: string;
  // nativeToken?: Token;
  isWebln?: boolean;
  amountReadOnly?: boolean;
};

function LNSendPaymentForm(props: ISendPaymentFormProps) {
  const {
    // accountId,
    networkId,
    useFormReturn,
    // amount,
    minimumAmount,
    maximumAmount,
    // descriptionLabelId,
    // memo,
    commentAllowedLength,
    metadata: originMetadata,
    // nativeToken,
    amountReadOnly,
  } = props;

  const intl = useIntl();
  // const { watch } = useFormReturn;
  // const amountValue = watch('amount');

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
      maxAmount < Number(invoiceConfig?.maxSendAmount)
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
          invoiceConfig?.maxSendAmount &&
          valueBN.isGreaterThan(invoiceConfig?.maxSendAmount)
        ) {
          return intl.formatMessage(
            {
              id: 'msg__the_sending_amount_cannot_exceed_int_sats',
            },
            {
              0: invoiceConfig?.maxSendAmount,
            },
          );
        }
      },
    };
  }, [minAmount, maxAmount, intl, invoiceConfig?.maxSendAmount]);

  // TODO: price
  // const token = usePromiseResult(async () => {
  //   const accountAddress =
  //     await backgroundApiProxy.serviceAccount.getAccountAddressForApi({
  //       accountId,
  //       networkId,
  //     });
  //   const _token = await backgroundApiProxy.serviceToken.fetchTokensDetails({
  //     contractList: [],
  //     networkId,
  //     accountAddress,
  //   });
  //   console.log('====>token: ', _token);
  // }, [accountId, networkId]);

  const renderMetadataText = useMemo(() => {
    if (!originMetadata || !originMetadata.length) return null;
    try {
      const metadata = JSON.parse(originMetadata);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      return metadata
        .map(([type, content]: [string, string], index: number) => {
          if (type === 'text/plain' || type === 'text/long-desc') {
            const name = `metadataDescription-${index}`;
            // @ts-expect-error
            useFormReturn.setValue(name, content);
            return (
              <Form.Field
                label={intl.formatMessage({ id: 'form__payment_description' })}
                name={name}
                key={content}
              >
                {/* <TextArea editable={false} disabled /> */}
                <Input readonly />
              </Form.Field>
            );
          }
          return undefined;
        })
        .filter(Boolean);
    } catch (e) {
      console.error(e);
    }
    return [];
  }, [intl, originMetadata, useFormReturn]);

  return (
    <Form form={useFormReturn}>
      {renderMetadataText}
      <Form.Field
        label={intl.formatMessage({
          id: 'content__amount',
        })}
        name="amount"
        rules={amountRules}
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
      {Number(commentAllowedLength) > 0 ? (
        <Form.Field
          label={intl.formatMessage({ id: 'form__description__optional' })}
          name="comment"
          rules={{
            maxLength: {
              value: Number(commentAllowedLength),
              message: intl.formatMessage(
                { id: 'msg_description_can_be_up_to_int_characters' },
                { 0: commentAllowedLength },
              ),
            },
          }}
          defaultValue=""
        >
          <TextArea />
        </Form.Field>
      ) : null}
    </Form>
  );
}

export default LNSendPaymentForm;
