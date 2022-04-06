import React, { useCallback, useMemo, useState } from 'react';

import { UnsignedTransaction, serialize } from '@ethersproject/transactions';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/core';
import BigNumber from 'bignumber.js';
import { Column } from 'native-base';
import { useIntl } from 'react-intl';

import { Box, Center, Modal, Token, Typography } from '@onekeyhq/components';
import { Text } from '@onekeyhq/components/src/Typography';
import { SEPERATOR } from '@onekeyhq/engine/src/constants';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { Transaction } from '../../background/providers/ProviderApiEthereum';
import { FormatBalance } from '../../components/Format';
import { useActiveWalletAccount } from '../../hooks/redux';
import useDappApproveAction from '../../hooks/useDappApproveAction';
import useDappParams from '../../hooks/useDappParams';
import { useManageTokens } from '../../hooks/useManageTokens';
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

const isRug = (target?: string) => {
  const RUG_LIST: string[] = [];
  return RUG_LIST.some((item) => item.includes(target?.toLowerCase() ?? ''));
};

const UINT_64 = 2 ** 64 - 1;

const Approve = () => {
  const [rugConfirmDialogVisible, setRugConfirmDialogVisible] = useState(false);
  const intl = useIntl();
  const route = useRoute<RouteProps>();
  const navigation = useNavigation<NavigationProps>();

  const { id, origin, ...dappParams } = useDappParams<Transaction>();
  const approvalTransaction = useMemo(
    () => (dappParams.data.params as [Transaction])?.[0] ?? {},
    [dappParams.data.params],
  );
  const {
    from,
    to,
    gas: gasLimit = '21000',
    gasPrice,
    data,
  } = approvalTransaction;
  const computedIsRug = isRug(origin);

  // parsed from data
  const parsedData = data;
  const { account, networkId } = useActiveWalletAccount();
  // Should be parse from data, we use native to mock here
  const { nativeToken } = useManageTokens();
  const token = useMemo(
    () => ({
      logoUrl: nativeToken?.logoURI,
      name: nativeToken?.name,
      symbol: nativeToken?.symbol ?? 'ETH',
      decimal: nativeToken?.decimals ?? 18,
    }),
    [nativeToken],
  );

  const getResolveData = useCallback(async () => {
    if (!data || !networkId || !account) {
      return;
    }
    try {
      const [, chainId] = networkId.split(SEPERATOR);
      // Make a transaction and return it
      const unsignedTx: UnsignedTransaction = {
        to,
        data,
        gasPrice,
        // maxFeePerGas,
        // maxPriorityFeePerGas,
        chainId: Number(chainId),
        gasLimit: approvalTransaction.gas,
      };
      const rawTx = serialize(unsignedTx);
      const [txResult] = await backgroundApiProxy.engine.signTransaction(
        '12341234',
        networkId,
        account.id,
        [rawTx],
      );
      return txResult;
    } catch (e) {
      console.error(e);
    }
  }, [account, approvalTransaction.gas, data, gasPrice, networkId, to]);

  const dappApprove = useDappApproveAction({
    id,
    getResolveData,
  });

  const handleConfirmApprove = useCallback(async () => {
    if (!computedIsRug) {
      // Do approve operation
      return dappApprove.resolve();
    }
    // Do confirm before approve
    setRugConfirmDialogVisible(true);
  }, [computedIsRug, dappApprove]);

  const content = useMemo(() => {
    const spendLimit = Number(route.params?.spendLimit ?? 0);
    const spendText =
      spendLimit < UINT_64 ? (
        <FormatBalance
          balance={spendLimit}
          suffix={token.symbol}
          formatOptions={{ unit: token.decimal }}
        />
      ) : (
        intl.formatMessage({ id: 'form__unlimited' })
      );

    const fee = new BigNumber(gasLimit).multipliedBy(gasPrice ?? '5');
    const gasFeeNode = (
      <FormatBalance
        balance={fee}
        suffix={token.symbol}
        formatOptions={{ unit: token.decimal }}
      />
    );

    return (
      // Add padding to escape the footer
      <Column flex="1" pb="20" space={6}>
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
                  numberOfLines={3}
                >
                  {from}
                </Typography.Body2>
              </Column>
            }
          />
          {/* To */}
          <DescriptionListItem
            title={intl.formatMessage({ id: 'content__to' })}
            detail={to}
            detailNumberOfLines={3}
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
            detail={origin}
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
              detail={gasFeeNode}
              onPress={() => {
                navigation.navigate(DappApproveModalRoutes.EditFeeModal);
              }}
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
              detail={parsedData}
              detailNumberOfLines={6}
              onPress={() => {
                navigation.navigate(DappApproveModalRoutes.ContractDataModal, {
                  contractData: parsedData,
                });
              }}
              editable
            />
          </DescriptionList>
        </Column>
      </Column>
    );
  }, [
    account,
    intl,
    navigation,
    origin,
    parsedData,
    route,
    token,
    computedIsRug,
    from,
    gasLimit,
    gasPrice,
    to,
  ]);

  return (
    <>
      {/* Rug warning Confirm Dialog */}
      <RugConfirmDialog
        visible={rugConfirmDialogVisible}
        onCancel={() => setRugConfirmDialogVisible(false)}
        onConfirm={() => setRugConfirmDialogVisible(true)}
      />
      {/* Main Modal */}
      <Modal
        height="640px"
        primaryActionTranslationId="action__confirm"
        secondaryActionTranslationId="action__reject"
        header={intl.formatMessage({ id: 'title__approve' })}
        primaryActionProps={{ onPromise: handleConfirmApprove }}
        onSecondaryActionPress={dappApprove.reject}
        onClose={dappApprove.reject}
        scrollViewProps={{
          children: content,
        }}
      />
    </>
  );
};

export default Approve;
