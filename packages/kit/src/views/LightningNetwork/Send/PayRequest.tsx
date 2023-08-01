/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/restrict-template-expressions */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { useCallback, useEffect, useMemo, useState } from 'react';

import { useRoute } from '@react-navigation/core';
import BigNumber from 'bignumber.js';
import { omit, pick } from 'lodash';
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

import { FormatCurrencyTokenOfAccount } from '../../../components/Format';
import { useActiveSideAccount, useNativeToken } from '../../../hooks';

import type { SendRoutesParams } from '../../../routes';
import type { SendModalRoutes } from '../../Send/enums';
import type { RouteProp } from '@react-navigation/core';

type RouteProps = RouteProp<SendRoutesParams, SendModalRoutes.LNPayRequest>;

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
  const lnurlDetails = useMemo(
    () => pick(route.params, 'lnurlDetails').lnurlDetails,
    [route.params],
  );
  const transferInfo = useMemo(
    () => omit({ ...route.params }, ['lnurlDetails']),
    [route.params],
  );
  console.log('===>lnurlDetails: ', lnurlDetails);
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

  const siteImage = useMemo(() => {
    if (!lnurlDetails?.metadata) return;

    try {
      const metadata = JSON.parse(lnurlDetails.metadata);
      const image = metadata.find(
        ([type]: [string]) =>
          type === 'image/png;base64' || type === 'image/jpeg;base64',
      );

      if (image) return `data:${image[0]},${image[1]}`;
    } catch (e) {
      console.error(e);
    }
  }, [lnurlDetails?.metadata]);

  const renderLabelAddon = useMemo(
    () => (
      <Text typography="Body2Strong" color="text-subdued">
        betweeen {lnurlDetails.minSendable} and {lnurlDetails.maxSendable} sats
      </Text>
    ),
    [lnurlDetails],
  );

  const renderMetadataText = useMemo(() => {
    try {
      const metadata = JSON.parse(lnurlDetails.metadata);
      return metadata
        .map(([type, content]: [string, string]) => {
          if (type === 'text/plain' || type === 'text/long-desc') {
            return (
              <Form.Item
                label={intl.formatMessage({ id: 'form__payment_description' })}
                name="description"
                control={control}
                formControlProps={{ width: 'full' }}
                key={content}
              >
                <Form.Input
                  size={isVerticalLayout ? 'xl' : 'default'}
                  defaultValue={content}
                  isReadOnly
                  color="text-subdued"
                />
              </Form.Item>
            );
          }
          return undefined;
        })
        .filter(Boolean);
    } catch (e) {
      console.error(e);
    }
    return [];
  }, [control, intl, isVerticalLayout, lnurlDetails.metadata]);

  const commentAllowedLength = useMemo(() => {
    if (
      lnurlDetails &&
      typeof lnurlDetails.commentAllowed === 'number' &&
      lnurlDetails.commentAllowed > 0
    ) {
      return lnurlDetails.commentAllowed;
    }
    return 0;
  }, [lnurlDetails]);

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
                {siteImage && (
                  <Image
                    borderRadius="full"
                    resizeMethod="auto"
                    resizeMode="contain"
                    width={8}
                    height={8}
                    source={{ uri: siteImage }}
                  />
                )}
                <Text
                  ml={siteImage ? 3 : 0}
                  typography="Body2Mono"
                  color="text-subdued"
                  lineHeight="1.5em"
                >
                  {lnurlDetails.domain}
                </Text>
              </Box>
            </Form.Item>
            {renderMetadataText}
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
            {commentAllowedLength > 0 && (
              <Form.Item
                label={intl.formatMessage({ id: 'form__comment_optional' })}
                control={control}
                name="comment"
                formControlProps={{ width: 'full' }}
                rules={{
                  maxLength: {
                    value: commentAllowedLength,
                    message: intl.formatMessage(
                      { id: 'msg_description_can_be_up_to_int_characters' },
                      { 0: commentAllowedLength },
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
            )}
          </Form>
        ),
      }}
    />
  );
};

export { PayRequest };
