/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/restrict-template-expressions */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { useCallback, useMemo, useState } from 'react';

import { useNavigation, useRoute } from '@react-navigation/core';
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
  ToastManager,
  useForm,
  useIsVerticalLayout,
} from '@onekeyhq/components';
import type { IEncodedTxLightning } from '@onekeyhq/engine/src/vaults/impl/lightning-network/types';
import type { LNURLPaymentInfo } from '@onekeyhq/engine/src/vaults/impl/lightning-network/types/lnurl';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { FormatCurrencyTokenOfAccount } from '../../../components/Format';
import { useActiveSideAccount, useNativeToken } from '../../../hooks';
import { useSingleToken } from '../../../hooks/useTokens';
import { SendModalRoutes } from '../../Send/enums';

import type { SendRoutesParams } from '../../../routes';
import type { RouteProp } from '@react-navigation/core';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type RouteProps = RouteProp<SendRoutesParams, SendModalRoutes.LNURLPayRequest>;

type NavigationProps = NativeStackNavigationProp<
  SendRoutesParams,
  SendModalRoutes.LNURLPayRequest
>;

type FormValues = {
  amount: string;
  description: string;
  connectTo: string;
  comment: string;
};

const LNURLPayRequest = () => {
  const intl = useIntl();
  const isVerticalLayout = useIsVerticalLayout();
  const navigation = useNavigation<NavigationProps>();
  const route = useRoute<RouteProps>();

  const lnurlDetails = useMemo(
    () => pick(route.params, 'lnurlDetails').lnurlDetails,
    [route.params],
  );
  const transferInfo = useMemo(
    () => omit({ ...route.params }, ['lnurlDetails']),
    [route.params],
  );

  const { account, accountId, networkId, network } =
    useActiveSideAccount(transferInfo);
  const { control, handleSubmit, watch } = useForm<FormValues>();

  const amountValue = watch('amount');
  const amountMin = Math.floor(+lnurlDetails.minSendable / 1000);
  const amountMax = Math.floor(+lnurlDetails.maxSendable / 1000);

  const [isLoading, setIsLoading] = useState(false);
  const nativeToken = useNativeToken(networkId);
  const { token: tokenInfo } = useSingleToken(
    networkId,
    transferInfo.token ?? '',
  );

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
        betweeen {amountMin} and {amountMax} sats
      </Text>
    ),
    [amountMin, amountMax],
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
                    {content}
                  </Text>
                </Box>
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
  }, [control, intl, lnurlDetails.metadata]);

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

  const onSubmit = useCallback(
    async (values: FormValues) => {
      console.log('=====>onSubmit');
      if (!lnurlDetails) return;
      if (isLoading) return;
      setIsLoading(true);
      const { serviceLightningNetwork, engine } = backgroundApiProxy;

      let response: LNURLPaymentInfo;
      const amount = parseInt(values.amount) * 1000; // convert to milliSatoshi
      try {
        const params: {
          amount: number;
          comment?: string;
        } = {
          amount,
          comment: values.comment && values.comment,
        };
        response = await serviceLightningNetwork.fetchLnurlPayRequestResult({
          callback: lnurlDetails.callback,
          params,
        });
      } catch (e) {
        console.error(e);
        ToastManager.show(
          { title: e instanceof Error ? e.message : e },
          { type: 'error' },
        );
        setIsLoading(false);
        return;
      }

      try {
        const paymentRequest = response.pr;
        const isValidInvoice = await serviceLightningNetwork.verifyInvoice({
          paymentInfo: response,
          metadata: lnurlDetails.metadata,
          amount,
          networkId,
          accountId,
        });
        if (!isValidInvoice) {
          ToastManager.show({
            title: intl.formatMessage({
              id: 'msg__invalid_lightning_payment_request',
            }),
          });
        }

        const encodedTx = await engine.buildEncodedTxFromTransfer({
          networkId,
          accountId,
          transferInfo: {
            ...transferInfo,
            to: paymentRequest,
            lnurlPaymentInfo: response,
          },
        });
        navigation.replace(SendModalRoutes.SendConfirm, {
          accountId,
          networkId,
          encodedTx,
          feeInfoUseFeeInTx: false,
          feeInfoEditable: true,
          backRouteName: SendModalRoutes.PreSendAddress,
          // @ts-expect-error
          payload: {
            payloadType: 'Transfer',
            account,
            network,
            token: {
              ...tokenInfo,
              sendAddress: transferInfo.tokenSendAddress,
              idOnNetwork: tokenInfo?.tokenIdOnNetwork ?? '',
            },
            to: paymentRequest,
            value: (encodedTx as IEncodedTxLightning).amount,
            isMax: false,
          },
        });
      } catch (e) {
        console.error(e);
        ToastManager.show(
          { title: e instanceof Error ? e.message : e },
          { type: 'error' },
        );
        setIsLoading(false);
      }
      // pay request
    },
    [
      network,
      networkId,
      account,
      accountId,
      intl,
      isLoading,
      lnurlDetails,
      transferInfo,
      navigation,
      tokenInfo,
    ],
  );

  const doSubmit = handleSubmit(onSubmit);

  return (
    <Modal
      header={intl.formatMessage({ id: 'title__lnurl_pay' })}
      headerDescription={lnurlDetails.domain}
      primaryActionTranslationId="action__next"
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
              label={intl.formatMessage({ id: 'form__connect_to' })}
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

export { LNURLPayRequest };
