import React, { FC } from 'react';

import { useIntl } from 'react-intl';

import { Box, Container, Typography } from '@onekeyhq/components';
import { IFeeInfoPayload } from '@onekeyhq/engine/src/types/vault';
import { EVMDecodedItem } from '@onekeyhq/engine/src/vaults/impl/evm/decoder/decoder';

import { IDappCallParams } from '../../background/IBackgroundApi';

import Address from './Address';
import HeaderIcon from './HeaderIcon';
import TotalFee from './TotalFee';

const TxConfirmBlindDetail: FC<{
  tx: EVMDecodedItem;
  sourceInfo?: IDappCallParams;
  feeInput?: any;
  feeInfoPayload?: IFeeInfoPayload | null;
}> = ({ tx, sourceInfo, feeInput, feeInfoPayload }) => {
  const intl = useIntl();

  return (
    <Box
      flexDirection="column"
      p={0.5}
      alignItems="center"
      mb={{ base: 4, md: 0 }}
    >
      <HeaderIcon headerInfo={tx.network} />

      <Container.Box mt={6}>
        <Address address={tx.fromAddress} isFromAddress />
        <Address address={tx.toAddress} isFromAddress={false} />
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
        <Container.Item
          title={intl.formatMessage({ id: 'content__amount' })}
          describe={`${tx.amount} ${tx.symbol}`}
        />
        <Container.Item wrap={feeInput} />
        {!!feeInfoPayload && parseInt(tx.value) !== 0 && (
          <TotalFee tx={tx} feeInfoPayload={feeInfoPayload} />
        )}
      </Container.Box>

      {/* Contract Data & More */}
      <Typography.Subheading mt={6} w="100%" color="text-subdued">
        {intl.formatMessage({ id: 'content__more_details' })}
      </Typography.Subheading>
      <Container.Box mt={6}>
        <Container.Item
          title={intl.formatMessage({ id: 'form__contract_data' })}
          describe={tx.data.slice(0, 100)}
          hasArrow
        />
      </Container.Box>
    </Box>
  );
};

export default TxConfirmBlindDetail;
