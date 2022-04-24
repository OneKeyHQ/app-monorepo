import React, { FC, useCallback, useMemo } from 'react';

import { IntlShape, useIntl } from 'react-intl';

import {
  Address,
  Box,
  Button,
  Center,
  HStack,
  Icon,
  Text,
  Typography,
  useUserDevice,
} from '@onekeyhq/components';
import { ICON_NAMES } from '@onekeyhq/components/src/Icon';
import { LocaleIds } from '@onekeyhq/components/src/locale';
import {
  EVMDecodedTxType,
  EVMTxFromType,
  Transaction,
  TxStatus,
} from '@onekeyhq/engine/src/types/covalent';
import { Network } from '@onekeyhq/engine/src/types/network';
import { createVaultHelperInstance } from '@onekeyhq/engine/src/vaults/factory';
import { IEncodedTxEvm } from '@onekeyhq/engine/src/vaults/impl/evm/Vault';

import {
  formatBalanceDisplay,
  useFormatAmount,
} from '../../../components/Format';
import { useNavigation } from '../../../hooks';
import { useActiveWalletAccount } from '../../../hooks/redux';
import useFormatDate from '../../../hooks/useFormatDate';
import { ModalRoutes, RootRoutes } from '../../../routes/routesEnum';
import { SendConfirmActionType, SendRoutes } from '../../Send/types';
import NFTView from '../nftView';

import {
  getSwapReceive,
  getSwapTransfer,
  getTransferAmount,
  getTransferAmountFiat,
  getTransferNFTList,
} from './utils';

export type TransactionState = 'pending' | 'dropped' | 'failed' | 'success';

export type TransactionRecordProps = {
  transaction: Transaction;
  network?: Network | undefined;
};

export const getTransactionStatusStr = (
  intl: IntlShape,
  state: TxStatus = TxStatus.Pending,
): string => {
  const stringKeys: Record<TxStatus, LocaleIds> = {
    'Pending': 'transaction__pending',
    'Confirmed': 'transaction__success',
    'Failed': 'transaction__failed',
    // 'dropped': 'transaction__dropped',
  };
  return intl.formatMessage({
    id: stringKeys[state],
  });
};

const getTransactionStatusColor = (
  state: TxStatus = TxStatus.Pending,
): string => {
  const stringKeys: Record<TxStatus, string> = {
    'Pending': 'text-warning',
    'Confirmed': 'text-subdued',
    'Failed': 'text-critical',
    // 'dropped': 'text-critical',
  };
  return stringKeys[state];
};

const getTransactionTypeStr = (
  intl: IntlShape,
  transaction: Transaction,
): string => {
  const { txType, fromType } = transaction;
  let id: LocaleIds = 'action__send';

  if (fromType === EVMTxFromType.IN) {
    id = 'action__receive';
  } else if (txType === EVMDecodedTxType.SWAP) {
    id = 'transaction__exchange';
  } else if (txType === EVMDecodedTxType.TRANSACTION) {
    id = 'transaction__contract_interaction';
  }
  return intl.formatMessage({ id });
};

const getTransactionTypeIcon = (transaction: Transaction): ICON_NAMES => {
  const { txType, fromType } = transaction;
  let icon: ICON_NAMES = 'ArrowUpSolid';

  if (fromType === EVMTxFromType.IN) {
    icon = 'ArrowDownSolid';
  } else if (txType === EVMDecodedTxType.SWAP) {
    icon = 'SwitchHorizontalSolid';
  } else if (txType === EVMDecodedTxType.TRANSACTION) {
    icon = 'ArrowUpSolid';
  }
  return icon;
};

