import React from 'react';

import { useNavigation } from '@react-navigation/core';
import { Column, Row } from 'native-base';
import { useIntl } from 'react-intl';

import { Box, Center, Modal, Token, Typography } from '@onekeyhq/components';
import { Text } from '@onekeyhq/components/src/Typography';

import {
  DappSendModalRoutes,
  DappSendRoutesParams,
} from '../../routes/Modal/DappSend';

import { DescriptionList, DescriptionListItem } from './DescriptionList';

import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type NavigationProps = NativeStackNavigationProp<
  DappSendRoutesParams,
  DappSendModalRoutes.SendConfirmModal
>;

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
  },
};

const Send = () => {
  const intl = useIntl();
  const navigation = useNavigation<NavigationProps>();

  return (
    <Modal
      primaryActionTranslationId="action__confirm"
      secondaryActionTranslationId="action__reject"
      header={intl.formatMessage({ id: 'transaction__transaction_confirm' })}
      onSecondaryActionPress={() => {
        if (navigation.canGoBack()) {
          navigation.goBack();
        }
      }}
      scrollViewProps={{
        children: (
          <Column flex="1" space={6}>
            <Center>
              <Token chain={MockData.token.chain} size="56px" />
              <Typography.Heading mt="8px">
                {`${MockData.token.name}(${MockData.token.chain})`}
              </Typography.Heading>
            </Center>

            <DescriptionList>
              {/* From */}
              <DescriptionListItem
                title={intl.formatMessage({ id: 'content__from' })}
                detail={
                  <Column alignItems="flex-end" w="auto" flex={1}>
                    <Text typography={{ sm: 'Body1Strong', md: 'Body2Strong' }}>
                      ETH #1
                    </Text>
                    <Typography.Body2 textAlign="right" color="text-subdued">
                      {MockData.fromAddress}
                    </Typography.Body2>
                  </Column>
                }
              />
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
            </DescriptionList>

            <Column space={2}>
              <Box>
                <Typography.Subheading color="text-subdued">
                  {intl.formatMessage({
                    id: 'transaction__transaction_details',
                  })}
                </Typography.Subheading>
              </Box>

              <DescriptionList>
                <DescriptionListItem
                  title={intl.formatMessage({ id: 'content__amount' })}
                  detail={MockData.detail.amount}
                />
                <DescriptionListItem
                  editable
                  title={`${intl.formatMessage({
                    id: 'content__fee',
                  })}(${intl.formatMessage({ id: 'content__estimated' })})`}
                  detail={MockData.detail.fee}
                  onPress={() => {
                    navigation.navigate(DappSendModalRoutes.EditFeeModal);
                  }}
                />
                <DescriptionListItem
                  title={`${intl.formatMessage({
                    id: 'content__total',
                  })}(${intl.formatMessage({
                    id: 'content__amount',
                  })} + ${intl.formatMessage({ id: 'content__fee' })})`}
                  detail={MockData.detail.amount + MockData.detail.fee}
                />
              </DescriptionList>
            </Column>
          </Column>
        ),
      }}
    />
  );
};

export default Send;
