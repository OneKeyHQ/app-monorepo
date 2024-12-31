import { useCallback, useMemo, useState } from 'react';

import { useRoute } from '@react-navigation/core';
import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import type { IPageNavigationProp } from '@onekeyhq/components';
import {
  Form,
  Input,
  NumberSizeableText,
  Page,
  TextArea,
  useForm,
  useMedia,
} from '@onekeyhq/components';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
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
  const [settings] = useSettingsPersistAtom();
  const { serviceLightning } = backgroundApiProxy;
  const [isLoading, setIsLoading] = useState(false);

  const amountValue = form.watch('amount');

  const { result: invoiceConfig } = usePromiseResult(
    () => serviceLightning.getInvoiceConfig({ networkId }),
    [networkId, serviceLightning],
  );

  const { result } = usePromiseResult(async () => {
    const accountAddress =
      await backgroundApiProxy.serviceAccount.getAccountAddressForApi({
        networkId,
        accountId,
      });
    const r = await backgroundApiProxy.serviceToken.fetchTokensDetails({
      accountId,
      networkId,
      contractList: [''],
      withFrozenBalance: false,
      withCheckInscription: false,
    });
    const price = r[0]?.price;
    return {
      price,
    };
  }, [networkId, accountId]);

  const fiatValue = useMemo(() => {
    const amountBN = new BigNumber(amountValue || '0');
    const price = new BigNumber(result?.price || '0');
    if (amountBN.isInteger() && price) {
      return amountBN.multipliedBy(price).toFixed(2);
    }
    return '0.00';
  }, [amountValue, result?.price]);

  const onSubmit = useCallback(
    async (values: IFormValues) => {
      try {
        setIsLoading(true);
        const response = await serviceLightning.createInvoice({
          accountId,
          networkId,
          amount: values.amount || '0',
          description: values.description,
        });
        navigation.push(EModalReceiveRoutes.ReceiveInvoice, {
          networkId,
          accountId,
          paymentHash: response.payment_hash,
          paymentRequest: response.payment_request,
        });
      } finally {
        setIsLoading(false);
      }
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
            description={
              <NumberSizeableText
                pt="$1.5"
                size="$bodyMd"
                color="$textSubdued"
                formatter="value"
                formatterOptions={{ currency: settings.currencyInfo.symbol }}
              >
                {fiatValue}
              </NumberSizeableText>
            }
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
