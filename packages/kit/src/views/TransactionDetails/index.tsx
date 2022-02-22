import React, { FC, useCallback, useEffect, useState } from 'react';

import { useRoute } from '@react-navigation/core';
import { RouteProp } from '@react-navigation/native';
import { BigNumber } from 'bignumber.js';
import * as Linking from 'expo-linking';
import { IntlShape, useIntl } from 'react-intl';
import { Platform } from 'react-native';

import {
  Address,
  Box,
  Button,
  Container,
  Icon,
  Modal,
  Pressable,
  Typography,
} from '@onekeyhq/components';
import { ICON_NAMES } from '@onekeyhq/components/src/Icon';
import { Account, SimpleAccount } from '@onekeyhq/engine/src/types/account';
import {
  TokenType,
  Transaction,
  TransactionType,
  TxStatus,
} from '@onekeyhq/engine/src/types/covalent';
import { useActiveWalletAccount } from '@onekeyhq/kit/src/hooks/redux';
import {
  TransactionDetailModalRoutes,
  TransactionDetailRoutesParams,
} from '@onekeyhq/kit/src/routes/Modal/TransactionDetail';

import engine from '../../engine/EngineProvider';
import { useToast } from '../../hooks/useToast';
import { copyToClipboard } from '../../utils/ClipboardUtils';
import { formatDate } from '../../utils/DateUtils';
import NFTView from '../Components/nftView';
import { getTransactionStatusStr } from '../Components/transactionRecord';
import {
  getFromAddress,
  getSwapReceive,
  getSwapTransfer,
  getToAddress,
  getTransferAmount,
  getTransferNFTList,
} from '../Components/transactionRecord/utils';

type TransactionDetailRouteProp = RouteProp<
  TransactionDetailRoutesParams,
  TransactionDetailModalRoutes.TransactionDetailModal
>;

const getTransactionTypeStr = (
  intl: IntlShape,
  transaction: Transaction | null,
): string => {
  const stringKeys: Record<TransactionType, string> = {
    'Transfer': 'action__send',
    'Receive': 'action__receive',
    'Swap': 'transaction__exchange',
    'ContractExecution': 'transaction__multicall',
    // 'Approve': 'action__send',
  };
  return intl.formatMessage({
    id: stringKeys[transaction?.type ?? TransactionType.Transfer],
  });
};

/**
 * 交易详情
 */
