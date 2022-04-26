import React, { FC } from 'react';

import { useIntl } from 'react-intl';

import { Box, Container, Typography } from '@onekeyhq/components';
import {
  EVMDecodedItem,
  EVMDecodedItemERC20Transfer,
  EVMDecodedTxType,
} from '@onekeyhq/engine/src/vaults/impl/evm/decoder/decoder';

import Address from './Address';
import HeaderIcon from './HeaderIcon';

const TxConfirmDetail: FC<{
  tx: EVMDecodedItem;
  feeInput?: any;
}> = ({ tx, feeInput }) => {
  const intl = useIntl();
  const info = tx.info as EVMDecodedItemERC20Transfer;
  const isNative = tx.txType === EVMDecodedTxType.NATIVE_TRANSFER;
  const headerInfo = isNative ? tx.network : info.token;
  const amount = isNative ? tx.amount : info.amount;

  return (
    <Box
      flexDirection="column"
      p={0.5}
      alignItems="center"
      mb={{ base: 4, md: 0 }}
    >
      <HeaderIcon headerInfo={headerInfo} />

      {/* Addresses */}
      <Container.Box mt={6}>
        <Address address={tx.fromAddress} isFromAddress />
        <Address address={tx.toAddress} isFromAddress={false} />
      </Container.Box>

      {/* Transaction Details */}
      <Typography.Subheading mt={6} w="100%" color="text-subdued">
        {intl.formatMessage({ id: 'transaction__transaction_details' })}
      </Typography.Subheading>

      <Container.Box mt={6}>
        <Container.Item
          title={intl.formatMessage({ id: 'content__amount' })}
          describe={`${amount} ${tx.symbol}`}
        />
        <Container.Item title="" wrap={feeInput} />
        {!!isNative && (
          <Container.Item
            title={`${intl.formatMessage({
              id: 'content__total',
            })}(${intl.formatMessage({
              id: 'content__amount',
            })} + ${intl.formatMessage({ id: 'content__fee' })})`}
            describe={`${tx.total} ${tx.symbol}`}
          />
        )}
      </Container.Box>
    </Box>
  );
};

export default TxConfirmDetail;
