import React, { useMemo } from 'react';

import { useNavigation } from '@react-navigation/core';
import { Column } from 'native-base';
import { useIntl } from 'react-intl';

import {
  Box,
  Center,
  Modal,
  Text,
  Token,
  Typography,
} from '@onekeyhq/components';
import { TtransactionTypes } from '@onekeyhq/engine/src/managers/transaction';

import { Transaction } from '../../background/providers/ProviderApiEthereum';
import useDappParams from '../../hooks/useDappParams';
import {
  DappContractCallModalRoutes,
  DappMulticallRoutesParams,
} from '../../routes';

import { DescriptionList, DescriptionListItem } from './DescriptionList';
// import RugConfirmDialog from './RugConfirmDialog';

import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type NavigationProps = NativeStackNavigationProp<
  DappMulticallRoutesParams,
  DappContractCallModalRoutes.ContractCallModal
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

type ContractTransaction = Transaction & {
  type: TtransactionTypes;
  contractCode?: string;
};

const ContractCall = () => {
  // const [rugConfirmDialogVisible, setRugConfirmDialogVisible] = useState(false);
  const intl = useIntl();
  const navigation = useNavigation<NavigationProps>();

  const { id, origin, ...dappParams } = useDappParams<ContractTransaction>();

  const requestData =
    (dappParams.data.params as [ContractTransaction])?.[0] ?? {};
  const computedTotal = `${MockData.detail.amount + MockData.detail.fee} ${
    MockData.detail.token
  }`;

  const header = useMemo(() => {
    switch (requestData.type) {
      // TODO: add more transaction header string
      // case TRANSACTION_TYPES.DEPLOY_CONTRACT:
      //   return intl.formatMessage({ id: 'transaction__deployment' });
      default:
        return intl.formatMessage({ id: 'transaction__contract_interaction' });
    }
  }, [intl, requestData.type]);

  // TODO: Return default no parsable error screen
  if (!requestData) {
    return null;
  }

  return (
    <>
      <Modal
        height="640px"
        primaryActionTranslationId="action__confirm"
        secondaryActionTranslationId="action__reject"
        header={header}
        onSecondaryActionPress={() => {
          if (navigation.canGoBack()) {
            navigation.goBack();
          }
        }}
        onPrimaryActionPress={({ onClose }) => onClose?.()}
        scrollViewProps={{
          children: (
            // Add padding to escape the footer
            <Column flex="1" pb="6" space={6}>
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
                <DescriptionListItem
                  title={intl.formatMessage({ id: 'content__amount' })}
                  detail={`${MockData.detail.amount} ${MockData.detail.token}`}
                />
                {/* Interact target */}
                <DescriptionListItem
                  title={intl.formatMessage({
                    id: 'content__interact_with',
                  })}
                  detail={MockData.target}
                />
              </DescriptionList>

              {/* Transaction details */}
              <Column space={2}>
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
                      navigation.navigate(
                        DappContractCallModalRoutes.EditFeeModal,
                      );
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

              <Column space={2}>
                {/* More Details */}
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
                    editable
                    onPress={() => {
                      navigation.navigate(
                        DappContractCallModalRoutes.ContractDataModal,
                        { contractData: MockData.contractData },
                      );
                    }}
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

export default ContractCall;
