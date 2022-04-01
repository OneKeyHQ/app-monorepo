import React, { useCallback, useEffect } from 'react';

import {
  NavigationProp,
  RouteProp,
  useNavigation,
  useRoute,
} from '@react-navigation/native';
import BigNumber from 'bignumber.js';
import { Column, Row } from 'native-base';
import { useIntl } from 'react-intl';

import {
  Box,
  Center,
  Divider,
  Modal,
  Spinner,
  Text,
  Token,
  Typography,
  useThemeValue,
  utils,
} from '@onekeyhq/components';
import { IEncodedTxEvm } from '@onekeyhq/engine/src/vaults/impl/evm/Vault';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import {
  SendRoutes,
  SendRoutesParams,
  TransferSendParamsPayload,
} from './types';
import { useFeeInfoPayload } from './useFeeInfoPayload';

type NavigationProps = NavigationProp<SendRoutesParams, SendRoutes.SendConfirm>;
type RouteProps = RouteProp<SendRoutesParams, SendRoutes.SendConfirm>;

const renderTitleDetailView = (title: string, detail: string | any) => (
  <Row justifyContent="space-between" space="16px" padding="16px">
    <Text
      color="text-subdued"
      typography={{ sm: 'Body1Strong', md: 'Body2Strong' }}
    >
      {title}
    </Text>
    {typeof detail === 'string' ? (
      <Text
        textAlign="right"
        typography={{ sm: 'Body1Strong', md: 'Body2Strong' }}
        flex={1}
        numberOfLines={1}
      >
        {detail}
      </Text>
    ) : (
      detail
    )}
  </Row>
);

const TransactionConfirm = () => {
  const cardBgColor = useThemeValue('surface-default');
  const intl = useIntl();
  const navigation = useNavigation<NavigationProps>();
  const route = useRoute<RouteProps>();
  const { params } = route;
  // TODO multi-chain encodedTx
  const encodedTx = params.encodedTx as IEncodedTxEvm;
  const payload = params.payload as TransferSendParamsPayload;
  const isTransferNativeToken = !payload?.token?.idOnNetwork;

  const { feeInfoPayload, loading } = useFeeInfoPayload({
    encodedTx,
    useFeeInTx: true,
  });

  useEffect(() => {
    debugLogger.sendTx(
      'SendConfirm  >>>>  ',
      feeInfoPayload,
      encodedTx,
      params,
    );
  }, [encodedTx, feeInfoPayload, params]);

  const handleNavigation = useCallback(
    () =>
      Promise.resolve(
        navigation.navigate(SendRoutes.SendAuthentication, {
          ...params,
          accountId: payload.account.id,
          networkId: payload.network.id,
        }),
      ),
    [navigation, params, payload.account.id, payload.network.id],
  );

  const totalTransfer = isTransferNativeToken
    ? new BigNumber(payload.value)
        .plus(feeInfoPayload?.current?.totalNative as string)
        .toFixed()
    : false;

  return (
    <Modal
      height="598px"
      primaryActionTranslationId="action__confirm"
      secondaryActionTranslationId="action__reject"
      header={intl.formatMessage({ id: 'transaction__transaction_confirm' })}
      headerDescription={`${intl.formatMessage({
        id: 'content__to',
      })}:${utils.shortenAddress(encodedTx.to)}`}
      primaryActionProps={{
        onPromise: handleNavigation,
      }}
      scrollViewProps={{
        children: (
          <Column flex="1">
            <Center>
              <Token src={payload.token.logoURI} size="56px" />
              <Typography.Heading mt="8px">
                {`${payload.token.symbol}(${payload.token.name})`}
              </Typography.Heading>
            </Center>
            <Column bg={cardBgColor} borderRadius="12px" mt="24px">
              {/* From */}
              <Row justifyContent="space-between" space="16px" padding="16px">
                <Text
                  color="text-subdued"
                  typography={{ sm: 'Body1Strong', md: 'Body2Strong' }}
                >
                  {intl.formatMessage({ id: 'content__from' })}
                </Text>
                <Column alignItems="flex-end" w="auto" flex={1}>
                  <Text typography={{ sm: 'Body1Strong', md: 'Body2Strong' }}>
                    {payload.account.name}
                  </Text>
                  <Typography.Body2
                    textAlign="right"
                    color="text-subdued"
                    numberOfLines={3}
                  >
                    {payload.account.address}
                  </Typography.Body2>
                </Column>
              </Row>
              <Divider />
              {/* To */}
              <Row justifyContent="space-between" space="16px" padding="16px">
                <Text
                  color="text-subdued"
                  typography={{ sm: 'Body1Strong', md: 'Body2Strong' }}
                >
                  {intl.formatMessage({ id: 'content__to' })}
                </Text>
                <Text
                  textAlign="right"
                  typography={{ sm: 'Body1Strong', md: 'Body2Strong' }}
                  flex={1}
                  noOfLines={3}
                >
                  {payload.to}
                </Text>
              </Row>
            </Column>
            <Box>
              <Typography.Subheading mt="24px" color="text-subdued">
                {intl.formatMessage({ id: 'transaction__transaction_details' })}
              </Typography.Subheading>
            </Box>

            <Column bg={cardBgColor} borderRadius="12px" mt="2">
              {renderTitleDetailView(
                intl.formatMessage({ id: 'content__amount' }),
                `${payload.value} ${payload.token.symbol}`,
              )}
              <Divider />
              {renderTitleDetailView(
                `${intl.formatMessage({
                  id: 'content__fee',
                })}(${intl.formatMessage({ id: 'content__estimated' })})`,
                loading ? (
                  <Spinner />
                ) : (
                  `${feeInfoPayload?.current?.totalNative || ''} ${
                    feeInfoPayload?.info?.nativeSymbol || ''
                  }`
                ),
              )}
              <Divider />
              {totalTransfer &&
                renderTitleDetailView(
                  `${intl.formatMessage({
                    id: 'content__total',
                  })}(${intl.formatMessage({
                    id: 'content__amount',
                  })} + ${intl.formatMessage({ id: 'content__fee' })})`,
                  loading ? (
                    <Spinner />
                  ) : (
                    `${totalTransfer} ${
                      feeInfoPayload?.info?.nativeSymbol || ''
                    }`
                  ),
                )}
            </Column>
          </Column>
        ),
      }}
    />
  );
};

export default TransactionConfirm;
