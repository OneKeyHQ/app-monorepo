import React, { useCallback, useMemo } from 'react';

import { useNavigation } from '@react-navigation/core';
import BigNumber from 'bignumber.js';
import { Column, Row } from 'native-base';
import { useIntl } from 'react-intl';

import {
  Box,
  Center,
  Empty,
  Icon,
  Modal,
  Token,
  Typography,
} from '@onekeyhq/components';
import { Text } from '@onekeyhq/components/src/Typography';
import { shortenAddress } from '@onekeyhq/components/src/utils';
import { SimpleAccount } from '@onekeyhq/engine/src/types/account';

import { FormatBalance } from '../../components/Format';
import { useActiveWalletAccount } from '../../hooks/redux';
import useDappApproveAction from '../../hooks/useDappApproveAction';
import useDappParams from '../../hooks/useDappParams';
import { useManageTokens } from '../../hooks/useManageTokens';
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

type SendConfirmParams = {
  from: string;
  to: string;
  value: string;
  gasLimit: string;
  gasPrice: string;
  data: string;
};

const Send = () => {
  const intl = useIntl();
  const navigation = useNavigation<NavigationProps>();

  const { id, scope, origin, ...params } = useDappParams();
  const sendConfirmData =
    (params.data.params as SendConfirmParams[])?.[0] ?? {};
  const { from, to, value, gasLimit, gasPrice } = sendConfirmData;
  const { account } = useActiveWalletAccount();
  const { nativeToken } = useManageTokens();

  const getResolveData = useCallback(() => {
    // fake hash
    const transactionHash =
      '0xf9b3000d2e6630b1b9935505b1baf03900790b4e59278dc3e621b77604489f91';
    // data format may be different in different chain
    if (scope === 'ethereum') {
      return transactionHash;
    }
    if (scope === 'near') {
      return transactionHash;
    }
    if (scope === 'solana') {
      return transactionHash;
    }
    return transactionHash;
  }, [scope]);

  const dappApprove = useDappApproveAction({
    id,
    getResolveData,
  });

  const token = {
    logoUrl: nativeToken?.logoURI,
    name: nativeToken?.name,
    symbol: nativeToken?.symbol ?? 'ETH',
    decimal: nativeToken?.decimals ?? 18,
  };

  const isInvalidParams = !from || !to || !value;
  const isSameFromAccount =
    from.toString() === (account as SimpleAccount)?.address;

  const content = useMemo(() => {
    // Validations
    if (isInvalidParams) {
      return (
        <Empty
          icon={
            <Icon
              name="CloseCircleOutline"
              color="action-critical-default"
              size={64}
            />
          }
          title="Error"
          subTitle="Invalid transaction parameters!"
        />
      );
    }

    if (!isSameFromAccount) {
      // do something when inconsistent active address happens
      return (
        <Empty
          icon={
            <Icon
              name="CloseCircleOutline"
              color="action-critical-default"
              size={64}
            />
          }
          title="Error"
          subTitle="Internal error, unsafe action!"
        />
      );
    }

    const amount = new BigNumber(value);
    const amountNode = (
      <FormatBalance
        balance={amount}
        suffix={token.symbol}
        formatOptions={{ unit: token.decimal }}
      />
    );
    const fee = new BigNumber(gasLimit).multipliedBy(gasPrice);
    const feeNode = (
      <FormatBalance
        balance={fee}
        suffix={token.symbol}
        formatOptions={{ unit: token.decimal }}
      />
    );
    const totalNode = (
      <FormatBalance
        balance={amount.plus(fee)}
        suffix={token.symbol}
        formatOptions={{ unit: token.decimal }}
      />
    );

    return (
      <Column flex="1" space={6}>
        <Center>
          <Token src={token.logoUrl} size="56px" />
          <Typography.Heading mt="8px">
            {token.symbol}&nbsp;
            {!!token.name && `(${token.name})`}
          </Typography.Heading>
        </Center>

        <DescriptionList>
          {/* From */}
          <DescriptionListItem
            title={intl.formatMessage({ id: 'content__from' })}
            detail={
              <Column alignItems="flex-end" w="auto" flex={1}>
                <Text typography={{ sm: 'Body1Strong', md: 'Body2Strong' }}>
                  {account?.name}
                </Text>
                <Typography.Body2
                  textAlign="right"
                  color="text-subdued"
                  numberOfLines={2}
                >
                  {from}
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
              {to}
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
              detail={amountNode}
            />
            <DescriptionListItem
              editable
              title={`${intl.formatMessage({
                id: 'content__fee',
              })}(${intl.formatMessage({ id: 'content__estimated' })})`}
              detail={feeNode}
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
              detail={totalNode}
            />
          </DescriptionList>
        </Column>
      </Column>
    );
  }, [
    account?.name,
    from,
    gasLimit,
    gasPrice,
    intl,
    isInvalidParams,
    isSameFromAccount,
    navigation,
    to,
    token.decimal,
    token.logoUrl,
    token.name,
    token.symbol,
    value,
  ]);

  return (
    <Modal
      header={intl.formatMessage({ id: 'transaction__transaction_confirm' })}
      headerDescription={`${intl.formatMessage({
        id: 'content__to',
      })}: ${shortenAddress(to)}`}
      primaryActionTranslationId="action__confirm"
      secondaryActionTranslationId="action__reject"
      primaryActionProps={{
        isDisabled: isInvalidParams || !isSameFromAccount,
      }}
      onPrimaryActionPress={({ close }) => {
        dappApprove.resolve({ close });
      }}
      onSecondaryActionPress={dappApprove.reject}
      scrollViewProps={{
        children: content,
      }}
    />
  );
};

export default Send;
