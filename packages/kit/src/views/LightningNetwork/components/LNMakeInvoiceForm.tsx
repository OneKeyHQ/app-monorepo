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
  lnUnit: ELightningUnit;
  setLnUnit: (unit: ELightningUnit) => void;
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
    lnUnit,
    setLnUnit,
  } = props;
  const intl = useIntl();

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
      maxAmount < Number(linkedInvoiceConfig?.maxReceiveAmount)
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
          linkedInvoiceConfig?.maxReceiveAmount &&
          valueBN.isGreaterThan(linkedInvoiceConfig?.maxReceiveAmount)
        ) {
          return intl.formatMessage(
            {
              id: ETranslations.dapp_connect_amount_should_not_exceed,
            },
            {
              0: linkedInvoiceConfig?.maxReceiveAmount,
            },
          );
        }
      },
    };
  }, [minAmount, maxAmount, linkedInvoiceConfig, intl, lnUnit]);

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
              ? linkedInvoiceConfig?.maxReceiveAmount
              : Math.min(
                  maxAmount,
                  Number(linkedInvoiceConfig?.maxReceiveAmount),
                ),
          unit: lnUnit === ELightningUnit.BTC ? 'BTC' : 'sats',
        },
      );
    }
  }, [amount, minAmount, maxAmount, linkedInvoiceConfig, intl, lnUnit]);

  return (
    <Form form={useFormReturn}>
      <Form.Field
        label={intl.formatMessage({
          id: ETranslations.send_amount,
        })}
        name="amount"
        rules={amountRules}
        // TODO: price
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