const TransactionRecord: FC<TransactionRecordProps> = ({
  transaction,
  network,
}) => {
  const { size } = useUserDevice();
  const intl = useIntl();

  const formatDate = useFormatDate();
  const { useFormatCurrencyDisplay } = useFormatAmount();

  const renderNFTImages = useCallback(() => {
    const nftList = getTransferNFTList(transaction);
    if (nftList.length === 0) {
      return null;
    }

    return (
      <HStack space={2} mt={2}>
        {nftList.map((nft, index) => {
          const key = `${nft}${index}`;
          if (index < 2) {
            return <NFTView src={nft} key={key} size={24} />;
          }
          if (index === 2) {
            return (
              <Center width={9} height={24} key={key}>
                <Icon
                  size={20}
                  name="DotsHorizontalSolid"
                  color="icon-default"
                />
              </Center>
            );
          }
          return null;
        })}
      </HStack>
    );
  }, [transaction]);

  // 转账、收款、合约执行 展示余额
  const displayAmount = useCallback(() => true, []);

  const basicInfo = useCallback(
    () => (
      <Box minW="156px" flex={1}>
        <Text typography={{ sm: 'Body1Strong', md: 'Body2Strong' }}>
          {getTransactionTypeStr(intl, transaction)}
        </Text>
        <Typography.Body2
          color={getTransactionStatusColor(transaction.successful)}
        >
          {transaction.successful === TxStatus.Confirmed
            ? formatDate.formatDate(transaction.blockSignedAt, {
                hideTheYear: true,
                hideTheMonth: true,
              })
            : getTransactionStatusStr(intl, transaction.successful)}
        </Typography.Body2>
      </Box>
    ),
    [formatDate, intl, transaction],
  );

  const amountFiat = useFormatCurrencyDisplay([
    getTransferAmountFiat(transaction).balance,
  ]);

  const amountInfo = useCallback(() => {
    if (transaction?.txType === EVMDecodedTxType.SWAP) {
      return (
        <Box alignItems="flex-end" minW="156px" maxW="156px" textAlign="right">
          <Text typography={{ sm: 'Body1Strong', md: 'Body2Strong' }}>
            -{getSwapTransfer(transaction, network)}
          </Text>
          <Typography.Body2 color="text-subdued" textAlign="right">
            →{getSwapReceive(transaction, network)}
          </Typography.Body2>
        </Box>
      );
    }
    const originAmount = getTransferAmount(transaction, network);
    const amount = formatBalanceDisplay(
      originAmount.balance,
      originAmount.unit,
      {
        unit: originAmount.decimals,
        fixed: originAmount.fixed,
      },
    );

    return (
      <Box alignItems="flex-end" minW="156px" maxW="156px">
        <Text
          typography={{ sm: 'Body1Strong', md: 'Body2Strong' }}
          textAlign="right"
        >
          {transaction.fromType === EVMTxFromType.OUT && '-'}
          {`${amount.amount ?? '-'} ${amount.unit ?? ''}`}
        </Text>
        <Typography.Body2 color="text-subdued" textAlign="right">
          {transaction.fromType === EVMTxFromType.OUT &&
            transaction.txType !== EVMDecodedTxType.ERC721_TRANSFER &&
            '-'}
          {`${amountFiat.amount ?? '-'} ${amountFiat.unit ?? ''}`}
        </Typography.Body2>
      </Box>
    );
  }, [amountFiat, network, transaction]);

  const ItemInfo = useMemo(() => {
    if (['SMALL', 'NORMAL'].includes(size)) {
      return (
        <Box flexDirection="row" flex={1}>
          <Box flex={1}>
            {basicInfo()}
            {/* {transaction.type === 'Approve' ? (
              <Typography.Body2 color="text-subdued">
                {transaction?.approveInfo?.url}
              </Typography.Body2>
            ) : (
              <Address color="text-subdued" text={transaction.to} short />
            )} */}
            <Address color="text-subdued" text={transaction.toAddress} short />
          </Box>
          {displayAmount() && amountInfo()}
        </Box>
      );
    }
    return (
      <Box
        flexDirection="row"
        flex={1}
        alignItems="center"
        justifyContent="space-between"
      >
        <Box minW="128px">{basicInfo()}</Box>
        {/* {transaction.type === 'Approve' ? (
          <Typography.Body2 textAlign="left" color="text-subdued">
            {transaction?.approveInfo?.url}
          </Typography.Body2>
        ) : (
          <Box>
            <Address color="text-subdued" text={transaction.toAddress} />
          </Box>
        )} */}
        <Box flex={1}>
          <Address color="text-subdued" text={transaction.toAddress} />
        </Box>
        {displayAmount() ? amountInfo() : <Box minW="156px" />}
      </Box>
    );
  }, [amountInfo, basicInfo, displayAmount, size, transaction.toAddress]);

  const { accountId, networkId } = useActiveWalletAccount();
  const navigation = useNavigation();

  const updateTx = useCallback(
    async (actionType: SendConfirmActionType) => {
      const vaultHelper = createVaultHelperInstance({
        networkId,
        accountId,
      });
      const encodedTx = (await vaultHelper.parseToEncodedTx(
        transaction.rawTx,
      )) as IEncodedTxEvm;

      let { to, value, data, from } = encodedTx;
      if (actionType === 'cancel') {
        to = from;
        value = '0';
        data = '0x';
      }

      const newEncodedTx = {
        ...encodedTx,
        to,
        value,
        data,
      };

      console.log(actionType, newEncodedTx);

      navigation.navigate(RootRoutes.Modal, {
        screen: ModalRoutes.Send,
        params: {
          screen: SendRoutes.SendConfirm,
          params: {
            encodedTx: newEncodedTx,
            actionType,
          },
        },
      });
    },
    [accountId, navigation, networkId, transaction.rawTx],
  );

  return (
    <Box flexDirection="row">
      <Center
        mt={{ base: 1.5, md: 1 }}
        rounded="full"
        size={8}
        bg="surface-neutral-default"
      >
        <Icon size={20} name={getTransactionTypeIcon(transaction)} />
      </Center>

      <Box flexDirection="column" flex={1} ml={3}>
        {ItemInfo}

        {renderNFTImages()}

        {transaction.successful === TxStatus.Pending && (
          <Box flexDirection="row" mt={4} alignItems="center">
            <Typography.Caption color="text-subdued" flex={1}>
              {intl.formatMessage({ id: 'transaction__not_confirmed' })}
            </Typography.Caption>
            <Button
              size="xs"
              ml={2}
              onPress={() => {
                updateTx('cancel');
              }}
            >
              {intl.formatMessage({ id: 'action__cancel' })}
            </Button>
            <Button
              type="primary"
              size="xs"
              ml={2}
              onPress={() => {
                updateTx('speedUp');
              }}
            >
              {intl.formatMessage({ id: 'action__speed_up' })}
            </Button>
          </Box>
        )}
      </Box>
    </Box>
  );
};

export default TransactionRecord;
