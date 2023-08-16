import { useCallback, useEffect, useState } from 'react';

import { useRoute } from '@react-navigation/core';
import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  Box,
  Form,
  Image,
  Modal,
  Text,
  useForm,
  useIsVerticalLayout,
} from '@onekeyhq/components';
import type { IInvoiceConfig } from '@onekeyhq/engine/src/vaults/impl/lightning-network/types/invoice';
import { FormatCurrencyTokenOfAccount } from '@onekeyhq/kit/src/components/Format';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useNativeToken, useNavigation, useNetwork } from '../../../hooks';
import { ModalRoutes, RootRoutes } from '../../../routes/routesEnum';
import { ReceiveTokenModalRoutes } from '../../ReceiveToken/types';

import type { ModalScreenProps } from '../../../routes/types';
import type { ReceiveTokenRoutesParams } from '../../ReceiveToken/types';
import type { RouteProp } from '@react-navigation/core';

type NavigationProps = ModalScreenProps<ReceiveTokenRoutesParams>;
type RouteProps = RouteProp<
  ReceiveTokenRoutesParams,
  ReceiveTokenModalRoutes.CreateInvoice
>;

type FormValues = {
  amount: string;
  description: string;
};

const CreateInvoice = () => {
  const intl = useIntl();
  const isVerticalLayout = useIsVerticalLayout();
  const route = useRoute<RouteProps>();
  const navigation = useNavigation<NavigationProps['navigation']>();

  const { networkId, accountId } = route.params ?? {};
  const { network } = useNetwork({ networkId });
  const { control, handleSubmit, watch } = useForm<FormValues>({
    mode: 'onChange',
  });
  const amountValue = watch('amount');
  const [validateMessage, setvalidateMessage] = useState({
    errorMessage: '',
  });

  const nativeToken = useNativeToken(networkId);

  const [isLoading, setIsLoading] = useState(false);
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

  const onSubmit = useCallback(
    async (values: FormValues) => {
      if (isLoading) return;
      if (!networkId || !accountId) return;
      setIsLoading(true);
      const amount = values.amount || '0';
      try {
        const invoice =
          await backgroundApiProxy.serviceLightningNetwork.createInvoice({
            networkId,
            accountId,
            amount,
            description: values.description,
          });
        navigation.navigate(RootRoutes.Modal, {
          screen: ModalRoutes.Receive,
          params: {
            screen: ReceiveTokenModalRoutes.ReceiveInvoice,
            params: {
              networkId,
              accountId,
              paymentRequest: invoice.payment_request,
              paymentHash: invoice.payment_hash,
            },
          },
        });
      } catch (e: any) {
        console.error(e);
        const { key, info } = e;
        if (key) {
          setvalidateMessage({
            errorMessage: intl.formatMessage(
              {
                id: key,
              },
              info ?? {},
            ),
          });
          return false;
        }
        setvalidateMessage({
          errorMessage: intl.formatMessage({
            id: 'form__create_invoice_failed',
          }),
        });
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading, networkId, navigation, intl, accountId],
  );

  const doSubmit = handleSubmit(onSubmit);

  return (
    <Modal
      header={intl.formatMessage({ id: 'action__receive' })}
      headerDescription={
        <Box flexDirection="row" alignItems="center" mt={0.5}>
          <Image
            alt="logoURI"
            source={{ uri: network?.logoURI }}
            size={4}
            borderRadius="full"
            mr={2}
          />
          <Text textAlign="center" typography="Caption" color="text-subdued">
            {network?.name}
          </Text>
        </Box>
      }
      hideSecondaryAction
      primaryActionTranslationId="action__next"
      primaryActionProps={{
        isDisabled: isLoading,
        isLoading,
      }}
      onPrimaryActionPress={() => doSubmit()}
      height="418px"
      scrollViewProps={{
        contentContainerStyle: {
          flex: 1,
          paddingVertical: isVerticalLayout ? 16 : 24,
        },
        children: (
          <Form>
            <Form.Item
              label={`${intl.formatMessage({
                id: 'content__amount',
              })}(${intl.formatMessage({ id: 'form__sats__units' })})`}
              control={control}
              errorMessage={validateMessage.errorMessage}
              name="amount"
              formControlProps={{ width: 'full' }}
              rules={{
                min: {
                  value: 0,
                  message: intl.formatMessage(
                    {
                      id: 'form__field_too_small',
                    },
                    {
                      0: 0,
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
                  if (!value) return;

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
              }}
              defaultValue=""
            >
              <Form.Input
                type="number"
                size={isVerticalLayout ? 'xl' : 'default'}
                placeholder={intl.formatMessage({ id: 'form__enter_amount' })}
                rightCustomElement={
                  <Text px={4} typography="Button1" color="text-subdued">
                    {intl.formatMessage({ id: 'form__sats__units' })}
                  </Text>
                }
              />
            </Form.Item>
            <FormatCurrencyTokenOfAccount
              accountId={accountId ?? ''}
              networkId={network?.id ?? ''}
              token={nativeToken}
              value={new BigNumber(amountValue)}
              render={(ele) => (
                <Text typography="Body2" color="text-subdued" mt="-18px">
                  {ele}
                </Text>
              )}
            />
            <Form.Item
              label={intl.formatMessage({ id: 'form__description' })}
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
          </Form>
        ),
      }}
    />
  );
};

export default CreateInvoice;
