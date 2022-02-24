import React, { useState } from 'react';

import { RouteProp, useNavigation, useRoute } from '@react-navigation/core';
import { Column } from 'native-base';
import { useIntl } from 'react-intl';

import { Box, Center, Modal, Token, Typography } from '@onekeyhq/components';
import { Text } from '@onekeyhq/components/src/Typography';

import {
  DappApproveModalRoutes,
  DappApproveRoutesParams,
} from '../../routes/Modal/DappApprove';

import { DescriptionList, DescriptionListItem } from './DescriptionList';
import RugConfirmDialog from './RugConfirmDialog';

import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type RouteProps = RouteProp<
  DappApproveRoutesParams,
  DappApproveModalRoutes.ApproveModal
>;

type NavigationProps = NativeStackNavigationProp<
  DappApproveRoutesParams,
  DappApproveModalRoutes.ApproveModal
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
  spendLimit: (2 ** 256 - 1).toString(),
  target: 'app.uniswap.org',
  contractData: `Parameters:
  [
    {
      "type": "address"
    },
    {
      "type": "address"
    },
    {
      "type": "uint256"
    },
    {
      "type": "uint256"
    },
    {
      "type": "uint32"
    },
    {
      "type": "bytes"
    },
    {
      "type": "[]"
    }
  ]`,
};

const isRug = (target: string) => {
  const RUG_LIST = ['app.uniswap.org'];
  return RUG_LIST.some((item) => item.includes(target.toLowerCase()));
};

const UINT_64 = 2 ** 64 - 1;

const Approve = () => {
  const [rugConfirmDialogVisible, setRugConfirmDialogVisible] = useState(false);
  const intl = useIntl();
  const route = useRoute<RouteProps>();
  const navigation = useNavigation<NavigationProps>();

  const computedTotal = `${MockData.detail.amount + MockData.detail.fee} ${
    MockData.detail.token
  }`;
  const computedIsRug = isRug(MockData.target);

  const spendLimit = Number(
    route.params?.spendLimit ?? MockData.spendLimit.replace(/,/g, ''),
  );

  // less than
  const spendText =
    spendLimit < UINT_64
      ? `${spendLimit} ${MockData.detail.token}`
      : intl.formatMessage({ id: 'form__unlimited' });

  return (
    <>
      {/* Rug warning Confirm Dialog */}
      <RugConfirmDialog
        visible={rugConfirmDialogVisible}
        onCancel={() => setRugConfirmDialogVisible(false)}
        onConfirm={() => {
          // Do something
        }}
      />
      {/* Main Modal */}
      <Modal
        height="640px"
        primaryActionTranslationId="action__confirm"
        secondaryActionTranslationId="action__reject"
        header={intl.formatMessage({ id: 'title__approve' })}
        onPrimaryActionPress={({ onClose }) => {
          if (!computedIsRug) {
            // Do approve operation
            return onClose?.();
          }
          // Do confirm before approve
          setRugConfirmDialogVisible(true);
        }}
        onSecondaryActionPress={() => {
          if (navigation.canGoBack()) {
            navigation.goBack();
          }
        }}
        scrollViewProps={{
          children: (
            // Add padding to escape the footer
            <Column flex="1" pb="20" space={6}>
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
                      <Text
                        typography={{ sm: 'Body1Strong', md: 'Body2Strong' }}
                      >
                        ETH #1
                      </Text>
                      <Typography.Body2 textAlign="right" color="text-subdued">
                        {MockData.fromAddress}
                      </Typography.Body2>
                    </Column>
                  }
                />
                {/* To */}
                <DescriptionListItem
                  title={intl.formatMessage({ id: 'content__to' })}
                  detail={MockData.toAddress}
                />
                {/* Spend limit */}
                <DescriptionListItem
                  title={intl.formatMessage({
                    id: 'content__spend_limit_amount',
                  })}
                  detail={spendText}
                  onPress={() => {
                    navigation.navigate(DappApproveModalRoutes.SpendLimitModal);
                  }}
                  editable
                />
                {/* Interact target */}
                <DescriptionListItem
                  title={intl.formatMessage({
                    id: 'content__interact_with',
                  })}
                  detail={MockData.target}
                  isRug={computedIsRug}
                />
              </DescriptionList>

              <Column space={2}>
                {/* Transaction details */}
                <Box>
                  <Typography.Subheading mt="24px" color="text-subdued">
                    {intl.formatMessage({
                      id: 'transaction__transaction_details',
                    })}
                  </Typography.Subheading>
                </Box>

                <DescriptionList>
                  <DescriptionListItem
                    editable
                    title={`${intl.formatMessage({
                      id: 'content__fee',
                    })}(${intl.formatMessage({ id: 'content__estimated' })})`}
                    detail={MockData.detail.fee}
                    onPress={() => {
                      navigation.navigate(DappApproveModalRoutes.EditFeeModal);
                    }}
                  />
                  <DescriptionListItem
                    title={`${intl.formatMessage({
                      id: 'content__total',
                    })}(${intl.formatMessage({
                      id: 'content__amount',
                    })} + ${intl.formatMessage({ id: 'content__fee' })})`}
                    detail={computedTotal}
                  />
                </DescriptionList>
              </Column>

              {/* More Details */}
              <Column space={2}>
                <Box>
                  <Typography.Subheading mt="24px" color="text-subdued">
                    {intl.formatMessage({ id: 'content__more_details' })}
                  </Typography.Subheading>
                </Box>
                <DescriptionList>
                  <DescriptionListItem
                    title={intl.formatMessage({ id: 'form__contract_data' })}
                    detail={MockData.contractData}
                    detailNumberOfLines={6}
                    onPress={() => {
                      navigation.navigate(
                        DappApproveModalRoutes.ContractDataModal,
                        { contractData: MockData.contractData },
                      );
                    }}
                    editable
                  />
                </DescriptionList>
              </Column>
            </Column>
          ),
        }}
      />
    </>
  );
};

export default Approve;
