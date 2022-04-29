import React, { FC, useCallback, useEffect, useMemo, useState } from 'react';

import { useRoute } from '@react-navigation/core';
import { RouteProp } from '@react-navigation/native';
import { BigNumber } from 'bignumber.js';
import { IntlShape, useIntl } from 'react-intl';

import {
  Box,
  Button,
  Center,
  Container,
  Icon,
  Modal,
  Typography,
} from '@onekeyhq/components';
import { ICON_NAMES } from '@onekeyhq/components/src/Icon';
import { LocaleIds } from '@onekeyhq/components/src/locale';
import { ThemeValues } from '@onekeyhq/components/src/Provider/theme';
import { shortenAddress } from '@onekeyhq/components/src/utils';
import { copyToClipboard } from '@onekeyhq/components/src/utils/ClipboardUtils';
import { Account } from '@onekeyhq/engine/src/types/account';
import {
  EVMDecodedTxType,
  EVMTxFromType,
  Transaction,
  TxStatus,
} from '@onekeyhq/engine/src/types/covalent';
import { useActiveWalletAccount } from '@onekeyhq/kit/src/hooks/redux';
import useOpenBlockBrowser from '@onekeyhq/kit/src/hooks/useOpenBlockBrowser';
import {
  TransactionDetailModalRoutes,
  TransactionDetailRoutesParams,
} from '@onekeyhq/kit/src/routes/Modal/TransactionDetail';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { formatBalanceDisplay, useFormatAmount } from '../../components/Format';
import useFormatDate from '../../hooks/useFormatDate';
import { useToast } from '../../hooks/useToast';
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
  let id: LocaleIds = 'action__send';
  if (!transaction) {
    return intl.formatMessage({ id });
  }
  const { txType, fromType } = transaction;

  if (fromType === EVMTxFromType.IN) {
    id = 'action__receive';
  } else if (txType === EVMDecodedTxType.SWAP) {
    id = 'transaction__exchange';
  } else if (txType === EVMDecodedTxType.TRANSACTION) {
    id = 'transaction__contract_interaction';
  }
  return intl.formatMessage({ id });
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
  const openBlockBrowser = useOpenBlockBrowser(network);
  const formatDate = useFormatDate();
  const { useFormatCurrencyDisplay } = useFormatAmount();

  const txInfo = tx;

  useEffect(() => {
    async function getAccounts() {
      const accountIds: string[] = [];
      (await backgroundApiProxy.engine.getWallets()).forEach((_wallet) => {
        _wallet.accounts.forEach((_account) => {
          accountIds.push(_account);
        });
      });
      setAccounts(await backgroundApiProxy.engine.getAccounts(accountIds));
    }
    getAccounts();
    console.log(`Account: ${JSON.stringify(account)}`);
    console.log(txInfo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getTransactionStatusIcon = (
    state: TxStatus = TxStatus.Pending,
  ): ICON_NAMES => {
    const stringKeys: Record<TxStatus, ICON_NAMES> = {
      'Pending': 'DotsCircleHorizontalOutline',
      'Confirmed': 'CheckCircleOutline',
      'Failed': 'CloseCircleOutline',
      // 'dropped': 'TxStatusFailureCircleIllus',
    };
    return stringKeys[state];
  };

  const getTransactionStatusIconColor = (
    state: TxStatus = TxStatus.Pending,
  ): keyof ThemeValues => {
    const stringKeys: Record<TxStatus, keyof ThemeValues> = {
      'Pending': 'icon-warning',
      'Confirmed': 'icon-success',
      'Failed': 'icon-critical',
      // 'dropped': 'TxStatusFailureCircleIllus',
    };
    return stringKeys[state];
  };

  const getTransactionStatusIconContainerColor = (
    state: TxStatus = TxStatus.Pending,
  ): string => {
    const stringKeys: Record<TxStatus, string> = {
      'Pending': 'surface-warning-default',
      'Confirmed': 'surface-success-default',
      'Failed': 'surface-critical-default',
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
    toast.show({ title: intl.formatMessage({ id: 'msg__copied' }) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast, txInfo?.txHash]);

  // render Address
  const renderAddress = useCallback(
    (
      titleKey: LocaleIds,
      address: string,
      networkLabel: string | null = null,
    ) => {
      const filterAccounts = accounts.filter(
        (_account) => _account.address === address,
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
            describe={accountName}
            subDescribe={address}
          />
        );
      }

      return (
        <Container.Item
          title={intl.formatMessage({ id: titleKey })}
          describe={address}
        />
      );
    },
    [accounts, intl],
  );

  // render From Address
  const renderFromAddress = useMemo(() => {
    const { fromAddress, fromAddressLabel } = getFromAddress(txInfo);
    return renderAddress('content__from', fromAddress, fromAddressLabel);
  }, [renderAddress, txInfo]);

  // render To Address
  const renderToAddress = useMemo(() => {
    const { toAddress, toAddressLabel } = getToAddress(txInfo);
    return renderAddress('content__to', toAddress, toAddressLabel);
  }, [renderAddress, txInfo]);

  // render Amount
  const renderAmount = useCallback(
    (titleKey: LocaleIds) => {
      const list = getTransferNFTList(txInfo);
      const originAmount = getTransferAmount(txInfo, network);
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
          describe={`${txInfo?.fromType === EVMTxFromType.OUT ? '-' : ''}${`${
            amount.amount ?? '-'
          } ${amount.unit ?? ''}`}`}
          subDescribeCustom={
            <Box
              flex={1}
              flexDirection="row"
              flexWrap="wrap"
              justifyContent="flex-end"
              mt={list.length > 0 ? 2 : 0}
            >
              {list.map((item) => (
                <Box m={1}>
                  <NFTView
                    src={item}
                    key={item}
                    size={list.length > 2 ? '84px' : '96px'}
                  />
                </Box>
              ))}
            </Box>
          }
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

  const useRenderTotalAmount = useMemo(() => {
    if (
      txInfo?.txType !== EVMDecodedTxType.SWAP &&
      txInfo?.txType === EVMDecodedTxType.TOKEN_TRANSFER &&
      txInfo?.tokenEvent &&
      txInfo.tokenEvent.length > 0
    ) {
      // token transfer
      const tokenEvent = txInfo?.tokenEvent[0];

      const feeAmount = formatBalanceDisplay(
        new BigNumber(txInfo?.gasSpent ?? 0).multipliedBy(
          new BigNumber(txInfo?.gasPrice ?? 0),
        ),
        network?.symbol,
        {
          unit: network?.decimals,
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
          describe={`${`${transferAmount.amount ?? '-'} ${
            transferAmount.unit ?? ''
          }`} + ${`${feeAmount.amount ?? '-'} ${feeAmount.unit ?? ''}`}`}
          subDescribe={`${totalErc20AmountFiat.amount ?? '-'} ${
            totalErc20AmountFiat.unit ?? ''
          }`}
        />
      );
    }

    const transferAmount = formatBalanceDisplay(
      new BigNumber(txInfo?.gasSpent ?? 0)
        .multipliedBy(new BigNumber(txInfo?.gasPrice ?? 0))
        .plus(new BigNumber(txInfo?.value ?? 0)),
      network?.symbol,
      {
        unit: network?.decimals,
      },
    );

    return (
      <Container.Item
        title={intl.formatMessage({ id: 'content__total' })}
        describe={`${transferAmount.amount ?? '-'} ${
          transferAmount.unit ?? ''
        }`}
        subDescribe={`${totalAmountFiat.amount ?? '-'} ${
          totalAmountFiat.unit ?? ''
        }`}
      />
    );
  }, [
    intl,
    network?.decimals,
    network?.symbol,
    totalAmountFiat.amount,
    totalAmountFiat.unit,
    totalErc20AmountFiat.amount,
    totalErc20AmountFiat.unit,
    txInfo?.gasPrice,
    txInfo?.gasSpent,
    txInfo?.tokenEvent,
    txInfo?.txType,
    txInfo?.value,
  ]);

  // render transaction fee
  const renderTransactionFee = useMemo(() => {
    const feeAmount = formatBalanceDisplay(
      new BigNumber(txInfo?.gasSpent ?? 0).multipliedBy(
        new BigNumber(txInfo?.gasPrice ?? 0),
      ),
      network?.symbol,
      {
        unit: network?.decimals,
      },
    );

    return (
      <Container.Item
        title={intl.formatMessage({ id: 'content__fee' })}
        describe={`${feeAmount.amount ?? '-'} ${feeAmount.unit ?? ''}`}
      />
    );
  }, [
    intl,
    network?.decimals,
    network?.symbol,
    txInfo?.gasPrice,
    txInfo?.gasSpent,
  ]);

  // render gas price
  const renderGasPrice = useMemo(() => {
    const Amount = formatBalanceDisplay(
      new BigNumber(txInfo?.gasPrice ?? 0),

      network?.symbol,
      {
        unit: network?.decimals,
      },
    );
    const feeAmount = formatBalanceDisplay(
      new BigNumber(txInfo?.gasPrice ?? 0),

      network?.feeSymbol,
      {
        unit: network?.feeDecimals,
        fixed: network?.tokenDisplayDecimals,
      },
    );
    return (
      <Container.Item
        title={intl.formatMessage({ id: 'content__gas_price' })}
        describe={`${`${Amount.amount ?? '-'} ${Amount.unit ?? ''}`} (${`${
          feeAmount.amount ?? '-'
        } ${feeAmount.unit ?? ''}`})`}
      />
    );
  }, [
    intl,
    network?.decimals,
    network?.feeDecimals,
    network?.feeSymbol,
    network?.symbol,
    network?.tokenDisplayDecimals,
    txInfo?.gasPrice,
  ]);

  return (
    <Modal
      header={getTransactionTypeStr(intl, txInfo)}
      headerDescription={shortenAddress(txInfo?.toAddress ?? '')}
      footer={null}
      height="560px"
      scrollViewProps={{
        pt: 4,
        children: (
          <Box
            flexDirection="column"
            p={0.5}
            alignItems="center"
            mb={{ base: 4, md: 0 }}
          >
            <Center
              rounded="full"
              size="56px"
              bgColor={getTransactionStatusIconContainerColor(
                txInfo?.successful,
              )}
            >
              <Icon
                color={getTransactionStatusIconColor(txInfo?.successful)}
                name={getTransactionStatusIcon(txInfo?.successful)}
              />
            </Center>
            <Typography.Heading
              mt={2}
              color={getTransactionStatusColor(txInfo?.successful)}
            >
              {getTransactionStatusStr(intl, txInfo?.successful)}
            </Typography.Heading>

            <Container.Box mt={6}>
              <Container.Item
                title={intl.formatMessage({ id: 'content__hash' })}
                describe={shortenAddress(txInfo?.txHash ?? '', 8)}
                customArrowIconName="DuplicateSolid"
                onArrowIconPress={copyHashToClipboard}
              />

              {renderFromAddress}

              {renderToAddress}

              {txInfo?.txType !== EVMDecodedTxType.SWAP &&
                renderAmount('content__amount')}

              {txInfo?.txType === EVMDecodedTxType.SWAP && (
                <Container.Item
                  title={intl.formatMessage({ id: 'action__send' })}
                  describe={`-${getSwapTransfer(txInfo, network)}`}
                />
              )}

              {txInfo?.txType === EVMDecodedTxType.SWAP && (
                <Container.Item
                  title={intl.formatMessage({ id: 'action__receive' })}
                  describe={`${getSwapReceive(txInfo, network)}`}
                />
              )}

              {!!txInfo?.blockSignedAt && (
                <Container.Item
                  title={intl.formatMessage({ id: 'form__trading_time' })}
                  describe={formatDate.formatDate(txInfo?.blockSignedAt)}
                />
              )}

              {renderTransactionFee}

              {useRenderTotalAmount}
            </Container.Box>

            <Typography.Subheading mt={6} w="100%" color="text-subdued">
              {intl.formatMessage({ id: 'content__more_details' })}
            </Typography.Subheading>
            <Container.Box mt={2}>
              <Container.Item
                title={intl.formatMessage({ id: 'content__gas_limit' })}
                describe={txInfo?.gasOffered?.toString()}
              />
              <Container.Item
                title={intl.formatMessage({ id: 'content__gas_used' })}
                describe={`${
                  txInfo?.gasSpent?.toString() ?? ''
                }(${new BigNumber(txInfo?.gasSpent ?? 0)
                  .dividedBy(new BigNumber(txInfo?.gasOffered ?? 0))
                  .decimalPlaces(2)
                  .multipliedBy(100)
                  .toString()} %)`}
              />

              {renderGasPrice}
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
              size="lg"
              onPress={() => {
                openBlockBrowser.openTransactionDetails(txInfo?.txHash);
              }}
              rightIconName="ArrowNarrowRightSolid"
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
