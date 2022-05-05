import React, { FC, useEffect, useState } from 'react';

import { ethers } from '@onekeyfe/blockchain-libs';
import { useIntl } from 'react-intl';

import { Box, Container, Typography } from '@onekeyhq/components';
import { IFeeInfoPayload } from '@onekeyhq/engine/src/types/vault';
import { EVMDecodedItem } from '@onekeyhq/engine/src/vaults/impl/evm/decoder/decoder';

import { IDappCallParams } from '../../background/IBackgroundApi';
import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { SwapQuote } from '../Swap/typings';

import Address from './Address';
import HeaderIcon from './HeaderIcon';
import TotalFee from './TotalFee';

const NativeCurrencyPseudoAddress =
  '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';

const OnekeyLogoUrl =
  'https://help.onekey.so/hc/article_attachments/4578205272847/OneKey__1_.png';

const TxConfirmSwapDetail: FC<{
  tx: EVMDecodedItem;
  swapQuote: SwapQuote;
  sourceInfo?: IDappCallParams;
  feeInfoPayload?: IFeeInfoPayload | null;
  feeInput?: any;
}> = ({ tx, sourceInfo, feeInput, swapQuote, feeInfoPayload }) => {
  const { network } = tx;

  const intl = useIntl();
  const [tokens, setTokens] = useState<{
    buy: { amount: string; symbol: string };
    sell: { amount: string; symbol: string };
  }>();

  useEffect(() => {
    const getTokensInfo = async () => {
      const { buyTokenAddress, sellTokenAddress, buyAmount, sellAmount } =
        swapQuote;

      const tokensInfo = (
        [
          [buyTokenAddress, buyAmount],
          [sellTokenAddress, sellAmount],
        ] as const
      ).map(async ([tokenAddress, tokenAmount]) => {
        const address = tokenAddress.toLowerCase();
        if (address === NativeCurrencyPseudoAddress) {
          const amount = ethers.utils.formatEther(tokenAmount);
          return { amount, symbol: network.symbol };
        }
        const token = await backgroundApiProxy.engine.getOrAddToken(
          network.id,
          address,
        );
        const symbol = token?.symbol ?? '';
        const amount = ethers.utils.formatUnits(tokenAmount, token?.decimals);
        return { amount, symbol };
      });

      const [buy, sell] = await Promise.all(tokensInfo);
      setTokens({ buy, sell });
    };
    getTokensInfo();
  }, [network.id, network.symbol, swapQuote]);

  return (
    <Box
      flexDirection="column"
      p={0.5}
      alignItems="center"
      mb={{ base: 4, md: 0 }}
    >
      <HeaderIcon
        headerInfo={{ iconUrl: OnekeyLogoUrl, iconName: 'OneKey Swap' }}
      />

      <Container.Box mt={6}>
        <Address address={tx.fromAddress} isFromAddress />
        {!!tokens && (
          <Container.Item
            title={intl.formatMessage({ id: 'action__send' })}
            describe={`${tokens.sell.amount} ${tokens.sell.symbol}`}
          />
        )}
        {!!tokens && (
          <Container.Item
            title={intl.formatMessage({ id: 'action__receive' })}
            describe={`${tokens.buy.amount} ${tokens.buy.symbol}`}
          />
        )}
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
