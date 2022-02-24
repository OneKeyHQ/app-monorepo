import React, { FC, useCallback, useEffect, useState } from 'react';

import { useRoute } from '@react-navigation/core';
import { RouteProp } from '@react-navigation/native';
import { BigNumber } from 'bignumber.js';
import { IntlShape, useIntl } from 'react-intl';

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
import useOpenBlockBrowser from '@onekeyhq/kit/src/hooks/useOpenBlockBrowser';
import {
  TransactionDetailModalRoutes,
  TransactionDetailRoutesParams,
} from '@onekeyhq/kit/src/routes/Modal/TransactionDetail';

import {
  formatBalanceDisplay,
  useFormatCurrencyDisplay,
} from '../../components/Format';
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
  const { account, network } = useActiveWalletAccount();
  const openBlockBrowser = useOpenBlockBrowser(network?.network);

  const txInfo = tx;

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
    console.log(`Account: ${JSON.stringify(account)}`);
    console.log(txInfo);
  }, []);

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
      const originAmount = getTransferAmount(txInfo, network?.network);
      const amount = formatBalanceDisplay(
        originAmount.balance,
        originAmount.unit,
        {
          unit: originAmount.decimals,
        },
      );

      return (
        <Container.Item
          title={intl.formatMessage({ id: titleKey })}
          value={`${
            txInfo?.type === TransactionType.Transfer ? '-' : ''
          }${amount}`}
          custom={list.map((item) => (
            <NFTView src={item} key={item} size={24} />
          ))}
        />
      );
    },
    [intl, network, txInfo],
  );

  // reader total amount
  const totalErc20AmountFiat = useFormatCurrencyDisplay([
    txInfo?.gasQuote ?? 0,
    txInfo?.tokenEvent && txInfo?.tokenEvent?.length > 0
      ? txInfo?.tokenEvent[0].deltaQuote
      : 0,
  ]);

  const totalAmountFiat = useFormatCurrencyDisplay([
    new BigNumber(txInfo?.gasQuote ?? 0).plus(
      new BigNumber(txInfo?.valueQuote ?? 0),
    ),
  ]);

  const renderTotalAmount = useCallback(() => {
    if (
      txInfo?.tokenType === TokenType.ERC20 &&
      txInfo?.tokenEvent &&
      txInfo.tokenEvent.length > 0
    ) {
      // token transfer
      const tokenEvent = txInfo?.tokenEvent[0];

      const feeAmount = formatBalanceDisplay(
        new BigNumber(txInfo?.gasSpent ?? 0).multipliedBy(
          new BigNumber(txInfo?.gasPrice ?? 0),
        ),
        network?.network?.symbol,
        {
          unit: network?.network?.decimals,
        },
      );

      const transferAmount = formatBalanceDisplay(
        new BigNumber(tokenEvent?.tokenAmount ?? '0'),
        tokenEvent?.tokenSymbol,
        {
          unit: tokenEvent?.tokenDecimals ?? 1,
        },
      );

      return (
        <Container.Item
          title={intl.formatMessage({ id: 'content__total' })}
          value={`${transferAmount} + ${feeAmount}`}
          describe={totalErc20AmountFiat}
        />
      );
    }

    const transferAmount = formatBalanceDisplay(
      new BigNumber(txInfo?.gasSpent ?? 0)
        .multipliedBy(new BigNumber(txInfo?.gasPrice ?? 0))
        .plus(new BigNumber(txInfo?.value ?? 0)),
      network?.network?.symbol,
      {
        unit: network?.network?.decimals,
        fixed: network?.network?.nativeDisplayDecimals,
      },
    );
    return (
      <Container.Item
        title={intl.formatMessage({ id: 'content__total' })}
        value={transferAmount}
        describe={totalAmountFiat}
      />
    );
  }, [
    intl,
    network?.network?.decimals,
    network?.network?.nativeDisplayDecimals,
    network?.network?.symbol,
    totalAmountFiat,
    totalErc20AmountFiat,
    txInfo?.gasPrice,
    txInfo?.gasSpent,
    txInfo?.tokenEvent,
    txInfo?.tokenType,
    txInfo?.value,
  ]);

  // render transaction fee
  const renderTransactionFee = useCallback(() => {
    const feeAmount = formatBalanceDisplay(
      new BigNumber(txInfo?.gasSpent ?? 0).multipliedBy(
        new BigNumber(txInfo?.gasPrice ?? 0),
      ),
      network?.network?.symbol,
      {
        unit: network?.network?.decimals,
      },
    );

    return (
      <Container.Item
        title={intl.formatMessage({ id: 'content__fee' })}
        value={feeAmount}
      />
    );
  }, [
    intl,
    network?.network?.decimals,
    network?.network?.symbol,
    txInfo?.gasPrice,
    txInfo?.gasSpent,
  ]);

  // render gas price
  const renderGasPrice = useCallback(() => {
    const Amount = formatBalanceDisplay(
      new BigNumber(txInfo?.gasPrice ?? 0),

      network?.network?.symbol,
      {
        unit: network?.network?.decimals,
      },
    );
    const feeAmount = formatBalanceDisplay(
      new BigNumber(txInfo?.gasPrice ?? 0),

      network?.network?.feeSymbol,
      {
        unit: network?.network?.feeDecimals,
        fixed: network?.network?.tokenDisplayDecimals,
      },
    );
    return (
      <Container.Item
        title={intl.formatMessage({ id: 'content__gas_price' })}
        value={`${Amount} (${feeAmount})`}
      />
    );
  }, [
    intl,
    network?.network?.decimals,
    network?.network?.feeDecimals,
    network?.network?.feeSymbol,
    network?.network?.symbol,
    network?.network?.tokenDisplayDecimals,
    txInfo?.gasPrice,
  ]);

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
                  value={`-${getSwapTransfer(txInfo, network?.network)}`}
                />
              )}

              {txInfo?.type === TransactionType.Swap && (
                <Container.Item
                  title={intl.formatMessage({ id: 'action__receive' })}
                  value={`${getSwapReceive(txInfo, network?.network)}`}
                />
              )}

              <Container.Item
                title={intl.formatMessage({ id: 'form__trading_time' })}
                value={formatDate(new Date(txInfo?.blockSignedAt ?? 0))}
              />

              {renderTransactionFee()}

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

              {renderGasPrice()}
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
                openBlockBrowser.openTransactionDetails(txInfo?.txHash);
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
