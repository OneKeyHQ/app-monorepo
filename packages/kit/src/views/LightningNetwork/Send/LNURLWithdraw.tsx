import { useCallback, useMemo, useState } from 'react';

import { useRoute } from '@react-navigation/core';
import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import {
  Box,
  Form,
  Modal,
  Text,
  ToastManager,
  useForm,
  useIsVerticalLayout,
} from '@onekeyhq/components';
import { FormatCurrencyTokenOfAccount } from '@onekeyhq/kit/src/components/Format';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useNativeToken, useNavigation, useNetwork } from '../../../hooks';
import { SendModalRoutes } from '../../../routes/routesEnum';

import type { SendRoutesParams } from '../../../routes';
import type { ModalScreenProps } from '../../../routes/types';
import type { SendFeedbackReceiptParams } from '../../Send/types';
import type { RouteProp } from '@react-navigation/core';

type NavigationProps = ModalScreenProps<SendRoutesParams>;
type RouteProps = RouteProp<SendRoutesParams, SendModalRoutes.LNURLWithdraw>;

type FormValues = {
  amount: string;
  description: string;
  connectTo: string;
};

const LNURLWithdraw = () => {
  const intl = useIntl();
  const isVerticalLayout = useIsVerticalLayout();
  const route = useRoute<RouteProps>();
  const navigation = useNavigation<NavigationProps['navigation']>();

  const { networkId, accountId, lnurlDetails } = route.params ?? {};
  const { network } = useNetwork({ networkId });
  const { control, handleSubmit, watch } = useForm<FormValues>();
  const amountValue = watch('amount');
  const amountMin = Math.floor(+lnurlDetails.minWithdrawable / 1000);
  const amountMax = Math.floor(+lnurlDetails.maxWithdrawable / 1000);

  const nativeToken = useNativeToken(networkId);

  const [isLoading, setIsLoading] = useState(false);

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
            description: lnurlDetails.defaultDescription,
          });
        const { callback, k1 } = lnurlDetails;
        await backgroundApiProxy.serviceLightningNetwork.fetchLnurlWithdrawRequestResult(
          {
            callback,
            k1,
            pr: invoice.payment_request,
          },
        );
        const params: SendFeedbackReceiptParams = {
          networkId,
          accountId,
          txid: 'unknown_txid',
          type: 'LNURLWithdraw',
        };
        navigation.navigate(SendModalRoutes.SendFeedbackReceipt, params);
      } catch (e: any) {
        console.error(e);
        const { key, info } = e;
        if (key) {
          ToastManager.show(
            {
              title: intl.formatMessage(
                {
                  id: key,
                },
                info ?? {},
              ),
            },
            { type: 'error' },
          );
          return false;
        }
        ToastManager.show(
          { title: e instanceof Error ? e.message : e },
          { type: 'error' },
        );
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading, networkId, navigation, intl, accountId, lnurlDetails],
  );

  const renderLabelAddon = useMemo(
    () => (
      <Text typography="Body2Strong" color="text-subdued">
        betweeen {amountMin} and {amountMax} sats
      </Text>
    ),
    [amountMin, amountMax],
  );

  const doSubmit = handleSubmit(onSubmit);

  return (
    <Modal
      header="LNURL Withdraw"
      headerDescription={lnurlDetails.domain}
      primaryActionTranslationId="action__withdraw"
      primaryActionProps={{
        isDisabled: isLoading,
        isLoading,
      }}
      onPrimaryActionPress={() => doSubmit()}
      secondaryActionTranslationId="action__cancel"
      onSecondaryActionPress={() => {
        if (navigation?.canGoBack?.()) {
          navigation.goBack();
        }
      }}
      height="auto"
      scrollViewProps={{
        contentContainerStyle: {
          flex: 1,
          paddingVertical: isVerticalLayout ? 16 : 24,
        },
        children: (
          <Form>
            <Form.Item
              label="Connect to"
              name="connectTo"
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
                <Text
                  typography="Body2Mono"
                  color="text-subdued"
                  lineHeight="1.5em"
                >
                  {lnurlDetails.domain}
                </Text>
              </Box>
            </Form.Item>
            <Form.Item
              label="Withdraw Description"
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
                  {lnurlDetails.defaultDescription}
                </Text>
              </Box>
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
                  value: amountMin,
                  message: intl.formatMessage(
                    {
                      id: 'form__field_too_small',
                    },
                    {
                      0: amountMin,
                    },
                  ),
                },
                max: {
                  value: amountMax,
                  message: intl.formatMessage(
                    {
                      id: 'form__field_too_large',
                    },
                    {
                      0: amountMax,
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
                  if (amountMin === 0 && !value) return;
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
          </Form>
        ),
      }}
    />
  );
};

export default LNURLWithdraw;
