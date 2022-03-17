import React, { useCallback } from 'react';

import {
  NavigationProp,
  RouteProp,
  useNavigation,
  useRoute,
} from '@react-navigation/native';
import { Column, Row } from 'native-base';
import { useIntl } from 'react-intl';

import {
  Box,
  Center,
  Divider,
  Modal,
  Text,
  Token,
  Typography,
  useThemeValue,
  utils,
} from '@onekeyhq/components';

import { SendRoutes, SendRoutesParams } from './types';

type NavigationProps = NavigationProp<
  SendRoutesParams,
  SendRoutes.SendAuthentication
>;
type RouteProps = RouteProp<SendRoutesParams, SendRoutes.SendConfirm>;

const renderTitleDetailView = (title: string, detail: string) => (
  <Row justifyContent="space-between" space="16px" padding="16px">
    <Text
      color="text-subdued"
      typography={{ sm: 'Body1Strong', md: 'Body2Strong' }}
    >
      {title}
    </Text>
    <Text
      textAlign="right"
      typography={{ sm: 'Body1Strong', md: 'Body2Strong' }}
      flex={1}
      numberOfLines={1}
    >
      {detail}
    </Text>
  </Row>
);

const TransactionConfirm = () => {
  const cardBgColor = useThemeValue('surface-default');
  const intl = useIntl();
  const navigation = useNavigation<NavigationProps>();
  const route = useRoute<RouteProps>();
  const { params } = route;

  const handleNavigation = useCallback(
    () =>
      Promise.resolve(
        navigation.navigate(SendRoutes.SendAuthentication, params),
      ),
    [navigation, params],
  );

  return (
    <Modal
      primaryActionTranslationId="action__confirm"
      secondaryActionTranslationId="action__reject"
      onClose={() => {
        navigation.getParent()?.goBack();
      }}
      header={intl.formatMessage({ id: 'transaction__transaction_confirm' })}
      headerDescription={`${intl.formatMessage({
        id: 'content__to',
      })}:${utils.shortenAddress(params.to)}`}
      primaryActionProps={{
        onPromise: handleNavigation,
      }}
      scrollViewProps={{
        children: (
          <Column flex="1">
            <Center>
              <Token src={params.token.logoURI} size="56px" />
              <Typography.Heading mt="8px">
                {`${params.token.symbol}(${params.token.name})`}
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
                    {params.account.name}
                  </Text>
                  <Typography.Body2
                    textAlign="right"
                    color="text-subdued"
                    numberOfLines={3}
                  >
                    {params.account.address}
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
                  {params.to}
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
                params.value,
              )}
              <Divider />
              {renderTitleDetailView(
                `${intl.formatMessage({
                  id: 'content__fee',
                })}(${intl.formatMessage({ id: 'content__estimated' })})`,
                params.gasPrice,
              )}
              <Divider />
              {renderTitleDetailView(
                `${intl.formatMessage({
                  id: 'content__total',
                })}(${intl.formatMessage({
                  id: 'content__amount',
                })} + ${intl.formatMessage({ id: 'content__fee' })})`,
                '21000',
              )}
            </Column>
          </Column>
        ),
      }}
    />
  );
};

export default TransactionConfirm;
