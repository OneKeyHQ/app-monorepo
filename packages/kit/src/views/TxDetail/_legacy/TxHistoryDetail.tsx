import type { FC } from 'react';

import { useIntl } from 'react-intl';

import { Box, Button, Container, Typography } from '@onekeyhq/components';
import type { EVMDecodedItem } from '@onekeyhq/engine/src/vaults/impl/evm/decoder/decoder';
import { EVMDecodedTxType } from '@onekeyhq/engine/src/vaults/impl/evm/decoder/decoder';

import useOpenBlockBrowser from '../../../hooks/useOpenBlockBrowser';

import Address from './Address';
import Hash from './Hash';
import HeaderIcon from './HeaderIcon';
import TotalFee from './TotalFee';

const TxHistoryDetail: FC<{
  tx: EVMDecodedItem;
}> = ({ tx }) => {
  const intl = useIntl();
  const openBlockBrowser = useOpenBlockBrowser(tx.network);

  const { txType, info, txStatus, blockSignedAt, nonce } = tx;

  let swapInfo;
  let tokenTransferInfo;
  let approveInfo;
  if (info) {
    switch (info.type) {
      case EVMDecodedTxType.INTERNAL_SWAP:
        swapInfo = info;
        break;
      case EVMDecodedTxType.TOKEN_TRANSFER:
        tokenTransferInfo = info;
        break;
      case EVMDecodedTxType.TOKEN_APPROVE:
        approveInfo = info;
        break;
      default:
        break;
    }
  }

  return (
    <Box
      flexDirection="column"
      p={0.5}
      alignItems="center"
      mb={{ base: 4, md: 0 }}
    >
      <HeaderIcon headerInfo={txStatus} />

      <Container.Box mt={6}>
        <Hash hash={tx.txHash} />

        <Address address={tx.fromAddress} isFromAddress />

        {!!tx.toAddress && (
          <Address address={tx.toAddress} isFromAddress={false} />
        )}

        {txType === EVMDecodedTxType.NATIVE_TRANSFER && (
          <Container.Item
            title={intl.formatMessage({ id: 'content__amount' })}
            describe={`${tx.amount} ${tx.symbol}`}
          />
        )}

        {!!tokenTransferInfo && (
          <Container.Item
            title={intl.formatMessage({ id: 'content__amount' })}
            describe={`${tokenTransferInfo.amount} ${tokenTransferInfo.token.symbol}`}
          />
        )}

        {!!approveInfo && (
          <Container.Item
            title={intl.formatMessage({ id: 'content__spend_limit_amount' })}
            describe={`${
              approveInfo.isUInt256Max
                ? intl.formatMessage({ id: 'form__unlimited' })
                : approveInfo.amount
            } ${approveInfo.token.symbol}`}
          />
        )}

        {!!swapInfo && (
          <Container.Item
            title={intl.formatMessage({ id: 'action__send' })}
            describe={`-${swapInfo.sellAmount} ${swapInfo.sellTokenSymbol}`}
          />
        )}

        {!!swapInfo && (
          <Container.Item
            title={intl.formatMessage({ id: 'action__receive' })}
            describe={`${swapInfo.buyAmount} ${swapInfo.buyTokenSymbol}`}
          />
        )}

        {!!blockSignedAt && (
          <Container.Item
            title={intl.formatMessage({ id: 'form__trading_time' })}
            describe={new Date(blockSignedAt).toLocaleString()}
          />
        )}

        {!!nonce && (
          <Container.Item
            title={intl.formatMessage({ id: 'content__nonce' })}
            describe={`${nonce}`}
          />
        )}

        <Container.Item
          title={intl.formatMessage({ id: 'content__fee' })}
          describe={`${tx.gasInfo.maxFeeSpend} ${tx.symbol}`}
        />

        <TotalFee tx={tx} />

        {!!tx.interactWith && (
          <Container.Item
            title={intl.formatMessage({ id: 'content__interact_with' })}
            describe={tx.interactWith}
          />
        )}
      </Container.Box>

      {/* Contract Data & More */}
      <Typography.Subheading mt={6} w="100%" color="text-subdued">
        {intl.formatMessage({ id: 'content__more_details' })}
      </Typography.Subheading>

      <Container.Box mt={6}>
        <Container.Item
          title={intl.formatMessage({ id: 'content__gas_limit' })}
          describe={tx.gasInfo.gasLimit.toString()}
        />

        {!!tx.gasInfo.gasUsed && (
          <Container.Item
            title={intl.formatMessage({ id: 'content__gas_used' })}
            describe={`${`${tx.gasInfo.gasUsed}(${(
              100 * tx.gasInfo.gasUsedRatio
            ).toFixed(2)}%)`}`}
          />
        )}

        <Container.Item
          title={intl.formatMessage({ id: 'content__gas_price' })}
          describe={`${`${tx.gasInfo.effectiveGasPriceInGwei} Gwei`}`}
        />
      </Container.Box>

      <Button
        w="100%"
        mt={6}
        size="lg"
        onPress={() => {
          openBlockBrowser.openTransactionDetails(tx.txHash);
        }}
        rightIconName="ArrowNarrowRightMini"
      >
        {intl.formatMessage({ id: 'action__view_in_explorer' })}
      </Button>
    </Box>
  );
};

export default TxHistoryDetail;
