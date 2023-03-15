import { useMemo } from 'react';

import BigNumber from 'bignumber.js';

import { shortenAddress } from '@onekeyhq/components/src/utils';

import { FormatCurrencyNumber } from '../../../components/Format';
import { useSimpleTokenPriceValue } from '../../../hooks/useManegeTokenPrice';
import NFTListImage from '../../Wallet/NFT/NFTList/NFTListImage';
import {
  TxListActionBox,
  TxListActionBoxExtraText,
} from '../components/TxListActionBox';
import {
  TxActionAmountMetaDataWithDirection,
  TxActionElementAmountNormal,
} from '../elements/TxActionElementAmount';

import { TxActionNFTTransfer, getTxActionNFTInfo } from './TxActionNFTTransfer';

import type { ITxActionCardProps } from '../types';

export function TxActionNFTTrade(props: ITxActionCardProps) {
  return TxActionNFTTransfer(props);
}

export function TxActionNFTTradeT0(props: ITxActionCardProps) {
  const { action, meta, decodedTx } = props;
  const { amount, symbol, send, receive, isOut, asset } =
    getTxActionNFTInfo(props);
  const { color } = TxActionAmountMetaDataWithDirection(action.direction);
  const amountBN = useMemo(() => new BigNumber(amount), [amount]);
  const { nftTrade } = action;
  const { networkId } = decodedTx;
  const tokenId = nftTrade?.tradeSymbolAddress ?? '';
  const value = nftTrade?.value ?? '0';
  const price = useSimpleTokenPriceValue({
    networkId,
    contractAdress: tokenId,
  });

  const convertValue = useMemo(() => {
    if (value && price) {
      return new BigNumber(value).multipliedBy(price);
    }
  }, [price, value]);

  return (
    <TxListActionBox
      symbol={symbol}
      icon={
        asset ? (
          <NFTListImage asset={asset} borderRadius="6px" size={32} />
        ) : undefined
      }
      titleInfo={meta?.titleInfo}
      content={
        <TxActionElementAmountNormal
          textAlign="right"
          justifyContent="flex-end"
          amount={amountBN.gt(1) ? amount : undefined}
          symbol={symbol}
          color={color}
          direction={amountBN.gt(1) ? action.direction : undefined}
        />
      }
      subTitle={isOut ? shortenAddress(receive) : shortenAddress(send)}
      extra={
        <TxListActionBoxExtraText>
          <FormatCurrencyNumber
            value={0}
            decimals={2}
            convertValue={convertValue}
          />
        </TxListActionBoxExtraText>
      }
    />
  );
}
