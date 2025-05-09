import { useMemo } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import { Form, Input, TextArea } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import chainValueUtils from '@onekeyhq/shared/src/utils/chainValueUtils';
import { ELightningUnit } from '@onekeyhq/shared/types/lightning';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { LightningUnitSwitch } from '../../../components/UnitSwitch';
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
  commentAllowedLength?: number;
  metadata?: string;
  // nativeToken?: Token;
  isWebln?: boolean;
  amountReadOnly?: boolean;
  commentReadOnly?: boolean;
  lnUnit: ELightningUnit;
  setLnUnit: (unit: ELightningUnit) => void;
};

function LNSendPaymentForm(props: ISendPaymentFormProps) {
  const {
    networkId,
    useFormReturn,
    amount,
    minimumAmount,
    maximumAmount,
    descriptionLabelId,
    commentAllowedLength,
    metadata: originMetadata,
    // nativeToken,
    amountReadOnly,
    commentReadOnly,
    lnUnit,
    setLnUnit,
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

  const linkedInvoiceConfig = useMemo(() => {
    return {
      ...invoiceConfig,
      maxSendAmount:
        lnUnit === ELightningUnit.BTC
          ? chainValueUtils.convertSatsToBtc(invoiceConfig?.maxSendAmount ?? 0)
          : invoiceConfig?.maxSendAmount ?? 0,
      maxReceiveAmount:
        lnUnit === ELightningUnit.BTC
          ? chainValueUtils.convertSatsToBtc(
              invoiceConfig?.maxReceiveAmount ?? 0,
            )
          : invoiceConfig?.maxReceiveAmount ?? 0,
    };
  }, [invoiceConfig, lnUnit]);

  const linkedMinAmount = useMemo(() => {
    return lnUnit === ELightningUnit.BTC
      ? chainValueUtils.convertSatsToBtc(minimumAmount ?? 0)
      : minimumAmount ?? 0;
  }, [lnUnit, minimumAmount]);

  const linkedMaxAmount = useMemo(() => {
    return lnUnit === ELightningUnit.BTC
      ? chainValueUtils.convertSatsToBtc(maximumAmount ?? 0)
      : maximumAmount ?? 0;
  }, [lnUnit, maximumAmount]);

  const minAmount = new BigNumber(linkedMinAmount).toNumber();
  const maxAmount = new BigNumber(linkedMaxAmount).toNumber();
  const amountRules = useMemo(() => {
    let max;
    if (
      maxAmount &&
      maxAmount > 0 &&
      maxAmount > minAmount &&
      maxAmount < Number(linkedInvoiceConfig?.maxSendAmount)
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
      pattern:
        lnUnit === ELightningUnit.BTC
          ? {
              value: /^\d*\.?\d*$/,
              message: '',
            }
          : {
              value: /^[0-9]*$/,
              message: intl.formatMessage({
                id: ETranslations.send_field_only_integer,
              }),
            },
      validate: (value: number) => {
        // allow unspecified amount
        if (minAmount <= 0 && !value) return;

        const valueBN = new BigNumber(value);
        if (lnUnit === ELightningUnit.SATS && !valueBN.isInteger()) {
          return intl.formatMessage({
            id: ETranslations.send_field_only_integer,
          });
        }

        if (
          linkedInvoiceConfig?.maxSendAmount &&
          valueBN.isGreaterThan(linkedInvoiceConfig?.maxSendAmount)
        ) {
          return intl.formatMessage(
            {
              id: ETranslations.dapp_connect_amount_should_not_exceed,
            },
            {
              0: linkedInvoiceConfig?.maxSendAmount,
            },
          );
        }
      },
    };
  }, [minAmount, maxAmount, intl, linkedInvoiceConfig?.maxSendAmount, lnUnit]);

  const amountDescription = useMemo(() => {
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
              ? linkedInvoiceConfig?.maxSendAmount
              : Math.min(maxAmount, Number(linkedInvoiceConfig?.maxSendAmount)),
          unit: lnUnit === ELightningUnit.BTC ? 'BTC' : 'sats',
        },
      );
    }
  }, [
    amount,
    minAmount,
    maxAmount,
    intl,
    linkedInvoiceConfig?.maxSendAmount,
    lnUnit,
  ]);

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
                label={intl.formatMessage({
                  id: ETranslations.global_description,
                })}
                name={name}
                key={content}
              >
                <TextArea editable={false} disabled numberOfLines={2} />
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
          id: ETranslations.dapp_connect_amount,
        })}
        name="amount"
        rules={amountRules}
        labelAddon={
          <LightningUnitSwitch
            value={lnUnit}
            onChange={(value) => {
              setLnUnit(value as ELightningUnit);
              const currentAmount = useFormReturn.getValues('amount');
              useFormReturn.setValue(
                'amount',
                value === ELightningUnit.BTC
                  ? chainValueUtils.convertSatsToBtc(currentAmount ?? 0)
                  : chainValueUtils.convertBtcToSats(currentAmount ?? 0),
              );
              setTimeout(() => {
                void useFormReturn.trigger('amount');
              }, 100);
            }}
          />
        }
        // TODO: price
        description={amountDescription}
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
              label: lnUnit === ELightningUnit.BTC ? 'BTC' : 'sats',
            },
          ]}
        />
      </Form.Field>
      {Number(commentAllowedLength) > 0 ? (
        <Form.Field
          label={intl.formatMessage({
            id:
              descriptionLabelId ??
              ETranslations.dapp_connect_description_optional,
          })}
          name="comment"
          rules={{
            maxLength: {
              value: Number(commentAllowedLength),
              message: intl.formatMessage(
                {
                  id: ETranslations.dapp_connect_msg_description_can_be_up_to_int_characters,
                },
                { number: commentAllowedLength },
              ),
            },
          }}
          defaultValue=""
        >
          <TextArea editable={!commentReadOnly} disabled={commentReadOnly} />
        </Form.Field>
      ) : null}
    </Form>
  );
}

export default LNSendPaymentForm;
