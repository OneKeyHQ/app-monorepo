import { useCallback, useEffect, useMemo, useState } from 'react';

import { useRoute } from '@react-navigation/core';
import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import {
  Box,
  Form,
  Image,
  Modal,
  Text,
  useForm,
  useIsVerticalLayout,
} from '@onekeyhq/components';
import qrcodeLogo from '@onekeyhq/kit/assets/qrcode_logo.png';

import { FormatCurrencyTokenOfAccount } from '../../../components/Format';
import { useActiveSideAccount, useNativeToken } from '../../../hooks';

import type { SendRoutesParams } from '../../../routes';
import type { SendModalRoutes } from '../../Send/enums';
import type { RouteProp } from '@react-navigation/core';

type RouteProps = RouteProp<SendRoutesParams, SendModalRoutes.PreSendAmount>;

type FormValues = {
  amount: string;
  description: string;
  connectTo: string;
  comment: string;
};

const PayRequest = () => {
  const intl = useIntl();
  const isVerticalLayout = useIsVerticalLayout();
  const route = useRoute<RouteProps>();
  const transferInfo = useMemo(() => ({ ...route.params }), [route.params]);
  const { account, accountId, networkId, network } =
    useActiveSideAccount(transferInfo);
  const { control, handleSubmit, watch } = useForm<FormValues>({
    mode: 'onChange',
  });
  const amountValue = watch('amount');
  const [isLoading, setIsLoading] = useState(false);
  const [validateMessage, setvalidateMessage] = useState({
    errorMessage: '',
  });

  const nativeToken = useNativeToken(networkId);

  const doSubmit = () => {};
  return (
    <Modal
      header={intl.formatMessage({ id: 'title__lnurl_pay' })}
      headerDescription="localhost.com"
      primaryActionTranslationId="action__next"
      primaryActionProps={{
        isDisabled: isLoading,
        isLoading,
      }}
      onPrimaryActionPress={() => doSubmit()}
      secondaryActionTranslationId="action__cancel"
      onSecondaryActionPress={() => {}}
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
                <Image
                  borderRadius="full"
                  resizeMethod="auto"
                  resizeMode="contain"
                  width={8}
                  height={8}
                  source={qrcodeLogo}
                />
                <Text
                  ml={3}
                  typography="Body2Mono"
                  color="text-subdued"
                  lineHeight="1.5em"
                >
                  localhost.com
                </Text>
              </Box>
            </Form.Item>
            <Form.Item
              label={intl.formatMessage({ id: 'form__payment_description' })}
              name="description"
              control={control}
              formControlProps={{ width: 'full' }}
            >
              <Form.Input
                size={isVerticalLayout ? 'xl' : 'default'}
                defaultValue="This is a payment request"
                isReadOnly
                color="text-subdued"
              />
              {/* <Form.Textarea
                size={isVerticalLayout ? 'xl' : 'default'}
                totalLines={isVerticalLayout ? 1 : 3}
                defaultValue="This is a payment request"
                isReadOnly
                color="text-subdued"
              /> */}
            </Form.Item>
            <Form.Item
              label={`${intl.formatMessage({
                id: 'content__amount',
              })}`}
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
                },
              }}
              defaultValue=""
              isLabelAddonActions={false}
              labelAddon={
                <Text typography="Body2Strong" color="text-subdued">
                  betweeen 21 and 100000000 sats
                </Text>
              }
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
            <Form.Item
              label={intl.formatMessage({ id: 'form__comment_optional' })}
              control={control}
              name="comment"
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
              />
            </Form.Item>
          </Form>
        ),
      }}
    />
  );
};

export { PayRequest };
