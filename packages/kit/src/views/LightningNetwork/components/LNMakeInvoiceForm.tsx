import { useMemo } from 'react';

import { BigNumber } from 'bignumber.js';
import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import { Box, Form, Text, useIsVerticalLayout } from '@onekeyhq/components';
import type { Token } from '@onekeyhq/engine/src/types/token';
import { FormatCurrencyTokenOfAccount } from '@onekeyhq/kit/src/components/Format';

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
  domain: string;
  descriptionLabelId?: MessageDescriptor['id'];
  memo?: string;
  nativeToken?: Token;
};

const LNMakeInvoiceForm = (props: IMakeInvoiceFormProps) => {
  const {
    accountId,
    networkId,
    useFormReturn,
    amount,
    minimumAmount,
    maximumAmount,
    domain,
    descriptionLabelId,
    memo,
    nativeToken,
  } = props;
  const intl = useIntl();
  const isVerticalLayout = useIsVerticalLayout();

  const { control, watch } = useFormReturn;
  const amountValue = watch('amount');

  const minAmount = useMemo(() => Number(minimumAmount), [minimumAmount]);
  const maxAmount = useMemo(() => Number(maximumAmount), [maximumAmount]);
  const renderLabelAddon = useMemo(() => {
    if (Number(amount) > 0 || (minAmount > 0 && minAmount === maxAmount)) {
      return;
    }
    if (minAmount > 0 && maxAmount > 0 && minAmount > maxAmount) {
      return (
        <Text
          typography="Body2Strong"
          color="text-subdued"
        >{`>= ${minAmount}`}</Text>
      );
    }
    if (minAmount > 0 && maxAmount > 0) {
      return (
        <Text typography="Body2Strong" color="text-subdued">
          {intl.formatMessage(
            { id: 'form__between_int_and_int_sats' },
            {
              min: minAmount,
              max: maxAmount,
            },
          )}
        </Text>
      );
    }
  }, [amount, minAmount, maxAmount, intl]);

  return (
    <Form>
      <Form.Item
        label={intl.formatMessage({ id: 'form__request_from' })}
        name="requestFrom"
        control={control}
        formControlProps={{ width: 'full' }}
      >
        <Box
          display="flex"
          flexDirection="row"
          justifyContent="flex-start"
          alignItems="center"
          borderWidth={StyleSheet.hairlineWidth}
          borderColor="border-default"
          borderRadius="xl"
          py={2}
          px={3}
          bgColor="action-secondary-default"
        >
          <Text typography="Body2Mono" color="text-subdued" lineHeight="1.5em">
            {domain}
          </Text>
        </Box>
      </Form.Item>
      <Form.Item
        label={intl.formatMessage({
          id: descriptionLabelId ?? 'form__description__optional',
        })}
        control={control}
        name="description"
        formControlProps={{ width: 'full' }}
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
        {memo && memo.length ? (
          <Box
            display="flex"
            flexDirection="row"
            justifyContent="flex-start"
            alignItems="center"
            borderWidth={StyleSheet.hairlineWidth}
            borderColor="border-default"
            borderRadius="xl"
            py={2}
            px={3}
            bgColor="action-secondary-default"
          >
            <Text
              typography="Body2Mono"
              color="text-subdued"
              lineHeight="1.5em"
            >
              {memo}
            </Text>
          </Box>
        ) : (
          <Form.Textarea
            size={isVerticalLayout ? 'xl' : 'default'}
            totalLines={isVerticalLayout ? 3 : 5}
            placeholder={intl.formatMessage({
              id: 'form__a_message_to_the_payer',
            })}
          />
        )}
      </Form.Item>
      <Form.Item
        label={`${intl.formatMessage({
          id: 'content__amount',
        })}`}
        control={control}
        name="amount"
        formControlProps={{ width: 'full' }}
        rules={{
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
          max: {
            value: minAmount,
            message: intl.formatMessage(
              {
                id: 'form__field_too_large',
              },
              {
                0: minAmount,
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
            if (minAmount === 0 && !value) return;
            const valueBN = new BigNumber(value);
            if (!valueBN.isInteger()) {
              return intl.formatMessage({
                id: 'form__field_only_integer',
              });
            }
          },
        }}
        defaultValue=""
        isLabelAddonActions={false}
        labelAddon={renderLabelAddon}
      >
        <Form.Input
          type="number"
          size={isVerticalLayout ? 'xl' : 'default'}
          placeholder={intl.formatMessage({ id: 'form__enter_amount' })}
        />
      </Form.Item>
      <FormatCurrencyTokenOfAccount
        accountId={accountId}
        networkId={networkId}
        token={nativeToken}
        value={new BigNumber(amountValue)}
        render={(ele) => (
          <Text typography="Body2" color="text-subdued" mt="-18px">
            {ele}
          </Text>
        )}
      />
    </Form>
  );
};
export default LNMakeInvoiceForm;
