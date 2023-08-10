import { useEffect, useMemo, useState } from 'react';

import { BigNumber } from 'bignumber.js';
import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import {
  Box,
  Form,
  Image,
  Text,
  useIsVerticalLayout,
} from '@onekeyhq/components';
import type { Token } from '@onekeyhq/engine/src/types/token';
import type { IInvoiceConfig } from '@onekeyhq/engine/src/vaults/impl/lightning-network/types/invoice';
import { FormatCurrencyTokenOfAccount } from '@onekeyhq/kit/src/components/Format';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';

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
  origin?: string;
  descriptionLabelId?: MessageDescriptor['id'];
  memo?: string;
  nativeToken?: Token;
  isWebln?: boolean;
  amountReadOnly?: boolean;
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
    origin,
    descriptionLabelId,
    memo,
    nativeToken,
    isWebln,
    amountReadOnly,
  } = props;
  const intl = useIntl();
  const isVerticalLayout = useIsVerticalLayout();

  const { control, watch } = useFormReturn;
  const amountValue = watch('amount');

  const minAmount = useMemo(() => Number(minimumAmount), [minimumAmount]);
  const maxAmount = useMemo(() => Number(maximumAmount), [maximumAmount]);

  const [invoiceConfig, setInvoiceConfig] = useState<IInvoiceConfig | null>(
    null,
  );
  useEffect(() => {
    if (!networkId || !accountId) return;
    backgroundApiProxy.serviceLightningNetwork
      .getInvoiceConfig({ networkId, accountId })
      .then((config) => {
        setInvoiceConfig(config);
      });
  }, [networkId, accountId]);

  const renderLabelAddon = useMemo(() => {
    if (Number(amount) > 0 || (minAmount > 0 && minAmount === maxAmount)) {
      return;
    }
    if (minAmount > 0 && maxAmount > 0) {
      return (
        <Text typography="Body2Strong" color="text-subdued">
          {intl.formatMessage(
            { id: 'form__between_int_and_int_sats' },
            {
              min: minAmount,
              max:
                maxAmount < minAmount
                  ? invoiceConfig?.maxReceiveAmount
                  : Math.min(
                      maxAmount,
                      Number(invoiceConfig?.maxReceiveAmount),
                    ),
            },
          )}
        </Text>
      );
    }
  }, [amount, minAmount, maxAmount, invoiceConfig, intl]);

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
          {origin && (
            <Image
              size="32px"
              mr={3}
              borderRadius={100}
              source={{ uri: `${origin}/favicon.ico` }}
              fallbackElement={<Box />}
            />
          )}
          <Text typography="Body2Mono" color="text-subdued" lineHeight="1.5em">
            {domain}
          </Text>
        </Box>
      </Form.Item>
      {!isWebln ? (
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
        </Form.Item>
      ) : null}
      <Form.Item
        label={`${intl.formatMessage({
          id: 'content__amount',
        })}`}
        control={control}
        name="amount"
        formControlProps={{ width: 'full' }}
        // @ts-expect-error
        rules={amountRules}
        defaultValue=""
        isLabelAddonActions={false}
        labelAddon={renderLabelAddon}
      >
        {amountReadOnly ? (
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
              {`${Number(amount)} ${intl.formatMessage({
                id: 'form__sats__units',
              })}`}
            </Text>
          </Box>
        ) : (
          <Form.Input
            type="number"
            size={isVerticalLayout ? 'xl' : 'default'}
            placeholder={intl.formatMessage({ id: 'form__enter_amount' })}
            isReadOnly={amountReadOnly}
            rightCustomElement={
              <Text px={4} typography="Button1" color="text-subdued">
                {intl.formatMessage({ id: 'form__sats__units' })}
              </Text>
            }
          />
        )}
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
      {isWebln ? (
        <Form.Item
          label={intl.formatMessage({ id: 'form__description__optional' })}
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
          <Form.Textarea
            size={isVerticalLayout ? 'xl' : 'default'}
            totalLines={isVerticalLayout ? 3 : 5}
            placeholder={intl.formatMessage({
              id: 'form__a_message_to_the_payer',
            })}
          />
        </Form.Item>
      ) : null}
    </Form>
  );
};
export default LNMakeInvoiceForm;
