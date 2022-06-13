import React, { FC, useCallback, useMemo } from 'react';

import { IntlShape, useIntl } from 'react-intl';

import {
  Address,
  Box,
  Button,
  Center,
  Icon,
  Text,
  Typography,
  useUserDevice,
} from '@onekeyhq/components';
import { ICON_NAMES } from '@onekeyhq/components/src/Icon';
import { LocaleIds } from '@onekeyhq/components/src/locale';
import { TxStatus } from '@onekeyhq/engine/src/types/covalent';
import { createVaultHelperInstance } from '@onekeyhq/engine/src/vaults/factory';
import {
  EVMDecodedItem,
  EVMDecodedTxType,
} from '@onekeyhq/engine/src/vaults/impl/evm/decoder/types';
import { IEncodedTxEvm } from '@onekeyhq/engine/src/vaults/impl/evm/Vault';

import { useNavigation } from '../../../hooks';
import { useActiveWalletAccount } from '../../../hooks/redux';
import useFormatDate from '../../../hooks/useFormatDate';
import { ModalRoutes, RootRoutes } from '../../../routes/routesEnum';
import { SendConfirmActionType, SendRoutes } from '../../Send/types';

export const getTransactionStatusStr = (
  intl: IntlShape,
  tx: EVMDecodedItem,
) => {
  const stringKeys = {
    [TxStatus.Pending]: 'transaction__pending',
    [TxStatus.Confirmed]: 'transaction__success',
    [TxStatus.Failed]: 'transaction__failed',
    [TxStatus.Dropped]: 'transaction__dropped',
  } as const;
  return intl.formatMessage({
    id: stringKeys[tx.txStatus],
  });
};

const getTransactionStatusColor = (tx: EVMDecodedItem) => {
  const stringKeys = {
    [TxStatus.Pending]: 'text-warning',
    [TxStatus.Confirmed]: 'text-subdued',
    [TxStatus.Failed]: 'text-critical',
    [TxStatus.Dropped]: 'text-critical',
  } as const;
  return stringKeys[tx.txStatus];
};

const getTransactionTypeStr = (intl: IntlShape, tx: EVMDecodedItem): string => {
  const { txType, fromType } = tx;
  let id: LocaleIds = 'action__send';

  if (fromType === 'IN') {
    id = 'action__receive';
  } else if (
    txType === EVMDecodedTxType.INTERNAL_SWAP ||
    txType === EVMDecodedTxType.SWAP
  ) {
    id = 'transaction__exchange';
  } else if (txType === EVMDecodedTxType.TOKEN_APPROVE) {
    id = 'title__approve';
  } else if (txType === EVMDecodedTxType.TRANSACTION) {
    id = 'transaction__contract_interaction';
  }
  return intl.formatMessage({ id });
};

const getTransactionTypeIcon = (tx: EVMDecodedItem): ICON_NAMES => {
  const { txType, fromType } = tx;
  let icon: ICON_NAMES = 'NavSendSolid';

  if (fromType === 'IN') {
    icon = 'NavReceiveSolid';
  } else if (
    txType === EVMDecodedTxType.INTERNAL_SWAP ||
    txType === EVMDecodedTxType.SWAP
  ) {
    icon = 'SwitchHorizontalSolid';
  }
  return icon;
};

