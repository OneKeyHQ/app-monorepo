import { useCallback, useMemo, useState } from 'react';

import { useRoute } from '@react-navigation/core';
import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';
import { InputAccessoryView } from 'react-native';

import type { IPageNavigationProp } from '@onekeyhq/components';
import {
  Button,
  Form,
  Input,
  NumberSizeableText,
  Page,
  TextArea,
  XStack,
  useForm,
  useMedia,
} from '@onekeyhq/components';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { dismissKeyboardWithDelay } from '@onekeyhq/shared/src/keyboard';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EModalReceiveRoutes } from '@onekeyhq/shared/src/routes';
import type {
  IModalReceiveParamList,
  IModalSendParamList,
} from '@onekeyhq/shared/src/routes';
import chainValueUtils from '@onekeyhq/shared/src/utils/chainValueUtils';
import { ELightningUnit } from '@onekeyhq/shared/types/lightning';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { LightningUnitSwitch } from '../../../components/UnitSwitch';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { usePromiseResult } from '../../../hooks/usePromiseResult';

import type { RouteProp } from '@react-navigation/core';

type IFormValues = {
  amount: string;
  description: string;
};

const CREATE_INVOICE_INPUT_ACCESSORY_VIEW_ID =
  'create-invoice-input-accessory-view';

function CreateInvoice() {
  const intl = useIntl();
  const media = useMedia();
  const form = useForm<IFormValues>({
    mode: 'onChange',
    reValidateMode: 'onBlur',
  });
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
  const [lnUnit, setLnUnit] = useState(ELightningUnit.SATS);
  const { result: invoiceConfig } = usePromiseResult(
    () => serviceLightning.getInvoiceConfig({ networkId }),
    [networkId, serviceLightning],
  );

  const linkedAmount = useMemo(() => {
    if (lnUnit === ELightningUnit.BTC) {
      return chainValueUtils.convertBtcToSats(amountValue);
    }
    return amountValue;
  }, [lnUnit, amountValue]);

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

  const { result } = usePromiseResult(async () => {
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
    const amountBN = new BigNumber(linkedAmount || '0');
    const price = new BigNumber(result?.price || '0');
    if (amountBN.isInteger() && price) {
      return amountBN.multipliedBy(price).toFixed(2);
    }
    return '0.00';
  }, [linkedAmount, result?.price]);

  const onSubmit = useCallback(
    async (values: IFormValues) => {
      try {
        setIsLoading(true);
        const response = await serviceLightning.createInvoice({
          accountId,
          networkId,
          amount:
            lnUnit === ELightningUnit.BTC
              ? chainValueUtils.convertBtcToSats(values.amount || '0')
              : values.amount || '0',
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
    [accountId, networkId, serviceLightning, navigation, lnUnit],
  );

  return (
    <Page
      scrollEnabled
      scrollProps={{
        keyboardDismissMode: 'on-drag',
        keyboardShouldPersistTaps: 'handled',
      }}
    >
      <Page.Header
        title={intl.formatMessage({ id: ETranslations.lightning_invoice })}
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
                  id: ETranslations.form_lightning_invoice_error_positive_integer_only,
                }),
              },
              pattern:
                lnUnit === ELightningUnit.BTC
                  ? {
                      value: /^\d*\.?\d*$/,
                      message: '',
                    }
                  : {
                      value: /^[0-9]*$/,
                      message: intl.formatMessage({
                        id: ETranslations.form_lightning_invoice_error_positive_integer_only,
                      }),
                    },
              validate: (value) => {
                // allow unspecified amount
                if (!value) return;

                const valueBN = new BigNumber(value);
                if (lnUnit === ELightningUnit.SATS && !valueBN.isInteger()) {
                  return intl.formatMessage({
                    id: ETranslations.form_lightning_invoice_error_positive_integer_only,
                  });
                }
                if (
                  linkedInvoiceConfig?.maxReceiveAmount &&
                  valueBN.isGreaterThan(linkedInvoiceConfig?.maxReceiveAmount)
                ) {
                  return intl.formatMessage(
                    {
                      id: ETranslations.form_lightning_invoice_amount_error_max,
                    },
                    {
                      amount: linkedInvoiceConfig.maxReceiveAmount,
                      unit: lnUnit === ELightningUnit.BTC ? 'BTC' : 'sats',
                    },
                  );
                }
              },
            }}
            labelAddon={
              <LightningUnitSwitch
                value={lnUnit}
                onChange={(v) => {
                  setLnUnit(v as ELightningUnit);
                  form.setValue(
                    'amount',
                    v === ELightningUnit.BTC
                      ? chainValueUtils.convertSatsToBtc(
                          form.getValues('amount'),
                        )
                      : chainValueUtils.convertBtcToSats(
                          form.getValues('amount'),
                        ),
                  );
                  setTimeout(() => {
                    void form.trigger('amount');
                  }, 100);
                }}
              />
            }
          >
            <Input
              placeholder={intl.formatMessage({
                id: ETranslations.form_amount_placeholder,
              })}
              size="large"
              $gtMd={{
                size: 'medium',
              }}
              keyboardType="decimal-pad"
              addOns={[
                {
                  label: lnUnit === ELightningUnit.BTC ? 'BTC' : 'sats',
                },
              ]}
              inputAccessoryViewID={
                platformEnv.isNativeIOS
                  ? CREATE_INVOICE_INPUT_ACCESSORY_VIEW_ID
                  : undefined
              }
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
                id: ETranslations.form_lightning_invoice_placeholder,
              })}
              inputAccessoryViewID={
                platformEnv.isNativeIOS
                  ? CREATE_INVOICE_INPUT_ACCESSORY_VIEW_ID
                  : undefined
              }
            />
          </Form.Field>
        </Form>
      </Page.Body>
      <Page.Footer
        onConfirmText={intl.formatMessage({
          id: ETranslations.global_create_invoice,
        })}
        onConfirm={() => {
          void dismissKeyboardWithDelay(100);
          void form.handleSubmit(onSubmit)();
        }}
        confirmButtonProps={{
          loading: isLoading,
        }}
      />
      {platformEnv.isNativeIOS ? (
        <InputAccessoryView nativeID={CREATE_INVOICE_INPUT_ACCESSORY_VIEW_ID}>
          <XStack
            p="$2.5"
            px="$3.5"
            justifyContent="flex-end"
            bg="$bgSubdued"
            borderTopWidth="$px"
            borderTopColor="$borderSubdued"
          >
            <Button
              variant="tertiary"
              onPress={() => void dismissKeyboardWithDelay(100)}
            >
              {intl.formatMessage({ id: ETranslations.global_done })}
            </Button>
          </XStack>
        </InputAccessoryView>
      ) : null}
    </Page>
  );
}

export default CreateInvoice;
