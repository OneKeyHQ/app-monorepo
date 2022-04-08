import React, { useCallback, useMemo, useState } from 'react';

import { RouteProp, useNavigation, useRoute } from '@react-navigation/core';
import BigNumber from 'bignumber.js';
import { Column } from 'native-base';
import { useIntl } from 'react-intl';

import { Box, Center, Modal, Token, Typography } from '@onekeyhq/components';
import { Text } from '@onekeyhq/components/src/Typography';

import { IDappCallParams } from '../../background/IBackgroundApi';
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

type ApprovalParams = {
  from: string;
  // Target 的详细信息从哪拿
  to: string;
  gasLimit: string;
  gasPrice: string;
  data: string;
};

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

  const { sourceInfo, ...dappParams } = useDappParams();
  const { id, origin } = sourceInfo || ({} as IDappCallParams);
  // @ts-ignore
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  const approvalData = (dappParams.data.params as [ApprovalParams])?.[0] ?? {};
  const { from, to, gasLimit, gasPrice, data } = approvalData;
  const computedIsRug = isRug(origin);

  // parsed from data
  const parsedData = data;
  const { account } = useActiveWalletAccount();
  // Should be parse from data, we use native to mock here
  const { nativeToken } = useManageTokens();
  const token = {
    logoUrl: nativeToken?.logoURI,
    name: nativeToken?.name,
    symbol: nativeToken?.symbol ?? 'ETH',
    decimal: nativeToken?.decimals ?? 18,
  };
  const getResolveData = useCallback(() => {
    // Make a transaction and return it
    if (data) {
      return '0xf9b3000d2e6630b1b9935505b1baf03900790b4e59278dc3e621b77604489f91';
    }
  }, [data]);
  const dappApprove = useDappApproveAction({
    id,
    getResolveData,
  });

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

    const fee = new BigNumber(gasLimit).multipliedBy(gasPrice);
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
    // :TODO: IMPORTANT
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        onPrimaryActionPress={({ close }) => {
          if (!computedIsRug) {
            // Do approve operation
            return dappApprove.resolve({ close });
          }
          // Do confirm before approve
          setRugConfirmDialogVisible(true);
        }}
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