const TransactionDetails: FC = () => {
  const intl = useIntl();
  const toast = useToast();
  const route = useRoute<TransactionDetailRouteProp>();
  const { tx } = route.params;
  const [accounts, setAccounts] = useState<Account[]>([]);
  const { account } = useActiveWalletAccount();

  console.log(`Account: ${JSON.stringify(account)}`);

  const openLinkUrl = useCallback((url: string) => {
    if (['android', 'ios'].includes(Platform.OS)) {
      Linking.openURL(url);
    } else {
      window.open(url, '_blank');
    }
  }, []);

  useEffect(() => {
    async function getAccounts() {
      const accountIds: string[] = [];
      (await engine.getWallets()).forEach((_wallet) => {
        _wallet.accounts.forEach((_account) => {
          accountIds.push(_account);
        });
      });
      setAccounts(await engine.getAccounts(accountIds));
    }
    getAccounts();
  }, []);
  const txInfo = tx;
  console.log(txInfo);

  const getTransactionStatusIcon = (
    state: TxStatus = TxStatus.Pending,
  ): ICON_NAMES => {
    const stringKeys: Record<TxStatus, ICON_NAMES> = {
      'Pending': 'TxStatusWarningCircleIllus',
      'Confirmed': 'TxStatusSuccessCircleIllus',
      'Failed': 'TxStatusFailureCircleIllus',
      // 'dropped': 'TxStatusFailureCircleIllus',
    };
    return stringKeys[state];
  };

  const getTransactionStatusColor = (
    state: TxStatus = TxStatus.Pending,
  ): string => {
    const stringKeys: Record<TxStatus, string> = {
      'Pending': 'text-warning',
      'Confirmed': 'text-success',
      'Failed': 'text-critical',
      // 'dropped': 'text-critical',
    };
    return stringKeys[state];
  };

  const copyHashToClipboard = useCallback(() => {
    copyToClipboard(txInfo?.txHash ?? '');
    toast.info(intl.formatMessage({ id: 'msg__copied' }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast, txInfo?.txHash]);

  // render Address
  const renderAddress = useCallback(
    (titleKey: string, address: string, networkLabel: string | null = null) => {
      const filterAccounts = accounts.filter(
        (_account) => (_account as SimpleAccount).address === address,
      );

      let accountName: string | null = null;
      if (
        filterAccounts.length > 0 &&
        filterAccounts[0].name.trim().length > 0
      ) {
        accountName = filterAccounts[0].name;
      } else if (networkLabel && networkLabel.trim().length > 0) {
        accountName = networkLabel;
      }

      if (accountName) {
        return (
          <Container.Item
            title={intl.formatMessage({ id: titleKey })}
            value={accountName}
            describe={address}
          />
        );
      }

      return (
        <Container.Item
          title={intl.formatMessage({ id: titleKey })}
          value={address}
        />
      );
    },
    [accounts, intl],
  );

  // render From Address
  const renderFromAddress = useCallback(() => {
    const { fromAddress, fromAddressLabel } = getFromAddress(txInfo);
    return renderAddress('content__from', fromAddress, fromAddressLabel);
  }, [renderAddress, txInfo]);

  // render To Address
  const renderToAddress = useCallback(() => {
    const { toAddress, toAddressLabel } = getToAddress(txInfo);
    return renderAddress('content__to', toAddress, toAddressLabel);
  }, [renderAddress, txInfo]);

  // render Amount
  const renderAmount = useCallback(
    (titleKey: string) => {
      const list = getTransferNFTList(txInfo);
      return (
        <Container.Item
          title={intl.formatMessage({ id: titleKey })}
          value={`${
            txInfo?.type === TransactionType.Transfer ? '-' : ''
          }${getTransferAmount(txInfo)}`}
          custom={list.map((item) => (
            <NFTView src={item} key={item} size={24} />
          ))}
        />
      );
    },
    [intl, txInfo],
  );

  // reader total amount
  const renderTotalAmount = useCallback(() => {
    if (
      txInfo?.tokenType === TokenType.ERC20 &&
      txInfo?.tokenEvent &&
      txInfo.tokenEvent.length > 0
    ) {
      // token transfer
      const tokenEvent = txInfo?.tokenEvent[0];
      const feeAmount = `${new BigNumber(txInfo?.gasSpent ?? 0)
        .multipliedBy(new BigNumber(txInfo?.gasPrice ?? 0))
        .dividedBy(new BigNumber(1e18))
        .decimalPlaces(6)
        .toString()} ETH`;

      const transferAmount = `${new BigNumber(tokenEvent?.tokenAmount ?? '')
        .dividedBy(new BigNumber(10).pow(tokenEvent?.tokenDecimals ?? 0))
        .decimalPlaces(4)
        .toString()} ${tokenEvent?.tokenSymbol}`;

      return (
        <Container.Item
          title={intl.formatMessage({ id: 'content__total' })}
          value={`${transferAmount} + ${feeAmount}`}
          describe={`${new BigNumber(txInfo?.gasQuote ?? 0)
            .plus(new BigNumber(tokenEvent?.deltaQuote ?? 0))
            .decimalPlaces(2)
            .toString()} USD`}
        />
      );
    }
    return (
      <Container.Item
        title={intl.formatMessage({ id: 'content__total' })}
        value={`${new BigNumber(txInfo?.gasSpent ?? 0)
          .multipliedBy(new BigNumber(txInfo?.gasPrice ?? 0))
          .plus(new BigNumber(txInfo?.value ?? 0))
          .dividedBy(new BigNumber(1e18))
          .decimalPlaces(6)
          .toString()} ETH`}
        describe={`${new BigNumber(txInfo?.gasQuote ?? 0)
          .plus(new BigNumber(txInfo?.valueQuote ?? 0))
          .decimalPlaces(2)
          .toString()} USD`}
      />
    );
  }, [intl, txInfo]);

  return (
    <Modal
      header={getTransactionTypeStr(intl, txInfo)}
      headerDescription={txInfo?.toAddress}
      footer={null}
      height="560px"
      scrollViewProps={{
        pt: 4,
        children: (
          <Box flexDirection="column" p={0.5} alignItems="center" mb={6}>
            <Icon
              name={getTransactionStatusIcon(txInfo?.successful)}
              size={56}
            />
            <Typography.Heading
              mt={2}
              color={getTransactionStatusColor(txInfo?.successful)}
            >
              {getTransactionStatusStr(intl, txInfo?.successful)}
            </Typography.Heading>

            <Container.Box mt={6}>
              <Container.Item
                title={intl.formatMessage({ id: 'content__hash' })}
              >
                <Box
                  flexDirection="row"
                  justifyContent="flex-end"
                  w="100%"
                  flexWrap="wrap"
                >
                  <Address
                    typography={{ sm: 'Body1Strong', md: 'Body2Strong' }}
                    text={txInfo?.txHash ?? ''}
                    short
                  />
                  <Pressable ml={3} onPress={copyHashToClipboard}>
                    <Icon size={20} name="DuplicateSolid" />
                  </Pressable>
                </Box>
              </Container.Item>

              {renderFromAddress()}

              {renderToAddress()}

              {txInfo?.type !== TransactionType.Swap &&
                renderAmount('content__amount')}

              {txInfo?.type === TransactionType.Swap && (
                <Container.Item
                  title={intl.formatMessage({ id: 'action__send' })}
                  value={`-${getSwapTransfer(txInfo)}`}
                />
              )}

              {txInfo?.type === TransactionType.Swap && (
                <Container.Item
                  title={intl.formatMessage({ id: 'action__receive' })}
                  value={`${getSwapReceive(txInfo)}`}
                />
              )}

              <Container.Item
                title={intl.formatMessage({ id: 'form__trading_time' })}
                value={formatDate(new Date(txInfo?.blockSignedAt ?? 0))}
              />

              <Container.Item
                title={intl.formatMessage({ id: 'content__fee' })}
                value={`${new BigNumber(txInfo?.gasSpent ?? 0)
                  .multipliedBy(new BigNumber(txInfo?.gasPrice ?? 0))
                  .dividedBy(new BigNumber(1e18))
                  .decimalPlaces(6)
                  .toString()} ETH`}
              />

              {renderTotalAmount()}
            </Container.Box>

            <Typography.Subheading mt={6} w="100%" color="text-subdued">
              {intl.formatMessage({ id: 'content__more_details' })}
            </Typography.Subheading>
            <Container.Box mt={2}>
              <Container.Item
                title={intl.formatMessage({ id: 'content__gas_limit' })}
                value={txInfo?.gasOffered.toString()}
              />
              <Container.Item
                title={intl.formatMessage({ id: 'content__gas_used' })}
                value={`${txInfo?.gasSpent?.toString() ?? ''}(${new BigNumber(
                  txInfo?.gasSpent ?? 0,
                )
                  .dividedBy(new BigNumber(txInfo?.gasOffered ?? 0))
                  .decimalPlaces(2)
                  .multipliedBy(100)
                  .toString()} %)`}
              />
              <Container.Item
                title={intl.formatMessage({ id: 'content__gas_price' })}
                value={`${new BigNumber(txInfo?.gasPrice ?? 0)
                  .dividedBy(1e18)
                  .toFixed()
                  .toString()} ETH (${new BigNumber(txInfo?.gasPrice ?? 0)
                  .dividedBy(1e9)
                  .toString()} Gwei)`}
              />
            </Container.Box>

            {/* <Typography.Subheading mt={6} w="100%" color="text-subdued">
              {intl.formatMessage({ id: 'content__activity_logs' })}
            </Typography.Subheading>
            <Container.Box mt={2}>
              <Container.Item
                title={intl.formatMessage({ id: 'content__created' })}
                value={formatDate(txInfo.date)}
              />
              <Container.Item
                title={intl.formatMessage({ id: 'content__submitted' })}
                value={formatDate(txInfo.date)}
              />
              <Container.Item
                title={intl.formatMessage({ id: 'content__confirmed' })}
                value={formatDate(txInfo.date)}
              />
            </Container.Box> */}

            <Button
              w="100%"
              mt={6}
              mb={6}
              size="lg"
              onPress={() => {
                openLinkUrl(`https://etherscan.io/tx/${txInfo?.txHash ?? ''}`);
              }}
              rightIcon={<Icon name="ArrowNarrowRightSolid" />}
            >
              {intl.formatMessage({ id: 'action__view_in_explorer' })}
            </Button>
          </Box>
        ),
      }}
    />
  );
};

export default TransactionDetails;
