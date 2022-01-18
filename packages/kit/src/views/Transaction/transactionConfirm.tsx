import { useNavigation } from '@react-navigation/core';
import { Column, Row } from 'native-base';
import { useIntl } from 'react-intl';

import {
  Box,
  Center,
  Divider,
  Modal,
  Token,
  Typography,
  useThemeValue,
  utils,
} from '@onekeyhq/components';
import { Text } from '@onekeyhq/components/src/Typography';

const MockData = {
  token: {
    name: 'ETH',
    chain: 'Ethereum',
    url: '',
  },
  fromAddress: '0x4d16878c270x4d16878c270x4',
  toAddress: '0x4d16878c270x4d16878c270x40x4d16878c270x4d16878c270x4',
  detail: {
    amount: '1.0532145',
    token: 'ETH',
    fee: '20000',
    total: '21,000 (100%)',
  },
};

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
  const navigation = useNavigation();

  return (
    <Modal
      primaryActionTranslationId={intl.formatMessage({ id: 'action__confirm' })}
      secondaryActionTranslationId={intl.formatMessage({
        id: 'action__reject',
      })}
      onClose={() => {
        navigation.getParent()?.goBack();
      }}
      header={intl.formatMessage({ id: 'transaction__transaction_confirm' })}
      headerDescription={`To:${utils.shortenAddress(MockData.toAddress)}`}
      scrollViewProps={{
        children: (
          <Column flex="1">
            <Center>
              <Token chain={MockData.token.chain} size="56px" />
              <Typography.Heading mt="8px">
                {`${MockData.token.name}(${MockData.token.chain})`}
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
                    ETH #1
                  </Text>
                  <Typography.Body2 textAlign="right" color="text-subdued">
                    {MockData.fromAddress}
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
                  {MockData.toAddress}
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
                MockData.detail.amount,
              )}
              <Divider />
              {renderTitleDetailView(
                `${intl.formatMessage({
                  id: 'content__fee',
                })}(${intl.formatMessage({ id: 'content__estimated' })})`,
                MockData.detail.fee,
              )}
              <Divider />
              {renderTitleDetailView(
                `${intl.formatMessage({
                  id: 'content__total',
                })}(${intl.formatMessage({
                  id: 'content__amount',
                })} + ${intl.formatMessage({ id: 'content__fee' })})`,
                MockData.detail.total,
              )}
            </Column>
          </Column>
        ),
      }}
    />
  );
};

export default TransactionConfirm;
