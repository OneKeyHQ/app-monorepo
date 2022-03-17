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
  Spinner,
  Token,
  Typography,
} from '@onekeyhq/components';
import { Text } from '@onekeyhq/components/src/Typography';
import { shortenAddress } from '@onekeyhq/components/src/utils';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
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
  gas: string;
  gasPrice: string;
  data: string;
};

const Send = () => {
  const intl = useIntl();
  const navigation = useNavigation<NavigationProps>();

  const { id, scope, origin, ...params } = useDappParams();
  const sendConfirmData =
    (params.data.params as SendConfirmParams[])?.[0] ?? {};
  const { from, to, value, gas, gasPrice } = sendConfirmData;
  const { account, wallet, network } = useActiveWalletAccount();

  const { nativeToken } = useManageTokens();

  const token = {
    logoURI: nativeToken?.logoURI,
    name: nativeToken?.name,
    symbol: nativeToken?.symbol ?? 'ETH',
    decimal: nativeToken?.decimals ?? 18,
    tokenIdOnNetwork: nativeToken?.tokenIdOnNetwork,
  };

  const isInvalidParams = !from || !to || !value;
  const isSameFromAccount = !!account && from.toString() === account?.address;
  const isWatchAccount = !!wallet && wallet.type === 'watching';

  const handleSendConfirm = useCallback(async () => {
    // Required params
    if (isInvalidParams || !account) {
      return;
    }

    const sendParams = {
      id,
      to,
      value,
      account: {
        id: account.id,
        name: account.name,
        address: (account as { address: string }).address,
      },
      network: {
        id: network?.network.id ?? '',
        name: network?.network.name ?? '',
      },
      token: {
        idOnNetwork: token.tokenIdOnNetwork,
        logoURI: token.logoURI,
        name: token.name,
        symbol: token.symbol,
      },
      gasPrice: gasPrice ?? '5',
      gasLimit: gas ?? '21000',
    };

    try {
      const gasLimit = await backgroundApiProxy.engine.prepareTransfer(
        sendParams.network.id,
        sendParams.account.id,
        sendParams.to,
        sendParams.value,
        sendParams.token.idOnNetwork,
      );
      sendParams.gasLimit = gasLimit;
      navigation.navigate(DappSendModalRoutes.SendConfirmAuthModal, sendParams);
    } catch (e) {
      const error = e as { key?: string; message?: string };
      throw new Error(error?.key ?? error?.message ?? 'Unknown error');
    }
  }, [
    account,
    gas,
    gasPrice,
    id,
    isInvalidParams,
    navigation,
    network?.network.id,
    network?.network.name,
    to,
    token.logoURI,
    token.name,
    token.symbol,
    token.tokenIdOnNetwork,
    value,
  ]);

  const content = useMemo(() => {
    if (!wallet || !account) {
      return (
        <Center flex={1}>
          <Spinner size="lg" />
        </Center>
      );
    }

    if (isWatchAccount) {
      return (
        <Empty
          icon={
            <Icon
              name="CloseCircleOutline"
              color="action-critical-default"
              size={64}
            />
          }
          title="Error on sending transaction"
          subTitle="Watch account are not allowed to send transaction"
        />
      );
    }

    if (isInvalidParams) {
      // Validations
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
    const fee = new BigNumber(gas).multipliedBy(gasPrice);
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
          <Token src={token.logoURI} size="56px" />
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
    account,
    from,
    gas,
    gasPrice,
    intl,
    isInvalidParams,
    isSameFromAccount,
    isWatchAccount,
    navigation,
    to,
    token.decimal,
    token.logoURI,
    token.name,
    token.symbol,
    value,
    wallet,
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
        isDisabled: isInvalidParams || !isSameFromAccount || isWatchAccount,
        onPromise: handleSendConfirm,
      }}
      onSecondaryActionPress={useDappApproveAction({ id }).reject}
      scrollViewProps={{
        children: content,
      }}
    />
  );
};

export default Send;
