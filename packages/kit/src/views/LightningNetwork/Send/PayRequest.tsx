import { useCallback, useEffect, useMemo, useState } from 'react';

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

import { useActiveSideAccount } from '../../../hooks';

import type { SendRoutesParams } from '../../../routes';
import type { SendModalRoutes } from '../../Send/enums';
import type { RouteProp } from '@react-navigation/core';

type RouteProps = RouteProp<SendRoutesParams, SendModalRoutes.PreSendAmount>;

type FormValues = {
  amount: string;
  description: string;
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
  const [isLoading, setIsLoading] = useState(false);
  const [validateMessage, setvalidateMessage] = useState({
    errorMessage: '',
  });

  const doSubmit = () => {};
  return (
    <Modal
      // header={intl.formatMessage({ id: 'title__lnurl_pay' })}
      header="LNURL Pay"
      headerDescription="localhost.com"
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
            <Form.Item
              label={intl.formatMessage({ id: 'form__description__optional' })}
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

export { PayRequest };
