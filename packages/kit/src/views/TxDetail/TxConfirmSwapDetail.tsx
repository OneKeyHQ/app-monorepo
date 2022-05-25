import React, { FC } from 'react';

import { useIntl } from 'react-intl';

import { Box, Container, Typography } from '@onekeyhq/components';
import {
  EVMDecodedItem,
  EVMDecodedItemInternalSwap,
} from '@onekeyhq/engine/src/vaults/impl/evm/decoder/decoder';
import { IFeeInfoPayload } from '@onekeyhq/engine/src/vaults/types';

import { IDappCallParams } from '../../background/IBackgroundApi';

import Address from './Address';
import HeaderIcon from './HeaderIcon';
import TotalFee from './TotalFee';

const TxConfirmSwapDetail: FC<{
  tx: EVMDecodedItem;
  sourceInfo?: IDappCallParams;
  feeInfoPayload?: IFeeInfoPayload | null;
  feeInput?: any;
}> = ({ tx, sourceInfo, feeInput, feeInfoPayload }) => {
  const { info } = tx;
  const swapInfo = info as EVMDecodedItemInternalSwap;
  const { buyTokenSymbol, sellTokenSymbol, buyAmount, sellAmount } = swapInfo;
  const intl = useIntl();

  return (
    <Box
      flexDirection="column"
      p={0.5}
      alignItems="center"
      mb={{ base: 4, md: 0 }}
    >
      <HeaderIcon
        headerInfo={{ iconName: 'BrandLogoIllus', title: 'OneKey Swap' }}
      />

      <Container.Box mt={6}>
        <Address address={tx.fromAddress} isFromAddress />
        <Container.Item
          title={intl.formatMessage({ id: 'action__send' })}
          describe={`${sellAmount} ${sellTokenSymbol}`}
        />

        <Container.Item
          title={intl.formatMessage({ id: 'action__receive' })}
          describe={`${buyAmount} ${buyTokenSymbol}`}
        />
        {!!sourceInfo && (
          <Container.Item
            title={`${intl.formatMessage({
              id: 'content__interact_with',
            })}`}
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

export default TxConfirmSwapDetail;
