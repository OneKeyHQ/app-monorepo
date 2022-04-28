import React, { FC } from 'react';

import { ethers } from '@onekeyfe/blockchain-libs';
import { useIntl } from 'react-intl';

import { Container } from '@onekeyhq/components';
import { ContentItemProps } from '@onekeyhq/components/src/ContentBox/ContentBasisItem';
import { IFeeInfoPayload } from '@onekeyhq/engine/src/types/vault';
import { EVMDecodedItem } from '@onekeyhq/engine/src/vaults/impl/evm/decoder/decoder';

export type TotalFeeProps = {
  tx: EVMDecodedItem;
  feeInfoPayload: IFeeInfoPayload;
  transferAmount?: string;
} & Omit<ContentItemProps, 'title'>;

const TotalFee: FC<TotalFeeProps> = (props) => {
  const intl = useIntl();

  const { tx, transferAmount, feeInfoPayload } = props;
  const symbol = feeInfoPayload.info.nativeSymbol ?? tx.symbol;
  let value = ethers.utils.parseUnits(tx.value, 'wei');
  if (transferAmount) {
    value = ethers.utils.parseEther(transferAmount);
  }
  const fee = ethers.utils.parseEther(feeInfoPayload.current.totalNative);
  const total = ethers.utils.formatEther(value.add(fee));

  return (
    <Container.Item
      {...props}
      title={`${intl.formatMessage({
        id: 'content__total',
      })}(${intl.formatMessage({
        id: 'content__amount',
      })} + ${intl.formatMessage({ id: 'content__fee' })})`}
      describe={`${total} ${symbol}`}
    />
  );
};

export default TotalFee;
