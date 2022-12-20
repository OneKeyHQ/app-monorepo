import type { FC } from 'react';

import { useIntl } from 'react-intl';

import { Box, Container, Typography } from '@onekeyhq/components';
import type { EVMDecodedItem } from '@onekeyhq/engine/src/vaults/impl/evm/decoder/decoder';
import type { IFeeInfoPayload } from '@onekeyhq/engine/src/vaults/types';
import type { IDappSourceInfo } from '@onekeyhq/shared/types';

import Address from './Address';
import ContractData from './ContractData';
import HeaderIcon from './HeaderIcon';
import TotalFee from './TotalFee';

const TxConfirmBlindDetail: FC<{
  tx: EVMDecodedItem;
  sourceInfo?: IDappSourceInfo;
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

        {/* toAddress could be a null if it's a contract creation */}
        {!!tx.toAddress && (
          <Address address={tx.toAddress} isFromAddress={false} />
        )}

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
        <ContractData tx={tx} />
      </Container.Box>
    </Box>
  );
};

export default TxConfirmBlindDetail;
