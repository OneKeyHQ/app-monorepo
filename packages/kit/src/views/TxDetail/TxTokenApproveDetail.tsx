import React, { FC } from 'react';

import { useIntl } from 'react-intl';

import { Box, Container, Typography } from '@onekeyhq/components';
import {
  EVMDecodedItem,
  EVMDecodedItemERC20Approve,
} from '@onekeyhq/engine/src/vaults/impl/evm/decoder/decoder';

import { IDappCallParams } from '../../background/IBackgroundApi';

import Address from './Address';
import HeaderIcon from './HeaderIcon';

const TxTokenApproveDetail: FC<{
  tx: EVMDecodedItem;
  sourceInfo?: IDappCallParams;
  feeInput?: any;
  approveAmountInput?: any;
}> = ({ tx, sourceInfo, feeInput, approveAmountInput }) => {
  const intl = useIntl();
  const info = tx.info as EVMDecodedItemERC20Approve;

  return (
    <Box
      flexDirection="column"
      p={0.5}
      alignItems="center"
      mb={{ base: 4, md: 0 }}
    >
      <HeaderIcon headerInfo={info.token} />

      {/* Token Approval Details */}
      <Container.Box mt={6}>
        <Address address={tx.fromAddress} isFromAddress />
        <Address address={tx.toAddress} isFromAddress={false} />
        {approveAmountInput}
        {!!sourceInfo && (
          <Container.Item
            title={intl.formatMessage({ id: 'content__interact_with' })}
            describe={sourceInfo.origin}
          />
        )}
      </Container.Box>

      {/* Transaction Details */}
      <Typography.Subheading mt={6} w="100%" color="text-subdued">
        {intl.formatMessage({ id: 'transaction__transaction_details' })}
      </Typography.Subheading>

      <Container.Box mt={6}>
        {feeInput ? (
          <Container.Item wrap={feeInput} />
        ) : (
          <Container.Item
            title={intl.formatMessage({ id: 'form__fee_estimated' })}
            describe={`${tx.gasSpend} ${tx.symbol}`}
            hasArrow
          />
        )}
      </Container.Box>

      {/* Contract Data & More */}
      <Typography.Subheading mt={6} w="100%" color="text-subdued">
        {intl.formatMessage({ id: 'content__more_details' })}
      </Typography.Subheading>
      <Container.Box mt={6}>
        <Container.Item
          title={intl.formatMessage({ id: 'form__contract_data' })}
          describe={tx.data}
          hasArrow
        />
      </Container.Box>
    </Box>
  );
};

export default TxTokenApproveDetail;
