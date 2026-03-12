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
          : (invoiceConfig?.maxSendAmount ?? 0),
      maxReceiveAmount:
        lnUnit === ELightningUnit.BTC
          ? chainValueUtils.convertSatsToBtc(
              invoiceConfig?.maxReceiveAmount ?? 0,
            )
          : (invoiceConfig?.maxReceiveAmount ?? 0),
    };
  }, [invoiceConfig, lnUnit]);

  const linkedMinAmount = useMemo(() => {
    return lnUnit === ELightningUnit.BTC
      ? chainValueUtils.convertSatsToBtc(minimumAmount ?? 0)
      : (minimumAmount ?? 0);
  }, [lnUnit, minimumAmount]);

  const linkedMaxAmount = useMemo(() => {
    return lnUnit === ELightningUnit.BTC
      ? chainValueUtils.convertSatsToBtc(maximumAmount ?? 0)
      : (maximumAmount ?? 0);
  }, [lnUnit, maximumAmount]);

  const minAmount = useMemo(
    () => new BigNumber(linkedMinAmount ?? 0),
    [linkedMinAmount],
  );
  const maxAmount = useMemo(
    () => new BigNumber(linkedMaxAmount ?? 0),
    [linkedMaxAmount],
  );
  const maxReceiveAmount = useMemo(
    () => new BigNumber(linkedInvoiceConfig?.maxReceiveAmount ?? 0),
    [linkedInvoiceConfig?.maxReceiveAmount],
  );
  const minAmountDisplay = useMemo(() => minAmount.toFixed(), [minAmount]);
  const maxAmountDisplay = useMemo(() => maxAmount.toFixed(), [maxAmount]);
  const maxReceiveAmountDisplay = useMemo(
    () => maxReceiveAmount.toFixed(),
    [maxReceiveAmount],
  );

  const amountRules = useMemo(() => {
    return {
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
      validate: (value: string) => {
        // allow unspecified amount
        if (minAmount.lte(0) && !value) return;
        const valueBN = new BigNumber(value);
        if (!value || valueBN.isNaN()) {
          return;
        }
        if (lnUnit === ELightningUnit.SATS && !valueBN.isInteger()) {
          return intl.formatMessage({
            id: ETranslations.send_field_only_integer,
          });
        }

        if (minAmount.gt(0) && valueBN.lt(minAmount)) {
          return intl.formatMessage(
            {
              id: ETranslations.dapp_connect_amount_should_be_at_least,
            },
            {
              0: minAmountDisplay,
            },
          );
        }

        // When maxAmount <= minAmount (abnormal range from server), skip this
        // check and fall through to the maxReceiveAmount guard below.
        if (
          maxAmount.gt(0) &&
          maxAmount.gt(minAmount) &&
          valueBN.gt(maxAmount)
        ) {
          return intl.formatMessage(
            {
              id: ETranslations.dapp_connect_amount_should_not_exceed,
            },
            {
              0: maxAmountDisplay,
            },
          );
        }

        if (maxReceiveAmount.gt(0) && valueBN.gt(maxReceiveAmount)) {
          return intl.formatMessage(
            {
              id: ETranslations.dapp_connect_amount_should_not_exceed,
            },
            {
              0: maxReceiveAmountDisplay,
            },
          );
        }
      },
    };
  }, [
    intl,
    lnUnit,
    maxAmount,
    maxAmountDisplay,
    maxReceiveAmount,
    maxReceiveAmountDisplay,
    minAmount,
    minAmountDisplay,
  ]);

  const amountDescription = useMemo(() => {
    const fixedAmount = new BigNumber(amount ?? 0);
    if (fixedAmount.gt(0) || (minAmount.gt(0) && minAmount.eq(maxAmount))) {
      return;
    }
    if (minAmount.gt(0) && maxAmount.gt(0)) {
      const descriptionMax = maxAmount.lt(minAmount)
        ? maxReceiveAmountDisplay
        : BigNumber.minimum(maxAmount, maxReceiveAmount).toFixed();
      return intl.formatMessage(
        { id: ETranslations.dapp_connect_sats_between },
        {
          min: minAmountDisplay,
          max: descriptionMax,
          unit: lnUnit === ELightningUnit.BTC ? 'BTC' : 'sats',
        },
      );
    }
  }, [
    amount,
    minAmount,
    maxAmount,
    maxReceiveAmount,
    maxReceiveAmountDisplay,
    intl,
    lnUnit,
    minAmountDisplay,
  ]);

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
