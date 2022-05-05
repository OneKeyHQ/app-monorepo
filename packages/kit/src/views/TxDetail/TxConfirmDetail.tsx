import React, { FC } from 'react';

import { useIntl } from 'react-intl';

import { Box, Container, Typography } from '@onekeyhq/components';
import { IFeeInfoPayload } from '@onekeyhq/engine/src/types/vault';
import {
  EVMDecodedItem,
  EVMDecodedItemERC20Transfer,
  EVMDecodedTxType,
} from '@onekeyhq/engine/src/vaults/impl/evm/decoder/decoder';

import Address from './Address';
import HeaderIcon from './HeaderIcon';
import TotalFee from './TotalFee';

const TxConfirmDetail: FC<{
  tx: EVMDecodedItem;
  transferAmount?: string;
  feeInput?: any;
  feeInfoPayload?: IFeeInfoPayload | null;
}> = ({ tx, transferAmount, feeInput, feeInfoPayload }) => {
  const intl = useIntl();
  const info = tx.info as EVMDecodedItemERC20Transfer;
  const isNative = tx.txType === EVMDecodedTxType.NATIVE_TRANSFER;
  const headerInfo = isNative ? tx.network : info.token;
  let amount = transferAmount;
  if (!amount) {
    amount = isNative ? tx.amount : info.amount;
  }
  const symbol = isNative ? tx.symbol : info.token.symbol;
  const recipient = isNative ? tx.toAddress : info.recipient;

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
        <Address address={recipient} isFromAddress={false} />
      </Container.Box>

      {/* Transaction Details */}
      <Typography.Subheading mt={6} w="100%" color="text-subdued">
        {intl.formatMessage({ id: 'transaction__transaction_details' })}
      </Typography.Subheading>

      <Container.Box mt={6}>
        <Container.Item
          title={intl.formatMessage({ id: 'content__amount' })}
          describe={`${amount} ${symbol}`}
        />
        <Container.Item wrap={feeInput} />
        {!!feeInfoPayload && isNative && (
          <TotalFee
            tx={tx}
            feeInfoPayload={feeInfoPayload}
            transferAmount={transferAmount}
          />
        )}
      </Container.Box>
    </Box>
  );
};

export default TxConfirmDetail;
