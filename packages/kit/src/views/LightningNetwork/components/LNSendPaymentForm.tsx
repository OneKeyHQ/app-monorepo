import { useEffect, useMemo, useState } from 'react';

import { BigNumber } from 'bignumber.js';
import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import { Box, Form, Text, useIsVerticalLayout } from '@onekeyhq/components';
import type { Token } from '@onekeyhq/engine/src/types/token';
import type { IInvoiceConfig } from '@onekeyhq/engine/src/vaults/impl/lightning-network/types/invoice';
import { FormatCurrencyTokenOfAccount } from '@onekeyhq/kit/src/components/Format';
import { TxInteractInfo } from '@onekeyhq/kit/src/views/TxDetail/components/TxInteractInfo';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useInteractWithInfo } from '../../../hooks/useDecodedTx';

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
  origin: string;
  descriptionLabelId?: MessageDescriptor['id'];
  memo?: string;
  commentAllowedLength?: number;
  metadata?: string;
  siteImage?: string;
  nativeToken?: Token;
  isWebln?: boolean;
  amountReadOnly?: boolean;
};

const LNSendPaymentForm = (props: ISendPaymentFormProps) => {
  const {
    accountId,
    networkId,
    useFormReturn,
    amount,
    minimumAmount,
    maximumAmount,
    origin,
    descriptionLabelId,
    memo,
    commentAllowedLength,
    metadata: originMetadata,
    siteImage,
    nativeToken,
    amountReadOnly,
  } = props;

  const intl = useIntl();
  const isVerticalLayout = useIsVerticalLayout();

  const { control, watch } = useFormReturn;
  const amountValue = watch('amount');

  const minAmount = useMemo(() => Number(minimumAmount), [minimumAmount]);
  const maxAmount = useMemo(() => Number(maximumAmount), [maximumAmount]);

  const interactInfo = useInteractWithInfo({
    sourceInfo: {
      id: 'mockId',
      hostname: '',
      scope: 'webln',
      origin,
      data: {
        method: 'sendPayment',
      },
    },
  });

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
                  ? invoiceConfig?.maxSendAmount
                  : Math.min(maxAmount, Number(invoiceConfig?.maxSendAmount)),
            },
          )}
        </Text>
      );
    }
  }, [amount, minAmount, maxAmount, intl, invoiceConfig]);

  const renderMetadataText = useMemo(() => {
    if (!originMetadata || !originMetadata.length) return null;
    try {
      const metadata = JSON.parse(originMetadata);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      return metadata
        .map(([type, content]: [string, string]) => {
          if (type === 'text/plain' || type === 'text/long-desc') {
            return (
              <Form.Item
                label={intl.formatMessage({ id: 'form__payment_description' })}
                name="description"
                control={control}
                formControlProps={{ width: 'full' }}
                key={content}
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
                    {content}
                  </Text>
                </Box>
              </Form.Item>
            );
          }
          return undefined;
        })
        .filter(Boolean);
    } catch (e) {
      console.error(e);
    }
    return [];
  }, [control, intl, originMetadata]);

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

  return (
    <Form>
      <Form.Item
        label={intl.formatMessage({ id: 'form__request_from' })}
        name="requestFrom"
        control={control}
        formControlProps={{ width: 'full' }}
      >
        <TxInteractInfo
          origin={interactInfo?.url ?? ''}
          name={interactInfo?.name}
          icon={siteImage ?? interactInfo?.icons[0]}
          networkId={networkId}
          mb={0}
        />
      </Form.Item>
      {renderMetadataText}
      {memo && memo.length ? (
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
      {Number(commentAllowedLength) > 0 && (
        <Form.Item
          label={intl.formatMessage({ id: 'form__comment_optional' })}
          control={control}
          name="comment"
          formControlProps={{ width: 'full' }}
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
          <Form.Textarea
            size={isVerticalLayout ? 'xl' : 'default'}
            totalLines={isVerticalLayout ? 3 : 5}
          />
        </Form.Item>
      )}
    </Form>
  );
};

export default LNSendPaymentForm;
