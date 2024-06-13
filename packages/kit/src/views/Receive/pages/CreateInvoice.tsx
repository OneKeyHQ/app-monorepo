import { useCallback, useState } from 'react';

import { useRoute } from '@react-navigation/core';
import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import type { IPageNavigationProp } from '@onekeyhq/components';
import {
  Form,
  Input,
  Page,
  TextArea,
  useForm,
  useMedia,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EModalReceiveRoutes } from '@onekeyhq/shared/src/routes';
import type {
  IModalReceiveParamList,
  IModalSendParamList,
} from '@onekeyhq/shared/src/routes';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { usePromiseResult } from '../../../hooks/usePromiseResult';

import type { RouteProp } from '@react-navigation/core';

type IFormValues = {
  amount: string;
  description: string;
};

function CreateInvoice() {
  const intl = useIntl();
  const media = useMedia();
  const form = useForm<IFormValues>();
  const route =
    useRoute<
      RouteProp<IModalReceiveParamList, EModalReceiveRoutes.CreateInvoice>
    >();
  const navigation =
    useAppNavigation<IPageNavigationProp<IModalSendParamList>>();
  const { accountId, networkId } = route.params;
  const { serviceLightning } = backgroundApiProxy;
  const [isLoading, setIsLoading] = useState(false);

  const { result: invoiceConfig } = usePromiseResult(
    () => serviceLightning.getInvoiceConfig({ networkId }),
    [networkId, serviceLightning],
  );

  const onSubmit = useCallback(
    async (values: IFormValues) => {
      setIsLoading(true);
      const response = await serviceLightning.createInvoice({
        accountId,
        networkId,
        amount: values.amount,
        description: values.description,
      });
      setIsLoading(false);
      navigation.push(EModalReceiveRoutes.ReceiveInvoice, {
        networkId,
        accountId,
        paymentHash: response.payment_hash,
        paymentRequest: response.payment_request,
      });
    },
    [accountId, networkId, serviceLightning, navigation],
  );

  return (
    <Page>
      <Page.Header
        title={intl.formatMessage({ id: ETranslations.lighting_invoice })}
      />
      <Page.Body p="$5">
        <Form form={form}>
          <Form.Field
            label={intl.formatMessage({ id: ETranslations.send_amount })}
            name="amount"
            description="$0.00"
            rules={{
              min: {
                value: 0,
                message: intl.formatMessage({
                  id: ETranslations.form_lighting_invoice_error_positive_integer_only,
                }),
              },
              pattern: {
                value: /^[0-9]*$/,
                message: intl.formatMessage({
                  id: ETranslations.form_lighting_invoice_error_positive_integer_only,
                }),
              },
              validate: (value) => {
                // allow unspecified amount
                if (!value) return;

                const valueBN = new BigNumber(value);
                if (!valueBN.isInteger()) {
                  return intl.formatMessage({
                    id: ETranslations.form_lighting_invoice_error_positive_integer_only,
                  });
                }
                if (
                  invoiceConfig?.maxReceiveAmount &&
                  valueBN.isGreaterThan(invoiceConfig?.maxReceiveAmount)
                ) {
                  return intl.formatMessage(
                    {
                      id: ETranslations.form_lighting_invoice_amount_error_max,
                    },
                    {
                      amount: invoiceConfig?.maxReceiveAmount,
                    },
                  );
                }
              },
            }}
          >
            <Input
              placeholder={intl.formatMessage({
                id: ETranslations.form_amount_placeholder,
              })}
              size="large"
              $gtMd={{
                size: 'medium',
              }}
              keyboardType="number-pad"
              addOns={[
                {
                  label: 'sats',
                },
              ]}
            />
          </Form.Field>
          <Form.Field
            label={intl.formatMessage({ id: ETranslations.global_description })}
            name="description"
          >
            <TextArea
              size={media.gtMd ? 'medium' : 'large'}
              $gtMd={{
                size: 'medium',
              }}
              placeholder={intl.formatMessage({
                id: ETranslations.form_lighting_invoice_placeholder,
              })}
            />
          </Form.Field>
        </Form>
      </Page.Body>
      <Page.Footer
        onConfirmText={intl.formatMessage({
          id: ETranslations.global_create_invoice,
        })}
        onConfirm={() => form.handleSubmit(onSubmit)()}
        confirmButtonProps={{
          loading: isLoading,
        }}
      />
    </Page>
  );
}

export default CreateInvoice;