const TxRecordCell: FC<{
  tx: EVMDecodedItem;
}> = ({ tx }) => {
  const { size } = useUserDevice();
  const intl = useIntl();
  const formatDate = useFormatDate();

  const basicInfo = useCallback(
    () => (
      <Box minW="156px" flex={1}>
        <Text typography={{ sm: 'Body1Strong', md: 'Body2Strong' }}>
          {getTransactionTypeStr(intl, tx)}
        </Text>
        <Typography.Body2 color={getTransactionStatusColor(tx)}>
          {tx.txStatus === TxStatus.Confirmed
            ? formatDate.formatDate(new Date(tx.blockSignedAt), {
                hideTheYear: true,
                hideTheMonth: true,
              })
            : getTransactionStatusStr(intl, tx)}
        </Typography.Body2>
      </Box>
    ),
    [formatDate, intl, tx],
  );

  const amountInfo = useCallback(() => {
    const { fromType, info } = tx;

    if (info?.type === EVMDecodedTxType.INTERNAL_SWAP) {
      const { buyTokenSymbol, sellTokenSymbol, buyAmount, sellAmount } = info;
      return (
        <Box alignItems="flex-end" minW="156px" maxW="156px" textAlign="right">
          <Text typography={{ sm: 'Body1Strong', md: 'Body2Strong' }}>
            {`-${sellAmount} ${sellTokenSymbol}`}
          </Text>
          <Typography.Body2 color="text-subdued" textAlign="right">
            {`→${buyAmount} ${buyTokenSymbol}`}
          </Typography.Body2>
        </Box>
      );
    }

    if (info?.type === EVMDecodedTxType.TOKEN_APPROVE) {
      const { isUInt256Max, amount, token } = info;
      return (
        <Box alignItems="flex-end" minW="156px" maxW="156px" textAlign="right">
          <Text typography={{ sm: 'Body1Strong', md: 'Body2Strong' }}>
            {`${
              isUInt256Max
                ? intl.formatMessage({ id: 'form__unlimited' })
                : amount
            } ${token.symbol}`}
          </Text>
        </Box>
      );
    }

    let { symbol, amount, fiatAmount } = tx;
    const fiat = fiatAmount ? `$ ${fiatAmount.toFixed(2)}` : '';
    const minus = fromType === 'OUT' ? '-' : '';

    if (info && info.type === EVMDecodedTxType.TOKEN_TRANSFER) {
      amount = info.amount;
      symbol = info.token.symbol;
    }
    return (
      <Box alignItems="flex-end" minW="156px" maxW="156px">
        <Text
          typography={{ sm: 'Body1Strong', md: 'Body2Strong' }}
          textAlign="right"
        >
          {`${minus}${amount ?? '-'} ${symbol}`}
        </Text>
        <Typography.Body2 color="text-subdued" textAlign="right">
          {`${minus}${fiat}`}
        </Typography.Body2>
      </Box>
    );
  }, [tx, intl]);

  const ItemInfo = useMemo(() => {
    if (['SMALL', 'NORMAL'].includes(size)) {
      return (
        <Box flexDirection="row" flex={1}>
          <Box flex={1}>
            {basicInfo()}
            <Address color="text-subdued" text={tx.toAddress} short />
          </Box>
          {amountInfo()}
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
        <Box flex={1}>
          <Address color="text-subdued" text={tx.toAddress} />
        </Box>
        {amountInfo()}
      </Box>
    );
  }, [amountInfo, basicInfo, size, tx.toAddress]);

  const { accountId, networkId } = useActiveWalletAccount();
  const navigation = useNavigation();

  const updateTx = useCallback(
    async (actionType: SendConfirmActionType) => {
      const vaultHelper = createVaultHelperInstance({
        networkId,
        accountId,
      });
      const encodedTx = (await vaultHelper.parseToEncodedTx(
        tx.raw ?? '',
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

      navigation.navigate(RootRoutes.Modal, {
        screen: ModalRoutes.Send,
        params: {
          screen: SendRoutes.SendConfirm,
          params: {
            encodedTx: newEncodedTx,
            actionType,
            feeInfoEditable: true,
            feeInfoUseFeeInTx: true,
          },
        },
      });
    },
    [accountId, navigation, networkId, tx.raw],
  );

  return (
    <Box flexDirection="row">
      <Center
        mt={{ base: 1.5, md: 1 }}
        rounded="full"
        size={8}
        bg="surface-neutral-default"
      >
        <Icon size={20} name={getTransactionTypeIcon(tx)} />
      </Center>

      <Box flexDirection="column" flex={1} ml={3}>
        {ItemInfo}
        {tx.txStatus === TxStatus.Pending && (
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

export default TxRecordCell;
